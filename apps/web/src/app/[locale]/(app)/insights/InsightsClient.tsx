'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  insightsApi,
  benchmarkApi,
  ApiError,
  type Anomaly,
  type AnomalySeverityValue,
  type TcoRecommendationValue,
  type VehicleTco,
  type BenchmarkComparison,
  type BenchmarkPositionValue,
  type VehicleRecall,
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

const TCO_TONE: Record<TcoRecommendationValue, BadgeTone> = {
  consider_replacement: 'danger',
  watch: 'warning',
  ok: 'success',
};

const POSITION_TONE: Record<BenchmarkPositionValue, BadgeTone> = {
  above: 'danger',
  within: 'neutral',
  below: 'success',
};

export function InsightsClient() {
  const t = useTranslations('insights');
  const locale = useLocale();
  const router = useRouter();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [tco, setTco] = useState<VehicleTco[]>([]);
  const [benchmark, setBenchmark] = useState<BenchmarkComparison[]>([]);
  const [recalls, setRecalls] = useState<VehicleRecall[]>([]);
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
    insightsApi
      .getTco()
      .then(setTco)
      .catch(() => setTco([]));
    benchmarkApi
      .getComparison()
      .then(setBenchmark)
      .catch(() => setBenchmark([]));
    benchmarkApi
      .getRecalls()
      .then(setRecalls)
      .catch(() => setRecalls([]));
  }, []);

  function kmBucketLabel(bucket: number): string {
    if (bucket < 0) return t('benchmark.kmUnknown');
    const lo = Math.round(bucket / 1000);
    const hi = Math.round((bucket + 50000) / 1000);
    if (bucket >= 200000) return t('benchmark.kmOver', { km: lo });
    return t('benchmark.kmRange', { from: lo, to: hi });
  }

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
      ) : (
        <div className="space-y-8">
          {/* Költség-anomáliák */}
          <section>
            <h2 className="mb-2 text-sm font-semibold text-anthracite-700">
              {t('sections.anomalies')}
            </h2>
            {anomalies.length === 0 ? (
              <Card className="py-10">
                <p className="text-center text-sm text-anthracite-500">
                  {t('empty.description')}
                </p>
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
                      a.documentId &&
                      router.push(`/${locale}/documents/${a.documentId}`)
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
                        <p className="truncate text-xs text-anthracite-500">
                          {meta(a)}
                        </p>
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
          </section>

          {/* Prediktív TCO / csere-javaslat */}
          {tco.length > 0 && (
            <section>
              <h2 className="mb-1 text-sm font-semibold text-anthracite-700">
                {t('tco.title')}
              </h2>
              <p className="mb-2 text-xs text-anthracite-500">{t('tco.subtitle')}</p>
              <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
                      <tr>
                        <th className="px-4 py-3 font-semibold">{t('tco.vehicle')}</th>
                        <th className="px-4 py-3 font-semibold text-right">
                          {t('tco.totalSpent')}
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          {t('tco.recentCost')}
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          {t('tco.trend')}
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          {t('tco.costPerKm')}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {t('tco.recommendation')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-anthracite-100">
                      {tco.map((v) => (
                        <tr
                          key={v.vehicleId}
                          className="cursor-pointer hover:bg-anthracite-50"
                          onClick={() =>
                            router.push(`/${locale}/vehicles/${v.vehicleId}`)
                          }
                        >
                          <td className="px-4 py-3 font-medium text-anthracite-900">
                            {v.label}
                          </td>
                          <td className="px-4 py-3 text-right text-anthracite-700">
                            {fmt(v.totalSpent)}
                            {v.currency ? ` ${v.currency}` : ''}
                          </td>
                          <td className="px-4 py-3 text-right text-anthracite-700">
                            {fmt(v.recentCost)}
                            {v.currency ? ` ${v.currency}` : ''}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-medium ${
                              v.trendPct == null
                                ? 'text-anthracite-400'
                                : v.trendPct > 0
                                  ? 'text-red-600'
                                  : 'text-emerald-600'
                            }`}
                          >
                            {v.trendPct == null
                              ? '—'
                              : `${v.trendPct > 0 ? '+' : ''}${v.trendPct}%`}
                          </td>
                          <td className="px-4 py-3 text-right text-anthracite-700">
                            {v.costPerKm
                              ? `${v.costPerKm}${v.currency ? ` ${v.currency}` : ''}`
                              : '—'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={TCO_TONE[v.recommendation]}>
                              {t(`tco.recommendations.${v.recommendation}`)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>
          )}

          {/* Piaci összevetés („Európai trendek") */}
          {benchmark.length > 0 && (
            <section>
              <h2 className="mb-1 text-sm font-semibold text-anthracite-700">
                {t('benchmark.title')}
              </h2>
              <p className="mb-2 text-xs text-anthracite-500">
                {t('benchmark.subtitle')}
              </p>
              <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
                      <tr>
                        <th className="px-4 py-3 font-semibold">
                          {t('benchmark.segment')}
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          {t('benchmark.yourCost')}
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          {t('benchmark.marketCost')}
                        </th>
                        <th className="px-4 py-3 font-semibold text-right">
                          {t('benchmark.delta')}
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          {t('benchmark.position')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-anthracite-100">
                      {benchmark.map((b) => (
                        <tr key={`${b.makeModel}-${b.itemCategory}-${b.kmBucket}`}>
                          <td className="px-4 py-3">
                            <p className="font-medium capitalize text-anthracite-900">
                              {b.makeModel}
                            </p>
                            <p className="text-xs text-anthracite-500">
                              {b.itemCategory} · {kmBucketLabel(b.kmBucket)} ·{' '}
                              {t('benchmark.sample', { n: b.sampleVehicles })}
                            </p>
                          </td>
                          <td className="px-4 py-3 text-right text-anthracite-700">
                            {fmt(b.tenantMedian)} {b.currency}
                          </td>
                          <td className="px-4 py-3 text-right text-anthracite-700">
                            {fmt(b.benchmarkMedian)} {b.currency}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-medium ${
                              b.deltaPct > 0
                                ? 'text-red-600'
                                : b.deltaPct < 0
                                  ? 'text-emerald-600'
                                  : 'text-anthracite-400'
                            }`}
                          >
                            {b.deltaPct > 0 ? '+' : ''}
                            {b.deltaPct}%
                          </td>
                          <td className="px-4 py-3">
                            <Badge tone={POSITION_TONE[b.position]}>
                              {t(`benchmark.positions.${b.position}`)}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>
          )}

          {/* Visszahívások (ingyenes forrásból) */}
          {recalls.length > 0 && (
            <section>
              <h2 className="mb-1 text-sm font-semibold text-anthracite-700">
                {t('recalls.title')}
              </h2>
              <p className="mb-2 text-xs text-anthracite-500">
                {t('recalls.subtitle')}
              </p>
              <Card className="divide-y divide-anthracite-100 p-0">
                {recalls.map((r) => (
                  <div key={r.reference} className="px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium capitalize text-anthracite-900">
                        {r.makeModel}
                        {r.yearFrom && r.yearTo ? (
                          <span className="ml-1 font-normal text-anthracite-500">
                            ({r.yearFrom}–{r.yearTo})
                          </span>
                        ) : null}
                      </p>
                      <Badge tone="warning">{r.reference}</Badge>
                    </div>
                    <p className="mt-1 text-sm text-anthracite-700">{r.hazard}</p>
                    {r.remedy ? (
                      <p className="mt-1 text-xs text-anthracite-500">
                        {t('recalls.remedy')}: {r.remedy}
                      </p>
                    ) : null}
                  </div>
                ))}
              </Card>
            </section>
          )}
        </div>
      )}
    </>
  );
}
