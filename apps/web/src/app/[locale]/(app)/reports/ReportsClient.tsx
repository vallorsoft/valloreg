'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  reportsApi,
  ApiError,
  type ReportSummary,
  type ExportRow,
} from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/app/PageHeading';

function fmtAmount(value: string | number | null | undefined, locale: string): string {
  if (value == null || value === '') return '-';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(n) ? String(value) : n.toLocaleString(locale, { maximumFractionDigits: 2 });
}

const CSV_HEADERS: (keyof ExportRow)[] = [
  'date',
  'supplier',
  'invoiceNumber',
  'vehicle',
  'item',
  'category',
  'type',
  'quantity',
  'unitPrice',
  'price',
  'currency',
];

function toCsv(rows: ExportRow[]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? '');
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [CSV_HEADERS.join(',')];
  for (const row of rows) {
    lines.push(CSV_HEADERS.map((h) => esc(row[h])).join(','));
  }
  return lines.join('\n');
}

export function ReportsClient() {
  const t = useTranslations('reports');
  const locale = useLocale();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState<ReportSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (f?: string, tt?: string) => {
    setLoading(true);
    setError(null);
    try {
      setData(await reportsApi.getSummary(f || undefined, tt || undefined));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  function categoryLabel(key: string): string {
    const fullKey = `categories.${key}` as Parameters<typeof t>[0];
    return t.has(fullKey) ? t(fullKey) : key;
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const rows = await reportsApi.getExport(from || undefined, to || undefined);
      const csv = toCsv(rows);
      const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `valloreg-export-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : t('error'));
    } finally {
      setExporting(false);
    }
  }

  const currency = data?.totals.currency ?? '';
  const withCurrency = (v: string | number) =>
    `${fmtAmount(v, locale)}${currency ? ` ${currency}` : ''}`;

  return (
    <>
      <PageHeading
        title={t('title')}
        subtitle={t('subtitle')}
        action={
          <Button size="sm" onClick={() => void handleExport()} disabled={exporting}>
            {exporting ? t('exporting') : t('exportCsv')}
          </Button>
        }
      />

      {/* Szűrő */}
      <Card className="mb-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <div>
            <label className="mb-1 block text-xs text-anthracite-500">{t('from')}</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-lg border border-anthracite-200 bg-white px-3 py-2 text-sm text-anthracite-900"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-anthracite-500">{t('to')}</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-lg border border-anthracite-200 bg-white px-3 py-2 text-sm text-anthracite-900"
            />
          </div>
          <Button variant="outline" size="sm" onClick={() => void load(from, to)}>
            {t('apply')}
          </Button>
          {(from || to) && (
            <button
              className="text-sm text-primary-600 hover:underline"
              onClick={() => {
                setFrom('');
                setTo('');
                void load();
              }}
            >
              {t('clear')}
            </button>
          )}
        </div>
      </Card>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {loading ? (
        <div className="flex items-center justify-center py-16 text-sm text-anthracite-500">
          {t('loading')}
        </div>
      ) : !data ? null : (
        <>
          {/* Összesítő kártyák */}
          <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Card>
              <p className="text-xs text-anthracite-500">{t('totals.grossTotal')}</p>
              <p className="mt-1 text-xl font-semibold text-anthracite-900">
                {withCurrency(data.totals.grossTotal)}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-anthracite-500">{t('totals.itemTotal')}</p>
              <p className="mt-1 text-xl font-semibold text-anthracite-900">
                {withCurrency(data.totals.itemTotal)}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-anthracite-500">{t('totals.invoiceCount')}</p>
              <p className="mt-1 text-xl font-semibold text-anthracite-900">
                {data.totals.invoiceCount}
              </p>
            </Card>
            <Card>
              <p className="text-xs text-anthracite-500">{t('totals.itemCount')}</p>
              <p className="mt-1 text-xl font-semibold text-anthracite-900">
                {data.totals.itemCount}
              </p>
            </Card>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Járművenként */}
            <Card className="overflow-hidden p-0">
              <div className="border-b border-anthracite-100 px-4 py-3">
                <h2 className="text-base font-semibold text-anthracite-900">
                  {t('byVehicle.title')}
                </h2>
              </div>
              {data.byVehicle.length === 0 ? (
                <p className="px-4 py-6 text-sm text-anthracite-500">{t('empty')}</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{t('byVehicle.vehicle')}</th>
                      <th className="px-4 py-3 font-semibold text-right">{t('byVehicle.count')}</th>
                      <th className="px-4 py-3 font-semibold text-right">{t('byVehicle.total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-anthracite-100">
                    {data.byVehicle.map((r) => (
                      <tr key={r.key}>
                        <td className="px-4 py-3 font-medium text-anthracite-900">
                          {r.key === 'unassigned' ? t('unassigned') : r.label || r.key}
                        </td>
                        <td className="px-4 py-3 text-right text-anthracite-600">{r.count}</td>
                        <td className="px-4 py-3 text-right font-medium text-anthracite-900">
                          {withCurrency(r.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>

            {/* Kategóriánként */}
            <Card className="overflow-hidden p-0">
              <div className="border-b border-anthracite-100 px-4 py-3">
                <h2 className="text-base font-semibold text-anthracite-900">
                  {t('byCategory.title')}
                </h2>
              </div>
              {data.byCategory.length === 0 ? (
                <p className="px-4 py-6 text-sm text-anthracite-500">{t('empty')}</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
                    <tr>
                      <th className="px-4 py-3 font-semibold">{t('byCategory.category')}</th>
                      <th className="px-4 py-3 font-semibold text-right">{t('byCategory.count')}</th>
                      <th className="px-4 py-3 font-semibold text-right">{t('byCategory.total')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-anthracite-100">
                    {data.byCategory.map((r) => (
                      <tr key={r.key}>
                        <td className="px-4 py-3 font-medium text-anthracite-900">
                          {categoryLabel(r.key)}
                        </td>
                        <td className="px-4 py-3 text-right text-anthracite-600">{r.count}</td>
                        <td className="px-4 py-3 text-right font-medium text-anthracite-900">
                          {withCurrency(r.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Card>
          </div>

          {/* Havonta */}
          <Card className="mt-6 overflow-hidden p-0">
            <div className="border-b border-anthracite-100 px-4 py-3">
              <h2 className="text-base font-semibold text-anthracite-900">
                {t('byMonth.title')}
              </h2>
            </div>
            {data.byMonth.length === 0 ? (
              <p className="px-4 py-6 text-sm text-anthracite-500">{t('empty')}</p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">{t('byMonth.month')}</th>
                    <th className="px-4 py-3 font-semibold text-right">{t('byMonth.total')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-anthracite-100">
                  {data.byMonth.map((r) => (
                    <tr key={r.month}>
                      <td className="px-4 py-3 font-medium text-anthracite-900">{r.month}</td>
                      <td className="px-4 py-3 text-right font-medium text-anthracite-900">
                        {withCurrency(r.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </>
      )}
    </>
  );
}
