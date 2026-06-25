'use client';

// A cookie/consent-állapot olvasása (a ConsentBanner írja a localStorage-be).
// Egy forrás az igazságnak: a kulcs és az alak itt és a ConsentBannerben azonos.

export const CONSENT_STORAGE_KEY = 'valloreg.consent';

export interface ConsentState {
  v: number;
  necessary: true;
  functional: boolean;
  marketing: boolean;
  ts: string;
}

/** A tárolt hozzájárulás kiolvasása (vagy null, ha nincs / érvénytelen). */
export function getConsent(): ConsentState | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConsentState;
  } catch {
    return null;
  }
}

/** Igaz, ha a felhasználó hozzájárult a marketing/push kategóriához. */
export function hasMarketingConsent(): boolean {
  return getConsent()?.marketing === true;
}
