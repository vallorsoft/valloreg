'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { UNLIMITED } from '@valloreg/shared';
import { billingApi, type BillingOverview } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { PageHeading } from '@/components/app/PageHeading';

function fmtLimit(value: number, locale: string): string {
  return value === UNLIMITED ? '∞' : value.toLocaleString(locale);
}

function UsageBar({ used, limit }: { used: number; limit: number }) {
  const unlimited = limit === UNLIMITED;
  const pct = unlimited ? 0 : Math.min(100, Math.round((used / Math.max(limit, 1)) * 100));
  const color = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-yellow-500' : 'bg-primary-600';
  return (
    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-anthracite-100">
      {!unlimited && <div className={`h-full ${color}`} style={{ width: `${pct}%` }} />}
    </div>
  );
}

export function BillingClient() {
  const t = useTranslations('billing');
  const locale = useLocale();
  const [data, setData] = useState<BillingOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    billingApi
      .getOverview()
      .then(setData)
      .catch(() => {
        /* 401 → AppShell redirect */
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-anthracite-500">
        {t('loading')}
      </div>
    );
  }

  if (!data) return null;

  const usageRows: { label: string; used: number; limit: number }[] = [
    { label: t('usage.vehicles'), used: data.usage.vehicles, limit: data.limits.maxVehicles },
    { label: t('usage.users'), used: data.usage.users, limit: data.limits.maxUsers },
    {
      label: t('usage.documents'),
      used: data.usage.documentsThisMonth,
      limit: data.limits.maxDocumentsPerMonth,
    },
  ];

  return (
    <>
      <PageHeading title={t('title')} subtitle={t('subtitle')} />

      {/* Csomag */}
      <Card className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs text-anthracite-500">{t('plan')}</p>
            <p className="mt-0.5 text-2xl font-bold text-anthracite-900">
              {t(`plans.${data.plan}` as Parameters<typeof t>[0])}
            </p>
          </div>
          {data.status && (
            <span className="inline-flex items-center rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary-700">
              {t(`statuses.${data.status}` as Parameters<typeof t>[0])}
            </span>
          )}
        </div>
        {(data.trialEndsAt || data.currentPeriodEnd) && (
          <p className="mt-3 text-sm text-anthracite-500">
            {data.trialEndsAt
              ? t('trialEnds', {
                  date: new Date(data.trialEndsAt).toLocaleDateString(locale),
                })
              : t('periodEnds', {
                  date: new Date(data.currentPeriodEnd as string).toLocaleDateString(locale),
                })}
          </p>
        )}
        <p className="mt-3 text-xs text-anthracite-400">{t('manageNote')}</p>
      </Card>

      {/* Használat */}
      <Card className="mb-6">
        <h2 className="mb-4 text-base font-semibold text-anthracite-900">{t('usage.title')}</h2>
        <div className="space-y-4">
          {usageRows.map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-anthracite-700">{row.label}</span>
                <span className="font-medium text-anthracite-900">
                  {row.used.toLocaleString(locale)} / {fmtLimit(row.limit, locale)}
                </span>
              </div>
              <UsageBar used={row.used} limit={row.limit} />
            </div>
          ))}
        </div>
      </Card>

      {/* Funkciók */}
      <Card>
        <h2 className="mb-4 text-base font-semibold text-anthracite-900">{t('features.title')}</h2>
        {data.features.length === 0 ? (
          <p className="text-sm text-anthracite-500">{t('features.none')}</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {data.features.map((f) => (
              <span
                key={f}
                className="inline-flex items-center rounded-full bg-anthracite-50 px-3 py-1 text-xs font-medium text-anthracite-700"
              >
                {f}
              </span>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
