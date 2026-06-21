import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { VehiclesClient } from './VehiclesClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'vehicles' });
  return { title: t('title') };
}

export default async function VehiclesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <VehiclesClient />;
}
