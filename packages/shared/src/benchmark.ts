/**
 * „Európai trendek" – anonimizált, aggregált flotta-benchmark.
 *
 * A platform több cég VALÓDI szervizköltség-adatát látja; ebből anonimizált,
 * aggregált piaci mediánt képzünk (márka-modell / tételkategória / km-sáv /
 * pénznem bontásban), és minden céget összevetünk vele. Egy cella CSAK akkor
 * publikus, ha eléri a k-anonimitási küszöböt – így egyetlen flotta sem
 * fejthető vissza. A számítás a SAJÁT adatból él: ingyenes, nincs külső fizetős API.
 */

/** Egy benchmark-cella csak akkor publikus, ha legalább ennyi KÜLÖNBÖZŐ cég adta. */
export const BENCHMARK_MIN_TENANTS = 5;
/** …és legalább ennyi különböző jármű. (k-anonimitás: nincs visszafejthető flotta.) */
export const BENCHMARK_MIN_VEHICLES = 20;

/** ±ennyi %-on belül „piacon"; felette „piac felett", alatta „piac alatt". */
export const BENCHMARK_WITHIN_PCT = 15;

/** km-sávok alsó határai. Az ismeretlen/hiányzó km a sentinel sávba kerül. */
export const KM_BUCKETS = [0, 50_000, 100_000, 150_000, 200_000] as const;
export const KM_BUCKET_UNKNOWN = -1;

/** Egy odométer-állás besorolása a megfelelő km-sáv alsó határára. */
export function kmBucketOf(odometerKm: number | null | undefined): number {
  if (odometerKm == null || !Number.isFinite(odometerKm) || odometerKm < 0) {
    return KM_BUCKET_UNKNOWN;
  }
  let bucket: number = KM_BUCKETS[0];
  for (const b of KM_BUCKETS) {
    if (odometerKm >= b) bucket = b;
  }
  return bucket;
}

/** A cég pozíciója a piaci mediánhoz képest. */
export const BenchmarkPosition = {
  BELOW: 'below',
  WITHIN: 'within',
  ABOVE: 'above',
} as const;

export type BenchmarkPosition =
  (typeof BenchmarkPosition)[keyof typeof BenchmarkPosition];

/** A `deltaPct` besorolása piaci pozícióvá. */
export function positionOf(deltaPct: number): BenchmarkPosition {
  if (deltaPct > BENCHMARK_WITHIN_PCT) return BenchmarkPosition.ABOVE;
  if (deltaPct < -BENCHMARK_WITHIN_PCT) return BenchmarkPosition.BELOW;
  return BenchmarkPosition.WITHIN;
}

/** Egy szegmens összevetése a cég saját mediánja és a piaci medián között. */
export interface BenchmarkComparison {
  /** Normalizált „márka modell" (megjelenítéshez nyersen tárolva). */
  makeModel: string;
  /** Tételkategória (alkatrésztípus, vagy normalizált tételnév). */
  itemCategory: string;
  /** A km-sáv alsó határa (vagy KM_BUCKET_UNKNOWN). */
  kmBucket: number;
  currency: string;
  /** A cég saját mediánja erre a szegmensre. */
  tenantMedian: string;
  /** A piaci (anonimizált) medián. */
  benchmarkMedian: string;
  /** Hány %-kal tér el a cég a piactól (+ = drágább). */
  deltaPct: number;
  position: BenchmarkPosition;
  sampleTenants: number;
  sampleVehicles: number;
}

/** Egy jármű-visszahívás (ingyenes forrásból: EU Safety Gate / kurált lista). */
export interface VehicleRecall {
  /** Forrás-hivatkozás / azonosító. */
  reference: string;
  makeModel: string;
  /** Érintett gyártási évek (vagy null). */
  yearFrom: number | null;
  yearTo: number | null;
  /** A veszély rövid leírása. */
  hazard: string;
  /** Javasolt teendő / javítás (ha van). */
  remedy: string | null;
  source: string;
  /** ISO dátum (YYYY-MM-DD) vagy null. */
  publishedAt: string | null;
}
