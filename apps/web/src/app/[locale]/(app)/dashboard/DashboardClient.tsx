'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { Link } from '@/i18n/routing';
import {
  statsApi,
  remindersApi,
  insightsApi,
  type DashboardStats,
  type Reminder,
  type AnomalySummary,
} from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/app/PageHeading';
import { PushOptIn } from '@/components/app/PushOptIn';
import { UploadZone } from '@/components/app/UploadZone';
import { ReminderRow } from '@/components/app/ReminderRow';

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
  const tr = useTranslations('reminders');
  const locale = useLocale();
  const ti = useTranslations('insights');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [anomalies, setAnomalies] = useState<AnomalySummary | null>(null);

  const loadStats = useCallback(() => {
    return statsApi
      .getDashboard()
      .then(setStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    loadStats().finally(() => setLoading(false));
    // Az emlékeztető widget hibája nem buktatja meg a dashboardot (pl. ha a
    // REMINDERS feature nincs engedélyezve → 403, csendben elnyeljük).
    remindersApi
      .upcoming()
      .then(setReminders)
      .catch(() => setReminders([]));
    // Anomália-összegző (REPORTS feature mögött) – hiba esetén csendben kihagyjuk.
    insightsApi
      .getSummary()
      .then(setAnomalies)
      .catch(() => setAnomalies(null));
  }, [loadStats]);

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

      {/* Gyors feltöltés – a fő munkafolyamat egy lépésre a vezérlőpultról. */}
      <Card className="mb-6">
        <div className="mb-3 flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-anthracite-900">
              {t('quickUpload.title')}
            </h2>
            <p className="text-sm text-anthracite-500">
              {t('quickUpload.subtitle')}
            </p>
          </div>
          <Link href="/documents">
            <Button variant="outline" size="sm">
              {t('quickUpload.allDocuments')}
            </Button>
          </Link>
        </div>
        <UploadZone onUploadComplete={() => void loadStats()} />
      </Card>

      {/* Esedékes emlékeztetők – proaktív karbantartás + lejáratok. */}
      {reminders.length > 0 && (
        <Card className="mb-6 p-0">
          <div className="flex items-center justify-between px-4 py-3">
            <h2 className="text-base font-semibold text-anthracite-900">
              {tr('widget.title')}
            </h2>
            <Link
              href="/reminders"
              className="text-sm font-medium text-primary-600 hover:underline"
            >
              {tr('widget.viewAll')}
            </Link>
          </div>
          <div className="divide-y divide-anthracite-100 border-t border-anthracite-100">
            {reminders.map((r) => (
              <ReminderRow key={r.id} reminder={r} compact />
            ))}
          </div>
        </Card>
      )}

      {/* Költség-anomáliák – figyelmeztető widget, ha van észlelés. */}
      {anomalies && anomalies.total > 0 && (
        <Link href="/insights" className="mb-6 block">
          <Card hoverable className="border-l-4 border-amber-400">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span aria-hidden="true" className="text-xl">⚠️</span>
                <div>
                  <p className="text-sm font-semibold text-anthracite-900">
                    {ti('widget.title')}
                  </p>
                  <p className="text-xs text-anthracite-500">
                    {ti('widget.count', { count: anomalies.total })}
                  </p>
                </div>
              </div>
              <span className="text-sm font-medium text-primary-600">
                {ti('widget.viewAll')} →
              </span>
            </div>
          </Card>
        </Link>
      )}

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
          <StatCard
            label={t('stats.automationRate')}
            value={Math.round(stats.automation.rate * 100)}
            unit="%"
          />
        </div>
      )}
    </>
  );
}
