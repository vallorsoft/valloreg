/**
 * Flotta-szegmensek – a forgalmiból levezetett jármű-kategóriák.
 *
 * A szegmens a riportok, a ranglista és a benchmark szektor-bontásának alapja.
 * A levezetés TISZTÁN a meglévő forgalmi-mezőkből történik (EU "J" kategória,
 * D.2 típus, F.1 megengedett legnagyobb tömeg) – ezért nincs hozzá migráció,
 * és a meglévő járművek azonnal besorolódnak. Ahol a forgalmi adat hiányos vagy
 * az automatikus besorolás téved, a `Vehicle.fleetSegment` mezővel kézzel
 * felülírható (a `fleetSegmentOf` az override-ot tiszteletben tartja).
 */

/** Egy flotta-szegmens. A `truck_*` sávok megengedett legnagyobb tömeg szerint. */
export const FleetSegment = {
  /** Kishaszonjármű / furgon (≤ 7,5 t, jellemzően N1). */
  VAN: 'van',
  /** Közepes tehergépjármű (7,5–18 t, N2). */
  TRUCK_7_5_18: 'truck_7_5_18',
  /** Nehéz tehergépjármű / nyergesvontató (≥ 18 t, N3). */
  TRUCK_18_PLUS: 'truck_18_plus',
  /** Félpótkocsi (nyerges, O3/O4) – első tengely nélkül, a vontatóra támaszkodik. */
  SEMI_TRAILER: 'semi_trailer',
  /** Pótkocsi (vontatott, O1–O4). */
  TRAILER: 'trailer',
  /** Nem besorolható / hiányos forgalmi adat. */
  OTHER: 'other',
} as const;

export type FleetSegment = (typeof FleetSegment)[keyof typeof FleetSegment];

/** Stabil sorrend a megjelenítéshez (UI listák, ranglista-fülek). */
export const ALL_FLEET_SEGMENTS: readonly FleetSegment[] = [
  FleetSegment.VAN,
  FleetSegment.TRUCK_7_5_18,
  FleetSegment.TRUCK_18_PLUS,
  FleetSegment.SEMI_TRAILER,
  FleetSegment.TRAILER,
  FleetSegment.OTHER,
] as const;

/** Tömeg-sávhatárok (kg) a teher-szegmensekhez. */
export const VAN_MAX_KG = 7_500;
export const HEAVY_TRUCK_MIN_KG = 18_000;

/** A `fleetSegmentOf`-hoz szükséges forgalmi mezők (a Vehicle részhalmaza). */
export interface FleetSegmentInput {
  /** EU "J" jármű-kategória (M1, N1, N2, N3, O1–O4 …). */
  category?: string | null;
  /** D.2 típus/variáns/verzió – pótkocsi/félpótkocsi felismeréshez. */
  vehicleType?: string | null;
  /** F.1 megengedett legnagyobb tömeg (kg) – a teher-sávokhoz. */
  maxMassKg?: number | null;
  /** Kézi felülírás; ha érvényes szegmens, ez nyer a levezetés helyett. */
  fleetSegment?: string | null;
}

function isFleetSegment(value: string | null | undefined): value is FleetSegment {
  return (
    value != null &&
    (ALL_FLEET_SEGMENTS as readonly string[]).includes(value)
  );
}

/** Igaz, ha a szöveg félpótkocsira (nyerges) utal – hu/ro/de/en kulcsszavak. */
function looksLikeSemiTrailer(text: string): boolean {
  return /semi|sattel|nyerg|félpót|felpot|semiremorc/.test(text);
}

/** Igaz, ha a szöveg (bármilyen) pótkocsira utal – hu/ro/de/en kulcsszavak. */
function looksLikeTrailer(text: string): boolean {
  return /remorc|pótkocs|potkocs|anh[aä]nger|trailer|vontatm/.test(text);
}

/**
 * Egy jármű flotta-szegmensbe sorolása a forgalmi adataiból.
 *
 * Sorrend: (1) kézi override, ha érvényes; (2) pótkocsi-család az "O" kategória
 * vagy a D.2 típus alapján (félpótkocsi vs. pótkocsi); (3) teher-sávok a
 * megengedett legnagyobb tömeg szerint; (4) tömeg hiányában az "N" kategóriából;
 * (5) különben OTHER.
 */
export function fleetSegmentOf(vehicle: FleetSegmentInput): FleetSegment {
  if (isFleetSegment(vehicle.fleetSegment)) return vehicle.fleetSegment;

  const category = (vehicle.category ?? '').trim().toUpperCase();
  const typeText = `${vehicle.category ?? ''} ${vehicle.vehicleType ?? ''}`
    .trim()
    .toLowerCase();
  const mass = vehicle.maxMassKg ?? null;

  // (2) Pótkocsi-család: "O" kategória vagy a típusban pótkocsi-utalás.
  const isTrailerFamily = category.startsWith('O') || looksLikeTrailer(typeText);
  if (isTrailerFamily) {
    return looksLikeSemiTrailer(typeText)
      ? FleetSegment.SEMI_TRAILER
      : FleetSegment.TRAILER;
  }
  // Félpótkocsi a típusból akkor is, ha nincs "O" kategória.
  if (looksLikeSemiTrailer(typeText)) return FleetSegment.SEMI_TRAILER;

  // (3) Teher-sávok a megengedett legnagyobb tömeg szerint.
  if (mass != null && Number.isFinite(mass) && mass > 0) {
    if (mass < VAN_MAX_KG) return FleetSegment.VAN;
    if (mass < HEAVY_TRUCK_MIN_KG) return FleetSegment.TRUCK_7_5_18;
    return FleetSegment.TRUCK_18_PLUS;
  }

  // (4) Tömeg hiányában az EU "N" kategóriából.
  if (category.startsWith('N')) {
    if (category === 'N1') return FleetSegment.VAN;
    if (category === 'N2') return FleetSegment.TRUCK_7_5_18;
    if (category === 'N3') return FleetSegment.TRUCK_18_PLUS;
    return FleetSegment.VAN;
  }

  return FleetSegment.OTHER;
}
