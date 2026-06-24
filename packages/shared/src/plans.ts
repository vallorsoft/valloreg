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

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
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
  [PlanTier.STANDARD]: {
    maxVehicles: 15,
    maxUsers: 10,
    maxStorageBytes: 5 * GB,
    maxDocumentsPerMonth: 400,
    features: [
      FeatureKey.OCR,
      FeatureKey.AI_PROCESSING,
      FeatureKey.DASHBOARD,
      FeatureKey.DOCUMENT_LIBRARY,
      FeatureKey.REPORTS,
      FeatureKey.EXPORT,
      FeatureKey.REMINDERS,
    ],
  },
  [PlanTier.PROFESSIONAL]: {
    maxVehicles: UNLIMITED,
    maxUsers: UNLIMITED,
    maxStorageBytes: 15 * GB,
    maxDocumentsPerMonth: UNLIMITED,
    features: ALL_FEATURE_KEYS,
  },
  [PlanTier.BUSINESS]: {
    maxVehicles: UNLIMITED,
    maxUsers: UNLIMITED,
    maxStorageBytes: 500 * GB,
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
 * Csomag-árak (havi, nettó) az utalásos előfizetéshez. A `PLAN_CURRENCY` a
 * pénznem. Ezek alapértelmezett értékek – az üzemeltető igazíthatja.
 */
export const PLAN_CURRENCY = 'RON';

// Havi nettó árak LEJ-ben (RON). Ajánlott alapértékek – az üzemeltető igazíthatja.
export const PLAN_PRICES: Record<PlanTier, number> = {
  [PlanTier.STARTER]: 49,
  [PlanTier.STANDARD]: 129,
  [PlanTier.PROFESSIONAL]: 299,
  [PlanTier.BUSINESS]: 399,
};

/**
 * Vásárolható extra tárhely-csomagok (havi add-on). A megvett GB hozzáadódik a
 * csomag tárhelyéhez (a tárhely TELJES kapacitás, nem havi reset). Az aktiválás
 * – mint a csomag – utalás után, a Super Admin panelen történik.
 */
export interface StoragePack {
  /** Plusz tárhely byte-ban. */
  bytes: number;
  /** Havi ár (PLAN_CURRENCY). */
  price: number;
}

export const STORAGE_PACKS: readonly StoragePack[] = [
  { bytes: 5 * GB, price: 19 },
  { bytes: 10 * GB, price: 29 },
  { bytes: 25 * GB, price: 59 },
] as const;

/** 1 GB byte-ban (a tárhely-számításokhoz). */
export const BYTES_PER_GB = GB;

/**
 * Effektív tárhely-keret: a csomag-tárhely + a vásárolt extra (GB). Korlátlan
 * csomag-tárhelynél korlátlan marad.
 */
export function effectiveStorageBytes(
  baseBytes: number,
  extraGb: number,
): number {
  if (baseBytes === UNLIMITED) return UNLIMITED;
  return baseBytes + Math.max(0, extraGb) * GB;
}

/** A próbaidőszak hossza napokban (a regisztráció ennyit ad ingyen). */
export const TRIAL_DAYS = 14;
