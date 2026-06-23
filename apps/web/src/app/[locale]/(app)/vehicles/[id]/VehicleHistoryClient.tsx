'use client';

import { useState, useEffect } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { vehiclesApi, type VehicleServiceHistory } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PageHeading } from '@/components/app/PageHeading';
import { VehicleReminders } from '@/components/app/VehicleReminders';
import { VehicleDocuments } from '@/components/app/VehicleDocuments';

function fmtAmount(value: string | number | null | undefined, locale: string): string {
  if (value == null || value === '') return '-';
  const n = typeof value === 'string' ? parseFloat(value) : value;
  return isNaN(n) ? String(value) : n.toLocaleString(locale, { maximumFractionDigits: 2 });
}

function vehicleTitle(v: VehicleServiceHistory['vehicle']): string {
  const name = [v.make, v.model, v.year].filter(Boolean).join(' ');
  return v.plate ? (name ? `${v.plate} · ${name}` : v.plate) : name || '—';
}

export function VehicleHistoryClient({ id }: { id: string }) {
  const t = useTranslations('vehicles.history');
  const locale = useLocale();
  const router = useRouter();
  const [data, setData] = useState<VehicleServiceHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    vehiclesApi
      .getHistory(id)
      .then(setData)
      .catch(() => setError(t('notFound')))
      .finally(() => setLoading(false));
  }, [id, t]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-anthracite-500">
        {t('loading')}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16">
        <p className="text-anthracite-600">{error ?? t('notFound')}</p>
        <Button variant="outline" size="sm" onClick={() => router.push(`/${locale}/vehicles`)}>
          {t('back')}
        </Button>
      </div>
    );
  }

  const { vehicle, summary, items } = data;
  const currency = summary.currency ?? '';

  const cards: { label: string; value: string }[] = [
    {
      label: t('summary.totalSpent'),
      value: `${fmtAmount(summary.totalSpent, locale)}${currency ? ` ${currency}` : ''}`,
    },
    { label: t('summary.services'), value: String(summary.invoiceCount) },
    { label: t('summary.items'), value: String(summary.itemCount) },
    {
      label: t('summary.lastService'),
      value: summary.lastServiceDate
        ? new Date(summary.lastServiceDate).toLocaleDateString(locale)
        : t('summary.never'),
    },
  ];

  return (
    <>
      <div className="mb-4">
        <button
          className="text-sm text-primary-600 hover:underline"
          onClick={() => router.push(`/${locale}/vehicles`)}
        >
          ← {t('back')}
        </button>
      </div>

      <PageHeading title={vehicleTitle(vehicle)} subtitle={t('subtitle')} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <p className="text-xs text-anthracite-500">{c.label}</p>
            <p className="mt-1 text-xl font-semibold text-anthracite-900">{c.value}</p>
          </Card>
        ))}
      </div>

      <Card className="overflow-hidden p-0">
        <div className="border-b border-anthracite-100 px-4 py-3">
          <h2 className="text-base font-semibold text-anthracite-900">{t('table.title')}</h2>
        </div>
        {items.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-anthracite-500">{t('empty')}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-anthracite-100 bg-anthracite-50 text-anthracite-600">
                <tr>
                  <th className="px-4 py-3 font-semibold">{t('table.date')}</th>
                  <th className="px-4 py-3 font-semibold">{t('table.supplier')}</th>
                  <th className="px-4 py-3 font-semibold">{t('table.item')}</th>
                  <th className="px-4 py-3 font-semibold">{t('table.category')}</th>
                  <th className="px-4 py-3 font-semibold text-right">{t('table.amount')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-anthracite-100">
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className="cursor-pointer hover:bg-anthracite-50"
                    onClick={() =>
                      item.invoice &&
                      router.push(`/${locale}/documents/${item.invoice.documentId}`)
                    }
                  >
                    <td className="px-4 py-3 text-anthracite-600">
                      {item.invoice?.date
                        ? new Date(item.invoice.date).toLocaleDateString(locale)
                        : '-'}
                    </td>
                    <td className="px-4 py-3 text-anthracite-600">
                      {item.invoice?.supplier?.name ?? '-'}
                    </td>
                    <td className="px-4 py-3 font-medium text-anthracite-900">{item.name}</td>
                    <td className="px-4 py-3 text-anthracite-600">{item.category}</td>
                    <td className="px-4 py-3 text-right font-medium text-anthracite-900">
                      {fmtAmount(item.price, locale)}
                      {item.invoice?.currency ? ` ${item.invoice.currency}` : ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <VehicleReminders vehicle={vehicle} />
      <VehicleDocuments vehicleId={vehicle.id} />
    </>
  );
}
