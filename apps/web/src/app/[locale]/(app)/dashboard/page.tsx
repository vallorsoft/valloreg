import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/Card';
import { PageHeading } from '@/components/app/PageHeading';
import { PhaseNote } from '@/components/app/PhaseNote';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'dashboard' });
  return { title: t('title') };
}

// Placeholder demo data – real values arrive in a later phase.
const STATS = [
  { key: 'monthlyCost', value: '1 248 000', unit: 'currency' },
  { key: 'yearlyCost', value: '14 760 000', unit: 'currency' },
  { key: 'costPerVehicle', value: '312 000', unit: 'currency' },
  { key: 'costPerKm', value: '48', unit: 'perKm' },
  { key: 'upcomingMaintenance', value: '3', unit: 'events' },
  { key: 'documentCount', value: '127', unit: 'items' },
  { key: 'serviceEvents', value: '42', unit: 'events' },
] as const;

function DashboardContent() {
  const t = useTranslations('dashboard');

  return (
    <>
      <PageHeading title={t('title')} subtitle={t('subtitle')} />
      <PhaseNote />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {STATS.map((stat) => (
          <Card key={stat.key} hoverable>
            <p className="text-sm font-medium text-anthracite-500">
              {t(`stats.${stat.key}`)}
            </p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="text-2xl font-bold text-anthracite-900">
                {stat.value}
              </span>
              <span className="text-sm text-anthracite-400">
                {t(`units.${stat.unit}`)}
              </span>
            </p>
          </Card>
        ))}
      </div>
      <p className="mt-6 text-sm text-anthracite-500">{t('emptyHint')}</p>
    </>
  );
}

export default async function DashboardPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <DashboardContent />;
}
