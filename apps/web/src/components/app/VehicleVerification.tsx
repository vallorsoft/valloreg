'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  vehiclesApi,
  ApiError,
  type VehicleVerificationView,
} from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeTone } from '@/components/ui/Badge';

const DAY = 24 * 60 * 60 * 1000;

/** Lejárat → státusz/tone a dátum alapján. */
type DateStateKey = 'unknown' | 'expired' | 'soon' | 'ok';

function dateTone(value: string | null): { tone: BadgeTone; key: DateStateKey } {
  if (!value) return { tone: 'neutral', key: 'unknown' };
  const diff = new Date(value).getTime() - Date.now();
  if (diff < 0) return { tone: 'danger', key: 'expired' };
  if (diff < 30 * DAY) return { tone: 'warning', key: 'soon' };
  return { tone: 'success', key: 'ok' };
}

/**
 * RO megfelelőség-panel: ITP / RCA / rovinietă lejáratok + „Ellenőrzés most".
 * Az ellenőrzés frissíti a kapcsolódó emlékeztetőket is.
 */
export function VehicleVerification({ vehicleId }: { vehicleId: string }) {
  const t = useTranslations('vehicles.verification');
  const locale = useLocale();
  const [data, setData] = useState<VehicleVerificationView | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await vehiclesApi.getVerification(vehicleId));
    } catch {
      // 401/403 – csendben
    } finally {
      setLoaded(true);
    }
  }, [vehicleId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleVerify() {
    setBusy(true);
    setError(null);
    try {
      setData(await vehiclesApi.verify(vehicleId));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error'));
    } finally {
      setBusy(false);
    }
  }

  if (!loaded) return null;

  const fmt = (v: string | null) =>
    v ? new Date(v).toLocaleDateString(locale) : '—';

  const rows: { label: string; value: string | null }[] = [
    { label: t('itp'), value: data?.itpValidUntil ?? null },
    { label: t('rca'), value: data?.rcaValidUntil ?? null },
    { label: t('vignette'), value: data?.vignetteValidUntil ?? null },
  ];

  return (
    <Card className="mt-6 p-0">
      <div className="flex items-center justify-between border-b border-anthracite-100 px-4 py-3">
        <div>
          <h2 className="text-base font-semibold text-anthracite-900">
            {t('title')}
          </h2>
          {data && (
            <p className="text-xs text-anthracite-400">
              {t('checkedAt', { date: fmt(data.checkedAt) })}
              {data.source === 'stub' ? ` · ${t('demoNote')}` : ''}
            </p>
          )}
        </div>
        <Button variant="outline" size="sm" disabled={busy} onClick={() => void handleVerify()}>
          {busy ? t('checking') : t('verifyNow')}
        </Button>
      </div>

      {error && <p className="px-4 pt-3 text-sm text-red-600">{error}</p>}

      {!data ? (
        <p className="px-4 py-6 text-center text-sm text-anthracite-500">
          {t('empty')}
        </p>
      ) : (
        <div className="divide-y divide-anthracite-100">
          {rows.map((r) => {
            const { tone, key } = dateTone(r.value);
            return (
              <div
                key={r.label}
                className="flex items-center justify-between px-4 py-3"
              >
                <span className="text-sm text-anthracite-700">{r.label}</span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-anthracite-900">
                    {fmt(r.value)}
                  </span>
                  <Badge tone={tone}>{t(`state.${key}`)}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
