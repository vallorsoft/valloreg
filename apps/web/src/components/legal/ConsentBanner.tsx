'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';

// Panou de consimțământ (cookie/ePrivacy) afișat la prima vizită.
// Categorii: necesare (obligatorii, mereu active) + funcționale + marketing.
// Alegerea este memorată local (localStorage) cu versiune și marcă temporală.
// Conform GDPR/ePrivacy: respingerea trebuie să fie la fel de simplă ca acceptarea.

const STORAGE_KEY = 'valloreg.consent';
const CONSENT_VERSION = 1;

type Consent = {
  v: number;
  necessary: true;
  functional: boolean;
  marketing: boolean;
  ts: string;
};

export function ConsentBanner() {
  const t = useTranslations('consent');
  const [open, setOpen] = useState(false);
  const [showPrefs, setShowPrefs] = useState(false);
  const [functional, setFunctional] = useState(true);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        setOpen(true);
        return;
      }
      const parsed = JSON.parse(raw) as Partial<Consent>;
      if (parsed.v !== CONSENT_VERSION) setOpen(true);
    } catch {
      setOpen(true);
    }
  }, []);

  function persist(consent: Omit<Consent, 'v' | 'necessary' | 'ts'>) {
    const value: Consent = {
      v: CONSENT_VERSION,
      necessary: true,
      functional: consent.functional,
      marketing: consent.marketing,
      ts: new Date().toISOString(),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    } catch {
      /* localStorage indisponibil – ignorăm */
    }
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('title')}
      className="fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4"
    >
      <div className="mx-auto max-w-3xl rounded-2xl border border-anthracite-200 bg-white p-5 shadow-xl">
        <h2 className="text-base font-bold text-anthracite-900">{t('title')}</h2>
        <p className="mt-2 text-sm leading-relaxed text-anthracite-600">
          {t('description')}{' '}
          <Link
            href="/legal/cookie"
            className="font-medium text-primary-600 hover:text-primary-700"
          >
            {t('cookieLink')}
          </Link>
          .
        </p>

        {showPrefs ? (
          <div className="mt-4 space-y-3 rounded-xl bg-anthracite-50 p-4 text-sm">
            <label className="flex items-start gap-3">
              <input type="checkbox" checked disabled className="mt-1" />
              <span>
                <span className="font-semibold text-anthracite-900">
                  {t('cat.necessary.title')}
                </span>
                <span className="block text-anthracite-500">
                  {t('cat.necessary.desc')}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={functional}
                onChange={(e) => setFunctional(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-anthracite-900">
                  {t('cat.functional.title')}
                </span>
                <span className="block text-anthracite-500">
                  {t('cat.functional.desc')}
                </span>
              </span>
            </label>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={marketing}
                onChange={(e) => setMarketing(e.target.checked)}
                className="mt-1"
              />
              <span>
                <span className="font-semibold text-anthracite-900">
                  {t('cat.marketing.title')}
                </span>
                <span className="block text-anthracite-500">
                  {t('cat.marketing.desc')}
                </span>
              </span>
            </label>
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
          {showPrefs ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => persist({ functional, marketing })}
            >
              {t('saveChoices')}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPrefs(true)}
            >
              {t('preferences')}
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => persist({ functional: false, marketing: false })}
          >
            {t('rejectAll')}
          </Button>
          <Button
            size="sm"
            onClick={() => persist({ functional: true, marketing: true })}
          >
            {t('acceptAll')}
          </Button>
        </div>
      </div>
    </div>
  );
}
