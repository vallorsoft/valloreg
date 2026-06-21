/**
 * Tétel-besorolás és alkatrész-típusok az AI kategorizáláshoz (Fázis 2).
 */

/** Egy számlatétel mihez tartozik. */
export const ItemType = {
  /** Konkrét járműhöz rendelhető (alkatrész, javítás, munkadíj). */
  VEHICLE: 'vehicle',
  /** Szerszám / műhelyfelszerelés – nem jármű-specifikus. */
  TOOL: 'tool',
  /** Általános / flotta / irodai költség. */
  GENERAL: 'general',
} as const;

export type ItemType = (typeof ItemType)[keyof typeof ItemType];

/** Részletesebb költség-kategóriák (riportokhoz, dashboardhoz). */
export const ItemCategory = {
  PART: 'part',
  LABOR: 'labor',
  SERVICE: 'service',
  CONSUMABLE: 'consumable',
  TOOL: 'tool',
  WORKSHOP_EQUIPMENT: 'workshop_equipment',
  OFFICE: 'office',
  FLEET_GENERAL: 'fleet_general',
  OTHER: 'other',
} as const;

export type ItemCategory = (typeof ItemCategory)[keyof typeof ItemCategory];

/** Alkatrész-típus felismerés (pl. fék, motor, szűrő). Bővíthető. */
export const PartType = {
  BRAKES: 'brakes',
  ENGINE: 'engine',
  FILTERS: 'filters',
  TIRES: 'tires',
  SUSPENSION: 'suspension',
  ELECTRICAL: 'electrical',
  TRANSMISSION: 'transmission',
  BODY: 'body',
  FLUIDS: 'fluids',
  OTHER: 'other',
} as const;

export type PartType = (typeof PartType)[keyof typeof PartType];
