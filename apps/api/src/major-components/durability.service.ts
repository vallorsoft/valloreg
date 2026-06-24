import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ALL_FLEET_SEGMENTS,
  ALL_MAJOR_COMPONENTS,
  DURABILITY_MIN_SAMPLES,
  DurabilityStatus,
  durabilityStatusOf,
  fleetSegmentOf,
  isMajorComponent,
  median,
  seedLifetimeKm,
  type DurabilitySurveyRow,
  type MajorComponent,
  type VehicleComponentForecast,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AppException } from '../common/exceptions/app.exception';

/** Egy esemény leszűkített alakja a számításhoz. */
interface EventLite {
  vehicleId: string;
  component: string;
  odometerKm: number | null;
  totalCost: Prisma.Decimal | null;
  partsCost: Prisma.Decimal | null;
  laborCost: Prisma.Decimal | null;
  currency: string | null;
}

/** A várható élettartam feloldva (forrással). */
interface Expected {
  expectedKm: number;
  source: 'manual' | 'empirical' | 'seed';
}

const key = (segment: string, component: string) => `${segment}::${component}`;

/**
 * Nagy alkatrész TARTÓSSÁG – olvasásidejű felmérés és előrejelzés, SZEGMENSENKÉNT.
 *
 * A kifutási idő nem egyforma kategóriánként (furgon vs. nyerges vs. pótkocsi),
 * ezért minden számítás szegmens × fődarab bontásban megy. A várható élettartam
 * három forrásból, ebben a prioritásban:
 *   1) KÉZI felülírás (DurabilityBaseline) – a felhasználó beállítása,
 *   2) tanult empirikus medián (elég valós minta felett az adott szegmensben),
 *   3) seed (bázis × szegmens-szorzó) – alapértelmezett.
 */
