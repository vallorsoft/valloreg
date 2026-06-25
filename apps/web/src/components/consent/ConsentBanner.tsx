'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';
import {
  CONSENT_VERSION,
  readConsent,
  writeConsent,
} from './consent';

/**
 * Bară de consimțământ cookie / stocare locală (afișată o singură dată, până la
 * alegere). Conform GDPR + Directivei ePrivacy + Legii 506/2004:
 *   - categoriile non-esențiale sunt IMPLICIT dezactivate (fără bife prealabile);
 *   - respingerea este la fel de simplă ca acceptarea ("Doar necesare");
 *   - alegerea este înregistrată cu versiune + marcaj temporal (dovada);
 *   - poate fi redeschisă oricând (vezi `openConsentSettings`).
 *
 * Onestitate tehnică: platforma NU folosește analytics/marketing/urmărire terță,
 * deci bara NU pretinde astfel de categorii. Singura categorie opțională este
 * „funcțional” (notificări push), activată ulterior prin permisiunea browserului.
 */
export function ConsentBanner() {
  const t = useTranslations('consent');
  const [open, setOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [functional, setFunctional] = useState(false);

  useEffect(() => {
    if (readConsent() === null) setOpen(true);
    const reopen = () => {
      const current = readConsent();
      setFunctional(current?.functional ?? false);
      setShowSettings(true);
      setOpen(true);
    };
    window.addEventListener('valloreg:open-consent', reopen);
    return () => window.removeEventListener('valloreg:open-consent', reopen);
  }, []);

  function decide(functionalChoice: boolean) {
    writeConsent(functionalChoice);
    setOpen(false);
    setShowSettings(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="false"
      aria-label={t('title')}
      className="fixed inset-x-0 bottom-0 z-50 border-t border-anthracite-200 bg-white shadow-[0_-4px_24px_rgba(0,0,0,0.08)]"
    >
      <div className="container-page flex flex-col gap-4 py-5">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-anthracite-900">
            {t('title')}
          </p>
          <p className="max-w-3xl text-sm text-anthracite-600">
            {t('description')}{' '}
            <Link
              href="/legal/cookies"
              className="font-medium text-primary-700 underline hover:text-primary-800"
            >
              {t('cookiePolicy')}
            </Link>{' '}
            ·{' '}
            <Link
              href="/legal/privacy"
              className="font-medium text-primary-700 underline hover:text-primary-800"
            >
              {t('privacyPolicy')}
            </Link>
          </p>
        </div>

        {showSettings && (
          <div className="space-y-3 rounded-xl border border-anthracite-100 bg-anthracite-50/60 p-4">
            <label className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-sm font-medium text-anthracite-900">
                  {t('necessary.title')}
                </span>
                <span className="block text-sm text-anthracite-500">
                  {t('necessary.description')}
                </span>
              </span>
              <input
                type="checkbox"
                checked
                disabled
                aria-label={t('necessary.title')}
                className="mt-1 h-5 w-5 cursor-not-allowed accent-primary-600"
              />
            </label>

            <label className="flex items-start justify-between gap-4">
              <span>
                <span className="block text-sm font-medium text-anthracite-900">
                  {t('functional.title')}
                </span>
                <span className="block text-sm text-anthracite-500">
                  {t('functional.description')}
                </span>
              </span>
              <input
                type="checkbox"
                checked={functional}
                onChange={(e) => setFunctional(e.target.checked)}
                aria-label={t('functional.title')}
                className="mt-1 h-5 w-5 cursor-pointer accent-primary-600"
              />
            </label>
          </div>
        )}

        <div
          className={cn(
            'flex flex-col gap-2 sm:flex-row sm:items-center',
            'sm:justify-end',
          )}
        >
          {!showSettings && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowSettings(true)}
              className="sm:mr-auto"
            >
              {t('settings')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => decide(false)}
          >
            {t('rejectNonEssential')}
          </Button>
          {showSettings ? (
            <Button size="sm" onClick={() => decide(functional)}>
              {t('savePreferences')}
            </Button>
          ) : (
            <Button size="sm" onClick={() => decide(true)}>
              {t('acceptAll')}
            </Button>
          )}
        </div>

        <p className="text-xs text-anthracite-400">
          {t('versionNote', { version: CONSENT_VERSION })}
        </p>
      </div>
    </div>
  );
}

/** Redeschide bara de preferințe (ex. dintr-un link „Setări cookie" în footer). */
export function openConsentSettings(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('valloreg:open-consent'));
  }
}
