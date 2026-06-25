import { ALL_FEATURE_KEYS, FeatureKey } from './feature-flags';

/**
 * Előfizetési csomagok (3 sáv): Start · Pro · Fleet.
 * (Korábban 4 sáv volt; az átállás a `START`/`PRO`/`FLEET` enumra a DB-ben is
 * migrációval történt.)
 */
export const PlanTier = {
  START: 'START',
  PRO: 'PRO',
  FLEET: 'FLEET',
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
  // „Start" – 49 RON/hó · kisebb flottáknak, az első lépésekhez.
  [PlanTier.START]: {
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
  // „Pro" (Legnépszerűbb) – 129 RON/hó · riport, export, emlékeztető, komplex szerviz.
  [PlanTier.PRO]: {
    maxVehicles: 15,
    maxUsers: 10,
    maxStorageBytes: 5 * GB,
    maxDocumentsPerMonth: 400,
    features: ALL_FEATURE_KEYS,
  },
  // „Fleet" – 299 RON/hó · teljes flotta-intelligencia, korlátlan használat.
  [PlanTier.FLEET]: {
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
 */
export const PLAN_CURRENCY = 'RON';

export const PLAN_PRICES: Record<PlanTier, number> = {
  [PlanTier.START]: 49,
  [PlanTier.PRO]: 129,
  [PlanTier.FLEET]: 299,
};

/**
 * Számlázási ciklus. Éves előfizetésnél 12 hónap helyett csak `ANNUAL_MONTHS_CHARGED`
 * (= 11) havidíjat számlázunk → 1 hónap ingyen, minden csomagnál.
 */
export const BillingInterval = {
  MONTHLY: 'MONTHLY',
  YEARLY: 'YEARLY',
} as const;

export type BillingInterval =
  (typeof BillingInterval)[keyof typeof BillingInterval];

/** Éves előfizetésnél felszámolt havidíjak száma (12 helyett). */
export const ANNUAL_MONTHS_CHARGED = 11;

/** A csomag fizetendő összege a választott ciklusra (havi díj vagy 11×havi díj). */
export function planPrice(
  tier: PlanTier,
  interval: BillingInterval = BillingInterval.MONTHLY,
): number {
  const monthly = PLAN_PRICES[tier];
  return interval === BillingInterval.YEARLY
    ? monthly * ANNUAL_MONTHS_CHARGED
    : monthly;
}

/** Az éves előfizetés teljes díja (11×havi díj). */
export function annualPrice(tier: PlanTier): number {
  return PLAN_PRICES[tier] * ANNUAL_MONTHS_CHARGED;
}

/** Éves fizetésnél megtakarított összeg (1 havi díj). */
export function annualSavings(tier: PlanTier): number {
  return PLAN_PRICES[tier] * (12 - ANNUAL_MONTHS_CHARGED);
}

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

/** A választható extra-tárhely GB-értékek (a STORAGE_ADDONS-ból). */
export const STORAGE_ADDON_GB_OPTIONS: readonly number[] = STORAGE_ADDONS.map(
  (a) => a.extraGB,
);

/** Igaz, ha a megadott GB egy érvényes (megvásárolható) extra-tárhely opció. */
export function isValidStorageAddonGB(gb: number): boolean {
  return STORAGE_ADDON_GB_OPTIONS.includes(gb);
}

/** Az adott extra-tárhely opció havi díja, vagy null, ha nem érvényes opció. */
export function storageAddonPrice(gb: number): number | null {
  return STORAGE_ADDONS.find((a) => a.extraGB === gb)?.pricePerMonth ?? null;
}

/**
 * A cég tényleges tárhely-kerete: a csomag alap-kerete + a megvásárolt extra
 * tárhely (GB → byte). A `FLEET` alap-kerete véges (15 GB), így az extra tárhely
 * minden csomagra értelmezett.
 */
export function effectiveStorageBytes(
  tier: PlanTier,
  extraStorageGB: number = 0,
): number {
  return PLAN_LIMITS[tier].maxStorageBytes + Math.max(0, extraStorageGB) * GB;
}

/** A próbaidőszak hossza napokban (a regisztráció ennyit ad ingyen). */
export const TRIAL_DAYS = 14;
