/**
 * Emlékeztetők (proaktív karbantartás + megfelelőség/lejárat figyelés).
 *
 * Az "Automation Layer" magja: a rendszer nem csak tárolja a szerviztörténetet,
 * hanem proaktívan jelez a közelgő karbantartásokról (idő- és km-alapon) és a
 * lejáró határidőkről (műszaki, biztosítás, tachográf, matrica…).
 *
 * A `kind`/`type`/`status` String-ként tárolódik (mint az ItemType/PartType),
 * hogy a Prisma séma a shared string-union típusokat tükrözze.
 */

/** Egy emlékeztető fő fajtája. */
export const ReminderKind = {
  /** Idő-/km-alapú karbantartás (olajcsere, vezérlés, fék…). */
  MAINTENANCE: 'maintenance',
  /** Lejáró határidő / megfelelőség (műszaki, biztosítás, tachográf…). */
  COMPLIANCE: 'compliance',
} as const;

export type ReminderKind = (typeof ReminderKind)[keyof typeof ReminderKind];

/** Részletes emlékeztető-típus (UI ikon/címke + tanuló javaslatok alapja). */
export const ReminderType = {
  // Karbantartás
  OIL_CHANGE: 'oil_change',
  TIMING_BELT: 'timing_belt',
  BRAKE_SERVICE: 'brake_service',
  TIRE_CHANGE: 'tire_change',
  GENERAL_SERVICE: 'general_service',
  // Megfelelőség / lejáratok
  INSPECTION: 'inspection', // műszaki vizsga
  INSURANCE: 'insurance', // kötelező / CASCO
  TACHOGRAPH: 'tachograph', // tachográf kalibrálás
  VIGNETTE: 'vignette', // autópálya matrica
  OTHER: 'other',
} as const;

export type ReminderType = (typeof ReminderType)[keyof typeof ReminderType];

/** A `type` → alapértelmezett `kind` besorolás (UI és validáció segédje). */
export const REMINDER_KIND_BY_TYPE: Record<ReminderType, ReminderKind> = {
  [ReminderType.OIL_CHANGE]: ReminderKind.MAINTENANCE,
  [ReminderType.TIMING_BELT]: ReminderKind.MAINTENANCE,
  [ReminderType.BRAKE_SERVICE]: ReminderKind.MAINTENANCE,
  [ReminderType.TIRE_CHANGE]: ReminderKind.MAINTENANCE,
  [ReminderType.GENERAL_SERVICE]: ReminderKind.MAINTENANCE,
  [ReminderType.INSPECTION]: ReminderKind.COMPLIANCE,
  [ReminderType.INSURANCE]: ReminderKind.COMPLIANCE,
  [ReminderType.TACHOGRAPH]: ReminderKind.COMPLIANCE,
  [ReminderType.VIGNETTE]: ReminderKind.COMPLIANCE,
  [ReminderType.OTHER]: ReminderKind.COMPLIANCE,
};

/** Egy emlékeztető számított állapota (sürgősség). */
export const ReminderStatus = {
  /** Még ráér. */
  OK: 'ok',
  /** Hamarosan esedékes (a küszöbön belül). */
  DUE_SOON: 'due_soon',
  /** Lejárt / túlhaladott. */
  OVERDUE: 'overdue',
} as const;

export type ReminderStatus = (typeof ReminderStatus)[keyof typeof ReminderStatus];

/** Alapértelmezett "hamarosan esedékes" küszöbök. */
export const REMINDER_DUE_SOON_DAYS = 30;
export const REMINDER_DUE_SOON_KM = 1500;

/** Lejárt emlékeztető újra-értesítési periódusa (nap), hogy ne spammeljen. */
export const REMINDER_OVERDUE_RENOTIFY_DAYS = 7;

export const ALL_REMINDER_TYPES: readonly ReminderType[] =
  Object.values(ReminderType);
