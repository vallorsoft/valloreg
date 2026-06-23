'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  insightsApi,
  ApiError,
  type Anomaly,
  type AnomalySeverityValue,
} from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeTone } from '@/components/ui/Badge';
import { PageHeading } from '@/components/app/PageHeading';

const SEVERITY_TONE: Record<AnomalySeverityValue, BadgeTone> = {
  high: 'danger',
  medium: 'warning',
  low: 'neutral',
};

const TYPE_ICON: Record<string, string> = {
  price_spike: '📈',
  duplicate_invoice: '📑',
  unusual_amount: '⚠️',
};

export function InsightsClient() {
  const t = useTranslations('insights');
  const locale = useLocale();
  const router = useRouter();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);

  useEffect(() => {
    insightsApi
      .getAnomalies()
      .then(setAnomalies)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) setAvailable(false);
      })
      .finally(() => setLoading(false));
  }, []);

  function fmt(value: string | null): string {
    if (!value) return '-';
    const n = parseFloat(value);
    return isNaN(n) ? value : n.toLocaleString(locale, { maximumFractionDigits: 0 });
  }

  function describe(a: Anomaly): string {
    if (a.type === 'price_spike') {
      return t('message.price_spike', { item: a.itemName ?? '-', pct: a.deltaPct ?? 0 });
    }
    if (a.type === 'duplicate_invoice') {
      return t('message.duplicate_invoice', {
        number: a.itemName ?? '-',
        count: a.count ?? 2,
      });
    }
    return t('message.unusual_amount', { pct: a.deltaPct ?? 0 });
  }

  function meta(a: Anomaly): string {
    const parts: string[] = [];
    if (a.supplier) parts.push(a.supplier);
    if (a.vehicleLabel) parts.push(a.vehicleLabel);
    if (a.date) parts.push(new Date(a.date).toLocaleDateString(locale));
    if (a.amount && a.type !== 'duplicate_invoice') {
      parts.push(`${fmt(a.amount)}${a.currency ? ` ${a.currency}` : ''}`);
    }
    return parts.join(' · ');
  }

  return (
    <>
      <PageHeading title={t('title')} subtitle={t('subtitle')} />

      {loading ? (
        <p className="py-10 text-center text-sm text-anthracite-500">{t('loading')}</p>
      ) : !available ? (
        <Card className="py-16">
          <p className="text-center text-sm text-anthracite-500">{t('unavailable')}</p>
        </Card>
      ) : anomalies.length === 0 ? (
        <Card className="py-16">
          <div className="mx-auto max-w-sm text-center">
            <h2 className="text-base font-semibold text-anthracite-900">
              {t('empty.title')}
            </h2>
            <p className="mt-1 text-sm text-anthracite-500">{t('empty.description')}</p>
          </div>
        </Card>
      ) : (
        <Card className="divide-y divide-anthracite-100 p-0">
          {anomalies.map((a) => (
            <div
              key={a.id}
              className={`flex items-center justify-between gap-3 px-4 py-3 ${
                a.documentId ? 'cursor-pointer hover:bg-anthracite-50' : ''
              }`}
              onClick={() =>
                a.documentId && router.push(`/${locale}/documents/${a.documentId}`)
              }
            >
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden="true" className="text-lg">
                  {TYPE_ICON[a.type] ?? '•'}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-anthracite-900">
                    {describe(a)}
                  </p>
                  <p className="truncate text-xs text-anthracite-500">{meta(a)}</p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Badge tone="info">{t(`types.${a.type}`)}</Badge>
                <Badge tone={SEVERITY_TONE[a.severity]}>
                  {t(`severity.${a.severity}`)}
                </Badge>
              </div>
            </div>
          ))}
        </Card>
      )}
    </>
  );
}
