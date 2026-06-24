/**
 * Nagy alkatrész események – a flotta „nagy munkái" (nem a kopóalkatrészek).
 *
 * Egy esemény akkor keletkezik, amikor egy drága fődarab cserélődik vagy
 * felújítják (turbó, motorfelújítás, befecskendezés, kuplung, kardán,
 * sebességváltó-felújítás stb.). A felhasználó több apró számlatételt EGY nagy
 * eseménnyé fűzhet („felújítás-összerakás": pl. 10 fogaskerék + 10 gyűrű →
 * sebességváltó-felújítás). Ezekből épül a jármű nagy-alkatrész idővonala, és
 * (Fázis D) a tanuló tartósság-felmérés.
 */

/** Egy fődarab típusa. Bővíthető. */
export const MajorComponent = {
  /** Turbófeltöltő. */
  TURBO: 'turbo',
  /** Motorfelújítás / motorcsere. */
  ENGINE_OVERHAUL: 'engine_overhaul',
  /** Befecskendezés (adagoló / injektorok / common rail). */
  INJECTION: 'injection',
  /** Kuplung / nyomaték-átvitel. */
  CLUTCH: 'clutch',
  /** Kardán / kardántengely. */
  DRIVESHAFT: 'driveshaft',
  /** Sebességváltó-felújítás / -csere. */
  GEARBOX_OVERHAUL: 'gearbox_overhaul',
  /** Differenciálmű / híd. */
  DIFFERENTIAL: 'differential',
  /** DPF / EGR / kipufogó utánkezelés. */
  DPF_EGR: 'dpf_egr',
  /** Sűrített levegős rendszer / kompresszor. */
  AIR_COMPRESSOR: 'air_compressor',
  /** Kormánymű / kormányszervó. */
  STEERING: 'steering',
  /** Hűtőrendszer (vízpumpa, hűtő, intercooler). */
  COOLING: 'cooling',
  /** Egyéb nagy alkatrész. */
  OTHER: 'other',
} as const;

export type MajorComponent =
  (typeof MajorComponent)[keyof typeof MajorComponent];

/** Stabil sorrend a megjelenítéshez (idővonal, választók, felmérés). */
export const ALL_MAJOR_COMPONENTS: readonly MajorComponent[] = [
  MajorComponent.TURBO,
  MajorComponent.ENGINE_OVERHAUL,
  MajorComponent.INJECTION,
  MajorComponent.CLUTCH,
  MajorComponent.DRIVESHAFT,
  MajorComponent.GEARBOX_OVERHAUL,
  MajorComponent.DIFFERENTIAL,
  MajorComponent.DPF_EGR,
  MajorComponent.AIR_COMPRESSOR,
  MajorComponent.STEERING,
  MajorComponent.COOLING,
  MajorComponent.OTHER,
] as const;

/** Igaz, ha az érték érvényes fődarab-azonosító. */
export function isMajorComponent(
  value: string | null | undefined,
): value is MajorComponent {
  return (
    value != null && (ALL_MAJOR_COMPONENTS as readonly string[]).includes(value)
  );
}

/**
 * Kulcsszó-alapú tipp: egy tételnévből vagy partType-ból melyik fődarab lehet.
 * Csak JAVASLAT a UI-nak (a felhasználó dönt); null, ha nincs egyértelmű találat.
 * hu/ro/en/de kulcsszavak.
 */
export function guessMajorComponent(text: string): MajorComponent | null {
  const s = text.toLowerCase();
  if (/turb[oó]/.test(s)) return MajorComponent.TURBO;
  if (/injec|befecsk|adagol|common ?rail|injektor|porlaszt/.test(s)) {
    return MajorComponent.INJECTION;
  }
  if (/kuplung|cuplaj|ambreiaj|clutch|kupplung/.test(s)) {
    return MajorComponent.CLUTCH;
  }
  if (/kardán|kardan|cardan|driveshaft|propeller ?shaft/.test(s)) {
    return MajorComponent.DRIVESHAFT;
  }
  if (/sebess[eé]gv[aá]lt|vált[oó]m|gearbox|cutie ?de ?viteze|getriebe/.test(s)) {
    return MajorComponent.GEARBOX_OVERHAUL;
  }
  if (/differ|diferen|h[ií]dm|axle|differenzial/.test(s)) {
    return MajorComponent.DIFFERENTIAL;
  }
  if (/\bdpf\b|\begr\b|particle|partikel|adblue|scr\b/.test(s)) {
    return MajorComponent.DPF_EGR;
  }
  if (/kompressz|compresor|compressor|l[eé]gsz[aá]r/.test(s)) {
    return MajorComponent.AIR_COMPRESSOR;
  }
  if (/kormány|directie|direcție|steering|lenkung/.test(s)) {
    return MajorComponent.STEERING;
  }
  if (/h[uű]t[oő]|v[ií]zpumpa|radiator|intercooler|k[uü]hl/.test(s)) {
    return MajorComponent.COOLING;
  }
  if (/motorfel[uú]j|motorcsere|engine ?overhaul|motor ?revizie|generál/.test(s)) {
    return MajorComponent.ENGINE_OVERHAUL;
  }
  return null;
}

/** Egy nagy-alkatrész esemény jellege. */
export const MajorEventKind = {
  /** Csere (új vagy gyári felújított alkatrész). */
  REPLACEMENT: 'replacement',
  /** Felújítás (a meglévő alkatrész javítása több tételből). */
  REFURBISHMENT: 'refurbishment',
} as const;

export type MajorEventKind =
  (typeof MajorEventKind)[keyof typeof MajorEventKind];
