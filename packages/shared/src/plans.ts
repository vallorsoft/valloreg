import { ALL_FEATURE_KEYS, FeatureKey } from './feature-flags';

/** Előfizetési csomagok (a spec szerint). */
export const PlanTier = {
  STARTER: 'STARTER',
  STANDARD: 'STANDARD',
  PROFESSIONAL: 'PROFESSIONAL',
  BUSINESS: 'BUSINESS',
} as const;

export type PlanTier = (typeof PlanTier)[keyof typeof PlanTier];

/** `-1` = korlátlan. */
export const UNLIMITED = -1;

export interface PlanLimits {
  maxVehicles: number;
  maxUsers: number;
  maxStorageBytes: number;
  /** Havi feldolgozható dokumentumok száma. */
  maxDocumentsPerMonth: number;
  /** Alapból engedélyezett funkciók ezen a csomagon. */
  features: readonly FeatureKey[];
}

const GB = 1024 * 1024 * 1024;

// Megjelenített csomagok (3): Start (STARTER), Pro (PROFESSIONAL), Fleet (BUSINESS).
// A STANDARD megtartott LEGACY sáv (nem jelenik meg új regisztrációnál); a
// meglévő STANDARD előfizetők a Pro-val egyenértékű limitet kapnak. Az enum
// értéke a DB-ben megmarad (nincs migráció).
export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  // „Start" – 49 RON/hó
  [PlanTier.STARTER]: {
    maxVehicles: 3,
    maxUsers: 3,
    maxStorageBytes: 1 * GB,
    maxDocumentsPerMonth: 75,
    features: [
      FeatureKey.OCR,
      FeatureKey.AI_PROCESSING,
      FeatureKey.DASHBOARD,
      FeatureKey.DOCUMENT_LIBRARY,
    ],
  },
  // LEGACY (rejtett) – a „Pro" sávval egyenértékű.
  [PlanTier.STANDARD]: {
    maxVehicles: 15,
    maxUsers: 10,
    maxStorageBytes: 5 * GB,
    maxDocumentsPerMonth: 400,
    features: ALL_FEATURE_KEYS,
  },
  // „Pro" (Legnépszerűbb) – 129 RON/hó
  [PlanTier.PROFESSIONAL]: {
    maxVehicles: 15,
    maxUsers: 10,
    maxStorageBytes: 5 * GB,
    maxDocumentsPerMonth: 400,
    features: ALL_FEATURE_KEYS,
  },
  // „Fleet" – 299 RON/hó
  [PlanTier.BUSINESS]: {
    maxVehicles: UNLIMITED,
    maxUsers: UNLIMITED,
    maxStorageBytes: 15 * GB,
    maxDocumentsPerMonth: UNLIMITED,
    features: ALL_FEATURE_KEYS,
  },
};

/** Igaz, ha a megadott `current` érték még a `limit` alatt van (vagy a limit korlátlan). */
export function isWithinLimit(current: number, limit: number): boolean {
  if (limit === UNLIMITED) return true;
  return current < limit;
}

/**
 * Csomag-árak (havi) az utalásos előfizetéshez. A `PLAN_CURRENCY` a pénznem.
 * Megjelenített sávok: Start (49) · Pro (129) · Fleet (299). A STANDARD legacy
 * (rejtett), a Pro árával egyenértékű.
 */
export const PLAN_CURRENCY = 'RON';

export const PLAN_PRICES: Record<PlanTier, number> = {
  [PlanTier.STARTER]: 49, // „Start"
  [PlanTier.STANDARD]: 129, // legacy → „Pro"-val egyenértékű
  [PlanTier.PROFESSIONAL]: 129, // „Pro"
  [PlanTier.BUSINESS]: 299, // „Fleet"
};

/**
 * Vásárolható extra tárhely (havi díj, RON). A tárhely teljes kapacitás (nem
 * nullázódik havonta); bármely csomaghoz hozzávehető.
 */
export interface StorageAddon {
  /** Hozzáadott tárhely GB-ban. */
  extraGB: number;
  /** Havi díj a `PLAN_CURRENCY` pénznemben. */
  pricePerMonth: number;
}

export const STORAGE_ADDONS: readonly StorageAddon[] = [
  { extraGB: 5, pricePerMonth: 19 },
  { extraGB: 10, pricePerMonth: 29 },
  { extraGB: 25, pricePerMonth: 59 },
];

/** A próbaidőszak hossza napokban (a regisztráció ennyit ad ingyen). */
export const TRIAL_DAYS = 14;
