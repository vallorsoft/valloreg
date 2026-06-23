'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/Button';

/**
 * A böngésző `beforeinstallprompt` eseménye (Chrome/Edge/Android). A típus nincs
 * a standard lib.dom-ban, ezért itt deklaráljuk a használt részét.
 */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

/** Igaz, ha az alkalmazás már telepítve fut (standalone / iOS standalone). */
function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari saját, nem szabványos jelzője.
    (window.navigator as { standalone?: boolean }).standalone === true
  );
}

/** Igaz iOS (iPhone/iPad) Safarin, ahol nincs beforeinstallprompt. */
function isIos(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  const iOSDevice = /iphone|ipad|ipod/i.test(ua);
  // iPadOS 13+ desktopként mutatkozik be – Macintosh + touch.
  const iPadOs = /Macintosh/i.test(ua) && 'ontouchend' in window;
  return iOSDevice || iPadOs;
}

/**
 * "Alkalmazás telepítése" gomb a fejlécbe.
 *
 * - Chrome/Edge/Android: elkapja a `beforeinstallprompt` eseményt, és a gombbal
 *   előhozza a natív telepítő párbeszédet.
 * - iOS Safari: nincs ilyen API, ezért egy rövid útmutatót mutat (Megosztás →
 *   Főképernyőhöz adás).
 * - Ha az app már telepítve fut, a gomb nem jelenik meg.
 */
export function InstallButton() {
  const t = useTranslations('app.install');
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (isStandalone()) {
      setInstalled(true);
      return;
    }
    setIos(isIos());

    const onPrompt = (e: Event) => {
      // Megakadályozzuk a böngésző alapértelmezett mini-infosávját, hogy a saját
      // gombunkkal vezéreljük a telepítést.
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };

    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  async function handleClick() {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      if (outcome === 'accepted') setInstalled(true);
      // A prompt egyszer használatos – elengedjük.
      setDeferred(null);
      return;
    }
    if (ios) setIosHint((v) => !v);
  }

  // Ne mutassunk semmit, ha már telepítve van, vagy ha nincs natív prompt és nem iOS.
  if (installed) return null;
  if (!deferred && !ios) return null;

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => void handleClick()}
        aria-label={t('label')}
      >
        <span aria-hidden="true" className="mr-1">
          ↓
        </span>
        {t('label')}
      </Button>

      {iosHint && (
        <div className="absolute right-0 z-40 mt-2 w-64 rounded-xl border border-anthracite-100 bg-white p-3 text-xs text-anthracite-600 shadow-card-hover">
          <p className="mb-1 font-semibold text-anthracite-900">{t('iosTitle')}</p>
          <p>{t('iosSteps')}</p>
        </div>
      )}
    </div>
  );
}
