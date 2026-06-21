'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  isPushSupported,
  isSubscribed,
  enablePush,
  disablePush,
  notificationPermission,
} from '@/lib/push';

export function PushOptIn() {
  const t = useTranslations('notifications');
  const [supported, setSupported] = useState(true);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isPushSupported()) {
      setSupported(false);
      return;
    }
    setDenied(notificationPermission() === 'denied');
    void isSubscribed().then(setSubscribed);
  }, []);

  async function handleEnable() {
    setBusy(true);
    setError(null);
    try {
      const ok = await enablePush();
      setSubscribed(ok);
      if (!ok) {
        setDenied(notificationPermission() === 'denied');
        if (notificationPermission() !== 'denied') setError(t('unavailable'));
      }
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setError(null);
    try {
      await disablePush();
      setSubscribed(false);
    } catch {
      setError(t('error'));
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;

  return (
    <Card className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <p className="text-sm font-semibold text-anthracite-900">{t('title')}</p>
        <p className="text-sm text-anthracite-500">
          {denied
            ? t('denied')
            : subscribed
              ? t('enabled')
              : t('description')}
        </p>
        {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
      </div>
      {!denied &&
        (subscribed ? (
          <Button variant="outline" size="sm" disabled={busy} onClick={() => void handleDisable()}>
            {busy ? t('working') : t('disable')}
          </Button>
        ) : (
          <Button size="sm" disabled={busy} onClick={() => void handleEnable()}>
            {busy ? t('working') : t('enable')}
          </Button>
        ))}
    </Card>
  );
}
