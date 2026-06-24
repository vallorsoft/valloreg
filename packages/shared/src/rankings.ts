/**
 * Jármű-ranglista – költséghatékonyság ÉS (ahol van bevétel) valós rentabilitás.
 *
 * A rendszer költséget lát; a „legrentábilisabb" jármű alapból a legjobb
 * költséghatékonyságú (alacsony költség/km + kevés nagy meghibásodás). Ahol a
 * felhasználó megad bevételt (jármű `revenuePerKm`), ott VALÓS nyereség/km is
 * megjelenik. A pontszám szegmensen belül normalizált (azonos kategóriák
 * versenyeznek), és márka/modellen belül is rangsorolható.
 */

/** Egy kiosztható jelvény. */
export const RankingBadge = {
  /** A szegmens legjobbja. */
  SEGMENT_CHAMPION: 'segment_champion',
  /** A márka/modell csoport legjobbja. */
  MODEL_CHAMPION: 'model_champion',
  /** A legalacsonyabb költség/km a szegmensben. */
  LOWEST_COST_KM: 'lowest_cost_km',
  /** A legkevesebb nagy meghibásodás (100e km-re vetítve). */
  MOST_RELIABLE: 'most_reliable',
} as const;

export type RankingBadge = (typeof RankingBadge)[keyof typeof RankingBadge];

/** A pontszám súlyai: költség/km vs. megbízhatóság. */
export const RANK_WEIGHT_COST = 0.6;
export const RANK_WEIGHT_RELIABILITY = 0.4;

/** Egy jármű ranglista-sora. */
export interface VehicleRanking {
  vehicleId: string;
  label: string;
  segment: string;
  /** Normalizált „márka modell" (csoportosításhoz/megjelenítéshez). */
  makeModel: string;
  currency: string | null;
  totalSpent: string;
  odometerKm: number | null;
  /** Költség/km (string, 2 tizedes), vagy null ha nincs km. */
  costPerKm: string | null;
  /** Bevétel/km, ha a felhasználó megadta (különben null). */
  revenuePerKm: string | null;
  /** Nyereség/km = bevétel/km − költség/km (csak ha van bevétel). */
  profitPerKm: string | null;
  /** Nagy alkatrész események száma. */
  majorEventCount: number;
  /** Esedékes/lejárt nagy alkatrészek száma (prediktív). */
  bigPartsDue: number;
  /** Gazdaságossági/megbízhatósági pontszám a szegmensben (0–100). */
  economyScore: number;
  /** „Cserére érdemes" jelzés (nagy részek esedékesek + költség/km a medián felett). */
  replaceAdvice: boolean;
  /** Kiosztott jelvények. */
  badges: RankingBadge[];
}

/** Egy szegmens (vagy márka/modell) ranglistája. */
export interface RankingGroup {
  /** A csoport kulcsa (szegmens-azonosító vagy „márka modell"). */
  key: string;
  vehicles: VehicleRanking[];
}

/** A teljes ranglista-válasz: szegmensenként és márka/modellenként. */
export interface RankingsResult {
  bySegment: RankingGroup[];
  byModel: RankingGroup[];
}

/**
 * Min–max normalizálás [0,1]-re, ahol az ALACSONYABB érték a jobb (0 = legjobb).
 * Egyforma vagy egyelemű halmaznál 0 (mindenki „legjobb").
 */
export function normalizeLowerBetter(
  value: number,
  min: number,
  max: number,
): number {
  if (max <= min) return 0;
  return (value - min) / (max - min);
}

/**
 * Gazdaságossági pontszám a normalizált költség/km és megbízhatóság-büntetésből.
 * Mindkettő [0,1], ahol 0 a legjobb; a pontszám 0–100, ahol 100 a legjobb.
 */
export function economyScoreFrom(
  normCost: number,
  normReliability: number,
): number {
  const score =
    100 *
    (RANK_WEIGHT_COST * (1 - normCost) +
      RANK_WEIGHT_RELIABILITY * (1 - normReliability));
  return Math.round(Math.max(0, Math.min(100, score)));
}
