import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  economyScoreFrom,
  fleetSegmentOf,
  median,
  normalizeLowerBetter,
  RankingBadge,
  type RankingGroup,
  type RankingsResult,
  type VehicleRanking,
} from '@valloreg/shared';
import { PrismaService } from '../prisma/prisma.service';
import { DurabilityService } from '../major-components/durability.service';

/** Egy jármű nyers metrikái a pontszámításhoz. */
interface VehicleMetrics {
  vehicleId: string;
  label: string;
  segment: string;
  makeModel: string;
  currency: string | null;
  totalSpent: Prisma.Decimal;
  odometerKm: number | null;
  costPerKm: number | null;
  reliabilityPer100k: number | null;
  revenuePerKm: number | null;
  majorEventCount: number;
  bigPartsDue: number;
}

/**
 * Jármű-ranglista: költséghatékonyság + megbízhatóság (és ahol van bevétel,
 * valós nyereség/km). A pontszám SZEGMENSEN belül normalizált. Olvasásidejű –
 * minden lekérdezés tenant-scope-olt. A „cserére érdemes" jelzés a nagy
 * alkatrész esedékességet és a szegmens-medián feletti költséget kombinálja.
 */
@Injectable()
export class RankingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly durability: DurabilityService,
  ) {}

  async getRankings(): Promise<RankingsResult> {
    const vehicles = await this.prisma.scoped.vehicle.findMany({
      select: {
        id: true,
        plate: true,
        make: true,
        model: true,
        year: true,
        odometerKm: true,
        category: true,
        vehicleType: true,
        maxMassKg: true,
        fleetSegment: true,
        revenuePerKm: true,
      },
    });
    if (vehicles.length === 0) return { bySegment: [], byModel: [] };

    // Költségek járművenként (a hozzárendelt számlatételekből).
    const items = await this.prisma.scoped.invoiceItem.findMany({
      where: { vehicleId: { not: null } },
      select: {
        vehicleId: true,
        price: true,
        invoice: { select: { currency: true } },
      },
    });
    const spentByVehicle = new Map<string, Prisma.Decimal>();
    const currencyByVehicle = new Map<string, string>();
    for (const it of items) {
      if (!it.vehicleId) continue;
      spentByVehicle.set(
        it.vehicleId,
        (spentByVehicle.get(it.vehicleId) ?? new Prisma.Decimal(0)).add(it.price),
      );
      if (!currencyByVehicle.has(it.vehicleId) && it.invoice?.currency) {
        currencyByVehicle.set(it.vehicleId, it.invoice.currency);
      }
    }

    // Nagy alkatrész események száma + esedékes/lejárt darabszám.
    const eventCounts = await this.prisma.scoped.majorComponentEvent.groupBy({
      by: ['vehicleId'],
      _count: { _all: true },
    });
    const eventCountByVehicle = new Map<string, number>();
    for (const row of eventCounts) {
      eventCountByVehicle.set(row.vehicleId, row._count._all);
    }
    const odometerByVehicle = new Map<string, number | null>(
      vehicles.map((v) => [v.id, v.odometerKm] as [string, number | null]),
    );
    const dueByVehicle =
      await this.durability.dueCountsByVehicle(odometerByVehicle);

    // Nyers metrikák.
    const metrics: VehicleMetrics[] = vehicles.map((v) => {
      const totalSpent = spentByVehicle.get(v.id) ?? new Prisma.Decimal(0);
      const odo = v.odometerKm;
      const costPerKm =
        odo != null && odo > 0 ? Number(totalSpent) / odo : null;
      const majorEventCount = eventCountByVehicle.get(v.id) ?? 0;
      const reliabilityPer100k =
        odo != null && odo > 0 ? majorEventCount / (odo / 100_000) : null;
      const revenuePerKm = v.revenuePerKm != null ? Number(v.revenuePerKm) : null;
      return {
        vehicleId: v.id,
        label: vehicleLabel(v),
        segment: fleetSegmentOf(v),
        makeModel: [v.make, v.model].filter(Boolean).join(' ').trim() || '—',
        currency: currencyByVehicle.get(v.id) ?? null,
        totalSpent,
        odometerKm: odo,
        costPerKm,
        reliabilityPer100k,
        revenuePerKm,
        majorEventCount,
        bigPartsDue: dueByVehicle.get(v.id) ?? 0,
      };
    });

    const bySegment = this.rankGroups(metrics, (m) => m.segment, true);
    const byModel = this.rankGroups(metrics, (m) => m.makeModel, false);
    return { bySegment, byModel };
  }

  /**
   * Csoportosítás kulcs szerint, pontszámítás és jelvény-kiosztás csoporton
   * belül. `assignChampion` = SEGMENT_CHAMPION (szegmens) vagy MODEL_CHAMPION.
   */
  private rankGroups(
    metrics: VehicleMetrics[],
    keyOf: (m: VehicleMetrics) => string,
    isSegment: boolean,
  ): RankingGroup[] {
    const groups = new Map<string, VehicleMetrics[]>();
    for (const m of metrics) {
      const key = keyOf(m);
      const list = groups.get(key) ?? [];
      list.push(m);
      groups.set(key, list);
    }

    const result: RankingGroup[] = [];
    for (const [key, members] of groups) {
      const costs = members
        .map((m) => m.costPerKm)
        .filter((v): v is number => v != null);
      const rels = members
        .map((m) => m.reliabilityPer100k)
        .filter((v): v is number => v != null);
      const minCost = Math.min(...costs);
      const maxCost = Math.max(...costs);
      const minRel = rels.length ? Math.min(...rels) : 0;
      const maxRel = rels.length ? Math.max(...rels) : 0;
      const medianCost = median(costs);

      const ranked: VehicleRanking[] = members.map((m) => {
        const normCost =
          m.costPerKm != null
            ? normalizeLowerBetter(m.costPerKm, minCost, maxCost)
            : 1;
        const normRel =
          m.reliabilityPer100k != null
            ? normalizeLowerBetter(m.reliabilityPer100k, minRel, maxRel)
            : 0;
        const economyScore = economyScoreFrom(normCost, normRel);
        const profitPerKm =
          m.revenuePerKm != null && m.costPerKm != null
            ? m.revenuePerKm - m.costPerKm
            : null;
        const replaceAdvice =
          m.bigPartsDue > 0 &&
          m.costPerKm != null &&
          medianCost != null &&
          m.costPerKm > medianCost;
        return {
          vehicleId: m.vehicleId,
          label: m.label,
          segment: m.segment,
          makeModel: m.makeModel,
          currency: m.currency,
          totalSpent: m.totalSpent.toString(),
          odometerKm: m.odometerKm,
          costPerKm: m.costPerKm != null ? m.costPerKm.toFixed(2) : null,
          revenuePerKm:
            m.revenuePerKm != null ? m.revenuePerKm.toFixed(2) : null,
          profitPerKm: profitPerKm != null ? profitPerKm.toFixed(2) : null,
          majorEventCount: m.majorEventCount,
          bigPartsDue: m.bigPartsDue,
          economyScore,
          replaceAdvice,
          badges: [],
        };
      });

      ranked.sort((a, b) => b.economyScore - a.economyScore);

      // Jelvények: bajnok (rang 1) – modell-csoportnál csak ha >= 2 jármű.
      const championBadge = isSegment
        ? RankingBadge.SEGMENT_CHAMPION
        : RankingBadge.MODEL_CHAMPION;
      if (ranked.length > 0 && (isSegment || ranked.length >= 2)) {
        ranked[0]!.badges.push(championBadge);
      }
      if (isSegment) {
        // Legolcsóbb költség/km + legmegbízhatóbb a szegmensben.
        const cheapest = bestBy(members, (m) => m.costPerKm);
        const reliable = bestBy(members, (m) => m.reliabilityPer100k);
        if (cheapest) {
          ranked
            .find((r) => r.vehicleId === cheapest)
            ?.badges.push(RankingBadge.LOWEST_COST_KM);
        }
        if (reliable) {
          ranked
            .find((r) => r.vehicleId === reliable)
            ?.badges.push(RankingBadge.MOST_RELIABLE);
        }
      }

      result.push({ key, vehicles: ranked });
    }

    // Stabil sorrend: nagyobb csoport elöl, majd kulcs szerint.
    result.sort((a, b) => b.vehicles.length - a.vehicles.length || a.key.localeCompare(b.key));
    return result;
  }
}

/** A legkisebb (nem null) metrikájú jármű azonosítója, vagy null. */
function bestBy(
  members: VehicleMetrics[],
  pick: (m: VehicleMetrics) => number | null,
): string | null {
  let bestId: string | null = null;
  let bestVal = Number.POSITIVE_INFINITY;
  for (const m of members) {
    const v = pick(m);
    if (v != null && v < bestVal) {
      bestVal = v;
      bestId = m.vehicleId;
    }
  }
  return bestId;
}

/** Megjelenítési címke: rendszám · márka modell (évjárat). */
function vehicleLabel(v: {
  id: string;
  plate: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
}): string {
  const name = [v.make, v.model, v.year].filter(Boolean).join(' ');
  if (v.plate) return name ? `${v.plate} · ${name}` : v.plate;
  return name || v.id.slice(0, 8);
}