@Injectable()
export class DurabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Flotta-szintű felmérés: minden szegmens × fődarab (effektív + felülírás). */
  async survey(): Promise<DurabilitySurveyRow[]> {
    const [events, segmentByVehicle, overrides] = await Promise.all([
      this.loadEvents(),
      this.segmentByVehicle(),
      this.loadOverrides(),
    ]);
    const intervals = this.intervalsBySegmentComponent(events, segmentByVehicle);

    const rows: DurabilitySurveyRow[] = [];
    for (const segment of ALL_FLEET_SEGMENTS) {
      for (const component of ALL_MAJOR_COMPONENTS) {
        const samples = intervals.get(key(segment, component)) ?? [];
        const override = overrides.get(key(segment, component));
        const { expectedKm, source } = this.resolveExpected(
          component,
          segment,
          samples,
          override,
        );
        rows.push({
          segment,
          component,
          expectedKm,
          source,
          sampleCount: samples.length,
          seedKm: seedLifetimeKm(component, segment),
          overrideKm: override ?? null,
        });
      }
    }
    return rows;
  }

  /** Egy jármű fődarabjainak előrejelzése (esedékesség + becsült költség). */
  async forecastForVehicle(
    vehicleId: string,
  ): Promise<VehicleComponentForecast[]> {
    const vehicle = await this.prisma.scoped.vehicle.findFirst({
      where: { id: vehicleId },
      select: {
        id: true,
        odometerKm: true,
        category: true,
        vehicleType: true,
        maxMassKg: true,
        fleetSegment: true,
      },
    });
    if (!vehicle) {
      throw AppException.notFound('A jármű nem található.');
    }
    const segment = fleetSegmentOf(vehicle);

    const [allEvents, overrides] = await Promise.all([
      this.loadEvents(),
      this.loadOverrides(),
    ]);
    const segmentByVehicle = await this.segmentByVehicle();
    const intervals = this.intervalsBySegmentComponent(allEvents, segmentByVehicle);
    const costByComponent = this.costByComponent(allEvents);

    // A jármű eseményei fődarabonként.
    const own = allEvents.filter((e) => e.vehicleId === vehicleId);
    const byComponent = new Map<string, EventLite[]>();
    for (const e of own) {
      const list = byComponent.get(e.component) ?? [];
      list.push(e);
      byComponent.set(e.component, list);
    }

    const result: VehicleComponentForecast[] = [];
    for (const [componentRaw, list] of byComponent) {
      if (!isMajorComponent(componentRaw)) continue;
      const component = componentRaw;

      const lastEventKm = list
        .map((e) => e.odometerKm)
        .filter((v): v is number => v != null)
        .reduce<number | null>((max, v) => (max == null || v > max ? v : max), null);

      const { expectedKm, source } = this.resolveExpected(
        component,
        segment,
        intervals.get(key(segment, component)) ?? [],
        overrides.get(key(segment, component)),
      );

      const kmSince =
        vehicle.odometerKm != null && lastEventKm != null
          ? Math.max(0, vehicle.odometerKm - lastEventKm)
          : null;

      const status =
        kmSince != null
          ? durabilityStatusOf(kmSince, expectedKm)
          : DurabilityStatus.OK;

      const cost = costByComponent.get(component);

      result.push({
        component,
        lastEventKm,
        kmSince,
        expectedKm,
        source,
        status,
        estimatedNextDueKm:
          lastEventKm != null ? lastEventKm + expectedKm : null,
        estimatedCost: cost?.amount != null ? cost.amount.toString() : null,
        currency: cost?.currency ?? null,
      });
    }

    result.sort(
      (a, b) =>
        ALL_MAJOR_COMPONENTS.indexOf(a.component) -
        ALL_MAJOR_COMPONENTS.indexOf(b.component),
    );
    return result;
  }

  /**
   * Esedékes/lejárt fődarabok száma járművenként (bulk). A ranglista és a
   * csere-tanácsadó használja. Szegmens-tudatos.
   */
  async dueCountsByVehicle(): Promise<Map<string, number>> {
    const [events, overrides] = await Promise.all([
      this.loadEvents(),
      this.loadOverrides(),
    ]);
    const vehicles = await this.prisma.scoped.vehicle.findMany({
      select: {
        id: true,
        odometerKm: true,
        category: true,
        vehicleType: true,
        maxMassKg: true,
        fleetSegment: true,
      },
    });
    const segmentByVehicle = new Map<string, string>(
      vehicles.map((v) => [v.id, fleetSegmentOf(v)]),
    );
    const odometerByVehicle = new Map<string, number | null>(
      vehicles.map((v) => [v.id, v.odometerKm]),
    );
    const intervals = this.intervalsBySegmentComponent(events, segmentByVehicle);

    // Járművenként a fődarab legutóbbi cserekori km-állása.
    const lastByVehicleComponent = new Map<string, number>();
    for (const e of events) {
      if (e.odometerKm == null) continue;
      const k = `${e.vehicleId}::${e.component}`;
      const prev = lastByVehicleComponent.get(k);
      if (prev == null || e.odometerKm > prev) {
        lastByVehicleComponent.set(k, e.odometerKm);
      }
    }

    const due = new Map<string, number>();
    for (const [k, lastKm] of lastByVehicleComponent) {
      const [vehicleId, component] = k.split('::') as [string, string];
      const odo = odometerByVehicle.get(vehicleId);
      if (odo == null) continue;
      if (!isMajorComponent(component)) continue;
      const segment = segmentByVehicle.get(vehicleId) ?? 'other';
      const { expectedKm } = this.resolveExpected(
        component,
        segment,
        intervals.get(key(segment, component)) ?? [],
        overrides.get(key(segment, component)),
      );
      const status = durabilityStatusOf(Math.max(0, odo - lastKm), expectedKm);
      if (status === DurabilityStatus.DUE || status === DurabilityStatus.OVERDUE) {
        due.set(vehicleId, (due.get(vehicleId) ?? 0) + 1);
      }
    }
    return due;
  }

  /** Kézi felülírás mentése (szegmens + fődarab → várható km). */
  async setBaseline(
    tenantId: string,
    segment: string,
    component: string,
    expectedKm: number,
  ) {
    if (
      !(ALL_FLEET_SEGMENTS as readonly string[]).includes(segment) ||
      !isMajorComponent(component)
    ) {
      throw AppException.validation('Érvénytelen szegmens vagy fődarab.');
    }
    // findFirst(scoped) + update/create – a bevált tenant-scope minta (mint a
    // tanuló mappingeknél), hogy a tenant-szűrés biztosan érvényesüljön.
    const existing = await this.prisma.scoped.durabilityBaseline.findFirst({
      where: { segment, component },
      select: { id: true },
    });
    if (existing) {
      return this.prisma.scoped.durabilityBaseline.update({
        where: { id: existing.id },
        data: { expectedKm },
      });
    }
    return this.prisma.scoped.durabilityBaseline.create({
      data: { tenantId, segment, component, expectedKm },
    });
  }

  /** Kézi felülírás törlése (visszaáll a tanult/seed értékre). */
  async clearBaseline(segment: string, component: string) {
    await this.prisma.scoped.durabilityBaseline.deleteMany({
      where: { segment, component },
    });
    return { segment, component };
  }

  // ── segédek ────────────────────────────────────────────────────────────────

  private async loadEvents(): Promise<EventLite[]> {
    return this.prisma.scoped.majorComponentEvent.findMany({
      select: {
        vehicleId: true,
        component: true,
        odometerKm: true,
        totalCost: true,
        partsCost: true,
        laborCost: true,
        currency: true,
      },
    });
  }

  /** Jármű → szegmens leképezés (a forgalmi adatokból levezetve). */
  private async segmentByVehicle(): Promise<Map<string, string>> {
    const vehicles = await this.prisma.scoped.vehicle.findMany({
      select: {
        id: true,
        category: true,
        vehicleType: true,
        maxMassKg: true,
        fleetSegment: true,
      },
    });
    return new Map(vehicles.map((v) => [v.id, fleetSegmentOf(v)]));
  }

  /** Kézi felülírások: `${segment}::${component}` → km. */
  private async loadOverrides(): Promise<Map<string, number>> {
    const rows = await this.prisma.scoped.durabilityBaseline.findMany({
      select: { segment: true, component: true, expectedKm: true },
    });
    return new Map(rows.map((r) => [key(r.segment, r.component), r.expectedKm]));
  }

  /**
   * Csere-intervallumok (km) `${segment}::${component}` szerint: járművenként az
   * egymást követő cserék odométer-különbsége egy-egy minta, a jármű szegmensébe.
   */
  private intervalsBySegmentComponent(
    events: EventLite[],
    segmentByVehicle: Map<string, string>,
  ): Map<string, number[]> {
    const groups = new Map<string, number[]>();
    for (const e of events) {
      if (e.odometerKm == null) continue;
      const k = `${e.vehicleId}::${e.component}`;
      const list = groups.get(k) ?? [];
      list.push(e.odometerKm);
      groups.set(k, list);
    }

    const intervals = new Map<string, number[]>();
    for (const [k, odos] of groups) {
      const [vehicleId, component] = k.split('::') as [string, string];
      const segment = segmentByVehicle.get(vehicleId) ?? 'other';
      odos.sort((a, b) => a - b);
      for (let i = 1; i < odos.length; i++) {
        const diff = odos[i]! - odos[i - 1]!;
        if (diff > 0) {
          const sk = key(segment, component);
          const list = intervals.get(sk) ?? [];
          list.push(diff);
          intervals.set(sk, list);
        }
      }
    }
    return intervals;
  }

  /** Várható élettartam: kézi felülírás > empirikus medián > seed (szegmensre). */
  private resolveExpected(
    component: MajorComponent,
    segment: string,
    samples: number[],
    override: number | undefined,
  ): Expected {
    if (override != null && override > 0) {
      return { expectedKm: override, source: 'manual' };
    }
    if (samples.length >= DURABILITY_MIN_SAMPLES) {
      const m = median(samples);
      if (m != null && m > 0) {
        return { expectedKm: Math.round(m), source: 'empirical' };
      }
    }
    return { expectedKm: seedLifetimeKm(component, segment), source: 'seed' };
  }

  /** Fődarabonkénti becsült költség (totalCost medián) + jellemző pénznem. */
  private costByComponent(
    events: EventLite[],
  ): Map<string, { amount: Prisma.Decimal | null; currency: string | null }> {
    const costs = new Map<string, number[]>();
    const currencies = new Map<string, string>();
    for (const e of events) {
      const total =
        e.totalCost ??
        (e.partsCost != null || e.laborCost != null
          ? (e.partsCost ?? new Prisma.Decimal(0)).add(
              e.laborCost ?? new Prisma.Decimal(0),
            )
          : null);
      if (total == null) continue;
      const list = costs.get(e.component) ?? [];
      list.push(Number(total));
      costs.set(e.component, list);
      if (!currencies.has(e.component) && e.currency) {
        currencies.set(e.component, e.currency);
      }
    }
    const result = new Map<
      string,
      { amount: Prisma.Decimal | null; currency: string | null }
    >();
    for (const [component, values] of costs) {
      const m = median(values);
      result.set(component, {
        amount: m != null ? new Prisma.Decimal(m) : null,
        currency: currencies.get(component) ?? null,
      });
    }
    return result;
  }
}
