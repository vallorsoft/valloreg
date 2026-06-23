import { PartType, ReminderType } from '@valloreg/shared';

/**
 * Tétel → jármű JAVASLAT logika (tiszta, Nest/Prisma-mentes függvények, hogy
 * egységtesztelhetők legyenek).
 *
 * Az ötlet: egy alkatrész-tételhez (pl. fékpofa) megnézzük, MELY járművekre
 * lett már felrakva UGYANAZ az alkatrész (cikkszám alapján, kód nélkül a
 * típus+név alapján). A jelöltek közül azt javasoljuk, amelyiken a LEGRÉGEBBEN
 * cserélték – mert ott a legesedékesebb. Amelyiken nemrég (a küszöb alatt)
 * cserélték, az kiesik (egy kopó-alkatrészt nem cserélünk újra pár hét múlva).
 * Plusz jel: ha a járműre van illő, esedékes karbantartási emlékeztető, az
 * megerősíti a javaslatot.
 */

/**
 * "Frissen cserélve" küszöb napokban: ennél rövidebb ideje cserélt jelölt NEM
 * lehet javaslat (a felhozott példában a 3 hete cserélt jármű kiesik).
 */
export const MIN_PLAUSIBLE_DAYS = 45;

/**
 * Alkatrész-típus → a hozzá tartozó karbantartási emlékeztető típusa. Csak a
 * másodlagos "esedékes emlékeztető" jelhez használjuk (pl. olajcsere).
 */
export const REMINDER_TYPE_BY_PART: Partial<Record<PartType, ReminderType>> = {
  [PartType.BRAKES]: ReminderType.BRAKE_SERVICE,
  [PartType.TIRES]: ReminderType.TIRE_CHANGE,
  [PartType.FLUIDS]: ReminderType.OIL_CHANGE,
  [PartType.FILTERS]: ReminderType.OIL_CHANGE,
  [PartType.ENGINE]: ReminderType.GENERAL_SERVICE,
};

/** Egy jármű csere-előzménye egy adott alkatrész-kulcsra. */
export interface PartHistoryEntry {
  vehicleId: string;
  /** Az adott járművön az alkatrész utolsó cseréjének ideje. */
  lastReplacedAt: Date;
  /** Km-óra állása az utolsó csere számláján (ha ismert). */
  lastReplacedKm: number | null;
  /** Hányszor cserélték eddig (a több korábbi csere erősebb jel). */
  timesReplaced: number;
}

/** Egy rangsorolt jelölt jármű. */
export interface RankedCandidate {
  vehicleId: string;
  /** Eltelt napok az utolsó csere óta (a számla dátumához viszonyítva). */
  elapsedDays: number;
  /** Eltelt km az utolsó csere óta (ha mindkét km ismert), különben null. */
  elapsedKm: number | null;
  /** Igaz, ha a küszöb alatt cserélték (frissen) → nem javasolható. */
  recentlyReplaced: boolean;
  /** Igaz, ha a járműre van illő, esedékes karbantartási emlékeztető. */
  dueReminder: boolean;
}

/** A végső jármű-javaslat egy tételhez. */
export interface VehicleSuggestion {
  vehicleId: string;
  confidence: number;
  reason: string;
}

/**
 * Alkatrész-identitás ("partKey") képzése. Elsődlegesen a cikkszámból (a
 * legpontosabb), különben a típus + normalizált név alapján. `null`, ha
 * egyikből sem képezhető megbízható kulcs.
 */
export function normalizePartKey(
  articleNumber: string | null | undefined,
  partType: string | null | undefined,
  name: string | null | undefined,
): string | null {
  const art = (articleNumber ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  // A túl rövid "cikkszám" (1–2 karakter) zajos; ilyenkor a név-alapra esünk.
  if (art.length >= 3) return `art:${art}`;

  const pt = (partType ?? '').toLowerCase().trim();
  const nm = (name ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
  if (!nm) return null;
  return `pt:${pt || 'other'}:${nm}`;
}

/**
 * Jelöltek rangsorolása az utolsó csere óta eltelt idő szerint (csökkenő:
 * a legrégebben cserélt elöl). A küszöb alatti ("frissen cserélt") jelölteket
 * megjelöli, de nem dobja el – a választás a `pickSuggestion` dolga.
 */
export function rankCandidatesByRecency(
  history: PartHistoryEntry[],
  asOfDate: Date,
  asOfKm: number | null,
  minPlausibleDays: number = MIN_PLAUSIBLE_DAYS,
): RankedCandidate[] {
  const dayMs = 86_400_000;
  return history
    .map((h) => {
      const elapsedDays = Math.floor((asOfDate.getTime() - h.lastReplacedAt.getTime()) / dayMs);
      const elapsedKm =
        asOfKm != null && h.lastReplacedKm != null ? asOfKm - h.lastReplacedKm : null;
      return {
        vehicleId: h.vehicleId,
        elapsedDays,
        elapsedKm,
        recentlyReplaced: elapsedDays < minPlausibleDays,
        dueReminder: false,
      };
    })
    .sort((a, b) => b.elapsedDays - a.elapsedDays);
}

/**
 * A legjobb javaslat kiválasztása a rangsorolt jelöltekből.
 *
 *  - A frissen cserélt jelöltek kiesnek (kivéve, ha MIND friss → nincs javaslat).
 *  - A megbízhatóság a legrégebbi és a második jelölt közötti szeparációból jön
 *    (minél egyértelműbb, hogy egy jármű "lóg ki", annál magasabb).
 *  - Esedékes karbantartási emlékeztető a legjobb jelöltön növeli a confidence-t.
 */
export function pickSuggestion(ranked: RankedCandidate[]): VehicleSuggestion | null {
  const eligible = ranked.filter((c) => !c.recentlyReplaced);
  const best = eligible[0];
  if (!best) return null;
  const second = eligible[1];

  let confidence: number;
  if (!second) {
    confidence = 0.6;
  } else if (best.elapsedDays >= second.elapsedDays * 1.5) {
    confidence = 0.7;
  } else {
    confidence = 0.4;
  }
  if (best.dueReminder) confidence = Math.min(0.9, confidence + 0.15);
  confidence = Math.round(confidence * 100) / 100;

  let reason = `Ezt az alkatrészt ezen a járművön cserélték a legrégebben (${formatElapsedHu(
    best.elapsedDays,
  )})`;
  reason += second ? ', a többi jelöltnél frissebben.' : '.';
  if (best.dueReminder) {
    reason += ' Esedékes karbantartási emlékeztető is van rá.';
  }

  return { vehicleId: best.vehicleId, confidence, reason };
}

/** Eltelt napok ember-olvasható magyar formázása (a javaslat indoklásához). */
export function formatElapsedHu(days: number): string {
  if (days >= 365) {
    const years = Math.floor(days / 365);
    const months = Math.round((days % 365) / 30);
    return months > 0 ? `kb. ${years} év ${months} hónapja` : `kb. ${years} éve`;
  }
  if (days >= 60) return `kb. ${Math.round(days / 30)} hónapja`;
  if (days >= 14) return `kb. ${Math.round(days / 7)} hete`;
  if (days >= 1) return `${days} napja`;
  return 'a napokban';
}
