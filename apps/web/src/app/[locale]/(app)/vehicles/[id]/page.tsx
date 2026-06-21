import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { VehicleHistoryClient } from './VehicleHistoryClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'vehicles' });
  return { title: t('history.title') };
}

export default async function VehicleHistoryPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <VehicleHistoryClient id={id} />;
}
