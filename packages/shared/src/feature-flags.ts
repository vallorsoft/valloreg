/**
 * Feature flag kulcsok – cégenként engedélyezhető/tiltható funkciók.
 * A Super Admin (Fázis 4) ezeket kapcsolgatja; a csomag is adhat alapértelmezést.
 */
export const FeatureKey = {
  OCR: 'OCR',
  AI_PROCESSING: 'AI_PROCESSING',
  DASHBOARD: 'DASHBOARD',
  REPORTS: 'REPORTS',
  API: 'API',
  EXPORT: 'EXPORT',
  REMINDERS: 'REMINDERS',
  DOCUMENT_LIBRARY: 'DOCUMENT_LIBRARY',
  /**
   * Prémium flotta-analitika (Fleet csomag): Insights (anomáliák/TCO/benchmark),
   * tanuló tartósság-felmérés + előrejelzés, ranglista + jelvények + csere-
   * tanácsadó, beszállító-minőség. A nagy alkatrész ESEMÉNYEK (rögzítés/idővonal)
   * a REPORTS-hoz tartoznak (Pro), az ezekből számított ANALITIKA viszont ide.
   */
  ANALYTICS: 'ANALYTICS',
} as const;

export type FeatureKey = (typeof FeatureKey)[keyof typeof FeatureKey];

export const ALL_FEATURE_KEYS: readonly FeatureKey[] = Object.values(FeatureKey);
