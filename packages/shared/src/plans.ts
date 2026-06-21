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
    maxVehicles: 2,
    maxUsers: 3,
    maxStorageBytes: 2 * GB,
    maxDocumentsPerMonth: 50,
    features: [
      FeatureKey.OCR,
      FeatureKey.AI_PROCESSING,
      FeatureKey.DASHBOARD,
      FeatureKey.DOCUMENT_LIBRARY,
    ],
  },
  [PlanTier.STANDARD]: {
    maxVehicles: 5,
    maxUsers: 5,
    maxStorageBytes: 10 * GB,
    maxDocumentsPerMonth: 200,
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
    maxVehicles: 20,
    maxUsers: 20,
    maxStorageBytes: 50 * GB,
    maxDocumentsPerMonth: 1000,
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
