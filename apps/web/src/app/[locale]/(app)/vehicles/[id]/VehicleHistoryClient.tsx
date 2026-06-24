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
import { VehicleVerification } from '@/components/app/VehicleVerification';
import { VehicleMajorComponents } from '@/components/app/VehicleMajorComponents';

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
  const tf = useTranslations('vehicles.fields');
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

  const detailRows: { label: string; value: string }[] = [
    { label: tf('vehicleType'), value: vehicle.vehicleType ?? '' },
    {
      label: tf('firstRegistration'),
      value: vehicle.firstRegistration
        ? new Date(vehicle.firstRegistration).toLocaleDateString(locale)
        : '',
    },
    { label: tf('category'), value: vehicle.category ?? '' },
    { label: tf('fuelType'), value: vehicle.fuelType ?? '' },
    { label: tf('engineCm3'), value: vehicle.engineCm3 != null ? String(vehicle.engineCm3) : '' },
    { label: tf('powerKw'), value: vehicle.powerKw != null ? String(vehicle.powerKw) : '' },
    { label: tf('color'), value: vehicle.color ?? '' },
    { label: tf('seats'), value: vehicle.seats != null ? String(vehicle.seats) : '' },
    { label: tf('maxMassKg'), value: vehicle.maxMassKg != null ? String(vehicle.maxMassKg) : '' },
    { label: tf('kerbWeightKg'), value: vehicle.kerbWeightKg != null ? String(vehicle.kerbWeightKg) : '' },
    { label: tf('euroClass'), value: vehicle.euroClass ?? '' },
    { label: tf('typeApproval'), value: vehicle.typeApproval ?? '' },
  ].filter((r) => r.value !== '');

  const owner = vehicle.parties?.find((p) => p.role === 'owner');
  const user = vehicle.parties?.find((p) => p.role === 'user');
  const partyLines = (
    p: NonNullable<typeof owner>,
  ): string[] => {
    const idLabel = p.partyType === 'company' ? tf('party.cui') : tf('party.cnp');
    return [
      p.name ?? '',
      p.address ?? '',
      p.idNumber ? `${idLabel}: ${p.idNumber}` : '',
    ].filter(Boolean);
  };

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

      {(detailRows.length > 0 || owner || user) && (
        <Card className="mb-6">
          <h2 className="mb-3 text-base font-semibold text-anthracite-900">
            {tf('sectionTech')}
          </h2>
          {detailRows.length > 0 && (
            <dl className="grid grid-cols-2 gap-x-6 gap-y-2 sm:grid-cols-3">
              {detailRows.map((r) => (
                <div key={r.label}>
                  <dt className="text-xs text-anthracite-500">{r.label}</dt>
                  <dd className="text-sm font-medium text-anthracite-900">{r.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {(owner || user) && (
            <div className="mt-4 grid grid-cols-1 gap-4 border-t border-anthracite-100 pt-4 sm:grid-cols-2">
              {owner && partyLines(owner).length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
                    {tf('sectionOwner')}
                  </p>
                  {partyLines(owner).map((line, i) => (
                    <p key={i} className="text-sm text-anthracite-800">{line}</p>
                  ))}
                </div>
              )}
              {user && partyLines(user).length > 0 && (
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-anthracite-500">
                    {tf('sectionUser')}
                  </p>
                  {partyLines(user).map((line, i) => (
                    <p key={i} className="text-sm text-anthracite-800">{line}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      )}

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

      <VehicleVerification vehicleId={vehicle.id} />
      <VehicleMajorComponents vehicleId={vehicle.id} currency={summary.currency} />
      <VehicleReminders vehicle={vehicle} />
      <VehicleDocuments vehicleId={vehicle.id} />
    </>
  );
}
