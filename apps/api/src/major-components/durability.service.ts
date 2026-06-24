import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  ALL_MAJOR_COMPONENTS,
  DURABILITY_MIN_SAMPLES,
  DurabilityStatus,
  durabilityStatusOf,
  isMajorComponent,
  MAJOR_COMPONENT_LIFETIME_KM,
  median,
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

/**
 * Nagy alkatrész TARTÓSSÁG – olvasásidejű felmérés és előrejelzés.
 *
 * A rendszer a tenant valós cseréiből MEGTANULJA a fődarabok élettartamát:
 * járművenként a fődarab egymást követő cseréi közti km-távolság egy-egy minta;
 * ezek mediánja az empirikus élettartam. Elég minta felett (>= küszöb) ezt
 * használjuk a seed helyett. Az eredmény olvasásidőben számított – nincs külön
 * tábla, nincs elavuló állapot.
 */
@Injectable()
export class DurabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /** Flotta-szintű tartósság-felmérés: per fődarab tanult/seed élettartam. */
  async survey(): Promise<DurabilitySurveyRow[]> {
    const events = await this.loadEvents();
    const intervals = this.intervalsByComponent(events);
    return ALL_MAJOR_COMPONENTS.map((component) =>
      this.surveyRow(component, intervals.get(component) ?? []),
    );
  }

  /** Egy jármű fődarabjainak előrejelzése (esedékesség + becsült költség). */
  async forecastForVehicle(
    vehicleId: string,
  ): Promise<VehicleComponentForecast[]> {
    const vehicle = await this.prisma.scoped.vehicle.findFirst({
      where: { id: vehicleId },
      select: { id: true, odometerKm: true },
    });
    if (!vehicle) {
      throw AppException.notFound('A jármű nem található.');
    }

    // Tenant-szintű empirikus élettartam + költségbecslés (tanuló alap).
    const allEvents = await this.loadEvents();
    const intervals = this.intervalsByComponent(allEvents);
    const costByComponent = this.costByComponent(allEvents);

    // A jármű eseményei fődarabonként, odométer szerint rendezve.
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

      const { expectedKm, source } = this.expectedFor(
        component,
        intervals.get(component) ?? [],
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

    // Stabil sorrend: a globális fődarab-sorrend szerint.
    result.sort(
      (a, b) =>
        ALL_MAJOR_COMPONENTS.indexOf(a.component) -
        ALL_MAJOR_COMPONENTS.indexOf(b.component),
    );
    return result;
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

  /**
   * Csere-intervallumok (km) fődarabonként: járművenként az egymást követő
   * cserék odométer-különbsége egy-egy minta.
   */
  private intervalsByComponent(events: EventLite[]): Map<string, number[]> {
    // Csoportosítás jármű + komponens szerint, odométerrel.
    const groups = new Map<string, number[]>();
    for (const e of events) {
      if (e.odometerKm == null) continue;
      const key = `${e.vehicleId}::${e.component}`;
      const list = groups.get(key) ?? [];
      list.push(e.odometerKm);
      groups.set(key, list);
    }

    const intervals = new Map<string, number[]>();
    for (const [key, odos] of groups) {
      const component = key.split('::')[1]!;
      odos.sort((a, b) => a - b);
      for (let i = 1; i < odos.length; i++) {
        const diff = odos[i]! - odos[i - 1]!;
        if (diff > 0) {
          const list = intervals.get(component) ?? [];
          list.push(diff);
          intervals.set(component, list);
        }
      }
    }
    return intervals;
  }

  /** Várható élettartam: empirikus medián, ha elég minta; különben seed. */
  private expectedFor(
    component: MajorComponent,
    samples: number[],
  ): { expectedKm: number; source: 'empirical' | 'seed' } {
    const seedKm = MAJOR_COMPONENT_LIFETIME_KM[component];
    if (samples.length >= DURABILITY_MIN_SAMPLES) {
      const m = median(samples);
      if (m != null && m > 0) return { expectedKm: Math.round(m), source: 'empirical' };
    }
    return { expectedKm: seedKm, source: 'seed' };
  }

  private surveyRow(
    component: MajorComponent,
    samples: number[],
  ): DurabilitySurveyRow {
    const { expectedKm, source } = this.expectedFor(component, samples);
    return {
      component,
      expectedKm,
      source,
      sampleCount: samples.length,
      seedKm: MAJOR_COMPONENT_LIFETIME_KM[component],
    };
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
