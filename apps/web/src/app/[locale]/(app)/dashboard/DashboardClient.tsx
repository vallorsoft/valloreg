'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { statsApi, type DashboardStats } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { PageHeading } from '@/components/app/PageHeading';
import { PushOptIn } from '@/components/app/PushOptIn';

function StatCard({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <Card hoverable>
      <p className="text-sm font-medium text-anthracite-500">{label}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-2xl font-bold text-anthracite-900">{value}</span>
        {unit && <span className="text-sm text-anthracite-400">{unit}</span>}
      </p>
    </Card>
  );
}

export function DashboardClient() {
  const t = useTranslations('dashboard');
  const locale = useLocale();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    statsApi
      .getDashboard()
      .then(setStats)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const currency = t('units.currency');
  const items = t('units.items');

  function fmtAmount(value: string | null): string {
    if (!value) return '-';
    const n = parseFloat(value);
    return isNaN(n) ? '-' : n.toLocaleString(locale);
  }

  return (
    <>
      <PageHeading title={t('title')} subtitle={t('subtitle')} />

      <div className="mb-6">
        <PushOptIn />
      </div>

      {loading ? (
        <div className="py-10 text-center text-sm text-anthracite-500">{t('loading')}</div>
      ) : !stats ? (
        <p className="text-sm text-anthracite-500">{t('noData')}</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <StatCard
            label={t('stats.vehicleCount')}
            value={stats.vehicles.total}
            unit={items}
          />
          <StatCard
            label={t('stats.documentTotal')}
            value={stats.documents.total}
            unit={items}
          />
          <StatCard
            label={t('stats.documentThisMonth')}
            value={stats.documents.thisMonth}
            unit={items}
          />
          <StatCard
            label={t('stats.needsReview')}
            value={stats.documents.needsReview}
            unit={items}
          />
          <StatCard
            label={t('stats.processing')}
            value={stats.documents.processing}
            unit={items}
          />
          <StatCard
            label={t('stats.confirmed')}
            value={stats.documents.confirmed}
            unit={items}
          />
          <StatCard
            label={t('stats.invoiceCount')}
            value={stats.invoices.count}
            unit={items}
          />
          <StatCard
            label={t('stats.invoiceGrossTotal')}
            value={fmtAmount(stats.invoices.grossTotal)}
            unit={stats.invoices.grossTotal ? currency : undefined}
          />
        </div>
      )}

      {stats && stats.documents.total === 0 && stats.vehicles.total === 0 && (
        <p className="mt-6 text-sm text-anthracite-500">{t('noData')}</p>
      )}
    </>
  );
}
