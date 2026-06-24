/**
 * Nagy alkatrész tartósság – seed alapértékek + tanuló (empirikus) felmérés.
 *
 * Cél: megmondani egy fődarabról, hogy „jó-e még" vagy esedékes a csere. A
 * rendszer KÉT forrásból dolgozik:
 *  1) seed (kurált) várható élettartam – hogy az első naptól legyen mihez mérni,
 *  2) empirikus medián – ahogy gyűlnek a valós cserék, a rendszer MEGTANULJA,
 *     a flotta hány km-nél cseréli ténylegesen az adott fődarabot, és átvált a
 *     tanult értékre (ha elég a minta). Ez a `durability` szolgáltatás logikája.
 *
 * Minden érték nehéz-tehergépjárműre kalibrált nagyságrend (km); a valós,
 * márka/modell-specifikus értéket az empirikus felmérés finomítja.
 */

import { MajorComponent } from './major-components';

/** Seed (kurált) várható élettartam km-ben, fődarabonként. */
export const MAJOR_COMPONENT_LIFETIME_KM: Record<MajorComponent, number> = {
  [MajorComponent.TURBO]: 400_000,
  [MajorComponent.ENGINE_OVERHAUL]: 900_000,
  [MajorComponent.INJECTION]: 350_000,
  [MajorComponent.CLUTCH]: 500_000,
  [MajorComponent.DRIVESHAFT]: 600_000,
  [MajorComponent.GEARBOX_OVERHAUL]: 800_000,
  [MajorComponent.DIFFERENTIAL]: 700_000,
  [MajorComponent.DPF_EGR]: 400_000,
  [MajorComponent.AIR_COMPRESSOR]: 450_000,
  [MajorComponent.STEERING]: 600_000,
  [MajorComponent.COOLING]: 300_000,
  [MajorComponent.OTHER]: 400_000,
};

/**
 * Empirikus felméréshez ennyi VALÓS minta (csere-intervallum) kell, hogy a
 * tanult mediánra váltsunk a seed helyett.
 */
export const DURABILITY_MIN_SAMPLES = 3;

/** Egy fődarab állapota a megtett km / várható élettartam arány alapján. */
export const DurabilityStatus = {
  OK: 'ok',
  WATCH: 'watch',
  DUE: 'due',
  OVERDUE: 'overdue',
} as const;

export type DurabilityStatus =
  (typeof DurabilityStatus)[keyof typeof DurabilityStatus];

/** A „figyelni" sáv alsó határa (a várható élettartam aránya). */
export const DURABILITY_WATCH_RATIO = 0.8;
/** Az „esedékes" sáv (csere ajánlott). */
export const DURABILITY_DUE_RATIO = 1.0;
/** A „lejárt" sáv (jóval túl a vártnál). */
export const DURABILITY_OVERDUE_RATIO = 1.2;

/**
 * A megtett km és a várható élettartam arányából státusz.
 * `kmSince`: a legutóbbi csere óta megtett km; `expectedKm`: a várható élettartam.
 */
export function durabilityStatusOf(
  kmSince: number,
  expectedKm: number,
): DurabilityStatus {
  if (expectedKm <= 0) return DurabilityStatus.OK;
  const ratio = kmSince / expectedKm;
  if (ratio >= DURABILITY_OVERDUE_RATIO) return DurabilityStatus.OVERDUE;
  if (ratio >= DURABILITY_DUE_RATIO) return DurabilityStatus.DUE;
  if (ratio >= DURABILITY_WATCH_RATIO) return DurabilityStatus.WATCH;
  return DurabilityStatus.OK;
}

/** Egy szám-tömb mediánja (üresnél null). */
export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/** Egy fődarab tartósság-felmérése a flottából (per komponens). */
export interface DurabilitySurveyRow {
  component: MajorComponent;
  /** A használt várható élettartam km-ben (empirikus vagy seed). */
  expectedKm: number;
  /** A forrás: tanult (empirikus) vagy kurált (seed). */
  source: 'empirical' | 'seed';
  /** Hány valós csere-intervallumból tanult (0 = csak seed). */
  sampleCount: number;
  /** A seed alapérték (összevetéshez). */
  seedKm: number;
}

/** Egy jármű egy fődarabjának előrejelzése (csere-esedékesség + becsült költség). */
export interface VehicleComponentForecast {
  component: MajorComponent;
  /** A legutóbbi csere odométer-állása (vagy null). */
  lastEventKm: number | null;
  /** A legutóbbi csere óta megtett km (vagy null, ha nincs elég adat). */
  kmSince: number | null;
  expectedKm: number;
  source: 'empirical' | 'seed';
  status: DurabilityStatus;
  /** Becsült következő esedékesség odométer-állása (vagy null). */
  estimatedNextDueKm: number | null;
  /** Becsült költség a fődarabra (alkatrész + munkadíj medián), vagy null. */
  estimatedCost: string | null;
  currency: string | null;
}
