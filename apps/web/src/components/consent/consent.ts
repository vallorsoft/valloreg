'use client';

/**
 * Consimțământ cookie / stocare locală – utilitar partajat.
 *
 * Context tehnic (verificat în cod): platforma NU folosește cookie-uri de
 * analiză, publicitate sau urmărire terță. Folosește doar:
 *   - stocare strict necesară (token de sesiune în localStorage, service worker
 *     PWA, înregistrarea consimțământului);
 *   - notificări push opționale (funcțional), activate separat prin permisiunea
 *     explicită a browserului.
 *
 * Acest modul persistă alegerea utilizatorului cu versiune + marcaj temporal,
 * pentru a putea dovedi consimțământul (art. 7 GDPR) și a re-solicita alegerea
 * la modificarea politicii (bump CONSENT_VERSION).
 */

export const CONSENT_STORAGE_KEY = 'valloreg.consent';
/** Crește acest număr când se schimbă politica → utilizatorii sunt re-întrebați. */
export const CONSENT_VERSION = 1;

export interface ConsentValue {
  /** Întotdeauna true – stocarea strict necesară nu poate fi dezactivată. */
  necessary: true;
  /** Notificări push / funcțional (opt-in, implicit dezactivat). */
  functional: boolean;
  /** Versiunea politicii la momentul alegerii. */
  version: number;
  /** Marcaj temporal ISO al alegerii (dovada consimțământului). */
  decidedAt: string;
}

/** Citește alegerea stocată; null dacă lipsește sau versiunea e depășită. */
export function readConsent(): ConsentValue | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConsentValue;
    if (parsed.version !== CONSENT_VERSION) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Persistă alegerea (cu versiune + marcaj temporal). */
export function writeConsent(functional: boolean): ConsentValue {
  const value: ConsentValue = {
    necessary: true,
    functional,
    version: CONSENT_VERSION,
    decidedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, JSON.stringify(value));
  } catch {
    /* stocarea poate fi indisponibilă (mod privat) – ignorăm în siguranță */
  }
  return value;
}
