'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { isMajorComponent } from '@valloreg/shared';
import {
  rankingsApi,
  ApiError,
  type RankingsResult,
  type RankingGroup,
  type VehicleRanking,
  type SupplierQualityRow,
} from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { PageHeading } from '@/components/app/PageHeading';

type Tab = 'segment' | 'model' | 'suppliers';

export function RankingsClient() {
  const t = useTranslations('rankings');
  const tseg = useTranslations('vehicles.segments');
  const tmc = useTranslations('majorComponents');
  const locale = useLocale();
  const [data, setData] = useState<RankingsResult | null>(null);
  const [suppliers, setSuppliers] = useState<SupplierQualityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [available, setAvailable] = useState(true);
  const [tab, setTab] = useState<Tab>('segment');

  useEffect(() => {
    rankingsApi
      .get()
      .then(setData)
      .catch((err) => {
        if (err instanceof ApiError && err.status === 403) setAvailable(false);
      })
      .finally(() => setLoading(false));
    rankingsApi
      .suppliers()
      .then(setSuppliers)
      .catch(() => setSuppliers([]));
  }, []);

  const compLabel = (c: string) =>
    isMajorComponent(c)
      ? (tmc as unknown as (k: string) => string)(`components.${c}`)
      : (tmc as unknown as (k: string) => string)('components.other');

  const groups: RankingGroup[] =
    (tab === 'segment' ? data?.bySegment : data?.byModel) ?? [];

  const groupLabel = (key: string) =>
    tab === 'segment' ? safeSeg(tseg, key) : key;

  function downloadCsv() {
    if (!data) return;
    const rows: string[][] = [
      [
        t('csv.group'),
        t('csv.vehicle'),
        t('csv.score'),
        t('csv.costPerKm'),
        t('csv.revenuePerKm'),
        t('csv.profitPerKm'),
        t('csv.majorEvents'),
        t('csv.bigPartsDue'),
        t('csv.replaceAdvice'),
      ],
    ];
    for (const g of data.bySegment) {
      for (const v of g.vehicles) {
        rows.push([
          safeSeg(tseg, g.key),
          v.label,
          String(v.economyScore),
          v.costPerKm ?? '',
          v.revenuePerKm ?? '',
          v.profitPerKm ?? '',
          String(v.majorEventCount),
          String(v.bigPartsDue),
          v.replaceAdvice ? t('replaceAdvice') : '',
        ]);
      }
    }
    const csv = rows
      .map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'valloreg-ranglista.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <PageHeading
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <div className="flex gap-2 print:hidden">
            <Button variant="outline" size="sm" onClick={downloadCsv}>
              {t('exportCsv')}
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              {t('exportPdf')}
            </Button>
          </div>
        }
      />

      {loading ? (
        <p className="py-10 text-center text-sm text-anthracite-500">{t('loading')}</p>
      ) : !available ? (
        <Card className="py-16">
          <p className="text-center text-sm text-anthracite-500">{t('unavailable')}</p>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex gap-2 print:hidden">
            {(['segment', 'model', 'suppliers'] as const).map((tb) => (
              <button
                key={tb}
                onClick={() => setTab(tb)}
                className={
                  'rounded-full border px-3 py-1 text-xs font-medium ' +
                  (tab === tb
                    ? 'border-primary-600 bg-primary-600 text-white'
                    : 'border-anthracite-200 bg-white text-anthracite-600 hover:bg-anthracite-50')
                }
              >
                {t(`tabs.${tb}`)}
              </button>
            ))}
          </div>

          {tab === 'suppliers' ? (
            suppliers.length === 0 ? (
              <Card className="py-16">
                <p className="text-center text-sm text-anthracite-500">{t('suppliers.empty')}</p>
              </Card>
            ) : (
              <Card className="overflow-hidden p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
                      <tr>
                        <th className="px-4 py-3 font-semibold">{t('suppliers.supplier')}</th>
                        <th className="px-4 py-3 font-semibold">{t('suppliers.component')}</th>
                        <th className="px-4 py-3 text-right font-semibold">{t('suppliers.medianCost')}</th>
                        <th className="px-4 py-3 text-right font-semibold">{t('suppliers.medianLife')}</th>
                        <th className="px-4 py-3 text-center font-semibold">{t('suppliers.events')}</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-anthracite-100">
                      {suppliers.map((s) => (
                        <tr key={`${s.supplierId}-${s.component}`}>
                          <td className="px-4 py-3 font-medium text-anthracite-900">{s.supplierName}</td>
                          <td className="px-4 py-3 text-anthracite-700">{compLabel(s.component)}</td>
                          <td className="px-4 py-3 text-right text-anthracite-700">
                            {s.medianCost != null ? `${num(s.medianCost, locale)} ${s.currency ?? ''}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right text-anthracite-700">
                            {s.medianIntervalKm != null
                              ? `${s.medianIntervalKm.toLocaleString(locale)} km`
                              : '-'}
                          </td>
                          <td className="px-4 py-3 text-center text-anthracite-500">{s.eventCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )
          ) : groups.length === 0 ? (
            <Card className="py-16">
              <p className="text-center text-sm text-anthracite-500">{t('empty')}</p>
            </Card>
          ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.key}>
                <h2 className="mb-2 text-sm font-semibold capitalize text-anthracite-700">
                  {groupLabel(g.key)}{' '}
                  <span className="font-normal text-anthracite-400">
                    ({g.vehicles.length})
                  </span>
                </h2>
                <Card className="overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
                        <tr>
                          <th className="px-4 py-3 font-semibold">#</th>
                          <th className="px-4 py-3 font-semibold">{t('table.vehicle')}</th>
                          <th className="px-4 py-3 text-right font-semibold">{t('table.score')}</th>
                          <th className="px-4 py-3 text-right font-semibold">{t('table.costPerKm')}</th>
                          <th className="px-4 py-3 text-right font-semibold">{t('table.profitPerKm')}</th>
                          <th className="px-4 py-3 text-center font-semibold">{t('table.bigPartsDue')}</th>
                          <th className="px-4 py-3 font-semibold">{t('table.badges')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-anthracite-100">
                        {g.vehicles.map((v, i) => (
                          <Row key={v.vehicleId} v={v} rank={i + 1} locale={locale} t={t} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </section>
            ))}
          </div>
          )}
        </>
      )}
    </>
  );
}

function Row({
  v,
  rank,
  locale,
  t,
}: {
  v: VehicleRanking;
  rank: number;
  locale: string;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <tr>
      <td className="px-4 py-3 font-semibold text-anthracite-400">{rank}</td>
      <td className="px-4 py-3 font-medium text-anthracite-900">
        {v.label}
        {v.replaceAdvice && (
          <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs text-red-700">
            {t('replaceAdvice')}
          </span>
        )}
      </td>
      <td className="px-4 py-3 text-right font-semibold text-anthracite-900">{v.economyScore}</td>
      <td className="px-4 py-3 text-right text-anthracite-700">
        {v.costPerKm != null ? `${num(v.costPerKm, locale)} ${v.currency ?? ''}` : '-'}
      </td>
      <td
        className={
          'px-4 py-3 text-right ' +
          (v.profitPerKm == null
            ? 'text-anthracite-400'
            : parseFloat(v.profitPerKm) >= 0
              ? 'text-emerald-600'
              : 'text-red-600')
        }
      >
        {v.profitPerKm != null ? `${num(v.profitPerKm, locale)} ${v.currency ?? ''}` : '–'}
      </td>
      <td className="px-4 py-3 text-center">
        {v.bigPartsDue > 0 ? (
          <Badge tone="warning">{v.bigPartsDue}</Badge>
        ) : (
          <span className="text-anthracite-300">0</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap gap-1">
          {v.badges.map((b) => (
            <Badge key={b} tone="success">
              {(t as unknown as (k: string) => string)(`badges.${b}`)}
            </Badge>
          ))}
        </div>
      </td>
    </tr>
  );
}

function num(value: string, locale: string): string {
  const n = parseFloat(value);
  return isNaN(n) ? value : n.toLocaleString(locale, { maximumFractionDigits: 2 });
}

/** Szegmens-címke biztonságos feloldása (ismeretlen kulcsnál a nyers érték). */
function safeSeg(tseg: ReturnType<typeof useTranslations>, key: string): string {
  try {
    return (tseg as unknown as (k: string) => string)(key);
  } catch {
    return key;
  }
}
