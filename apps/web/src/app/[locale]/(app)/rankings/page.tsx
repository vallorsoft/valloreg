import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { RankingsClient } from './RankingsClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'rankings' });
  return { title: t('title') };
}

export default async function RankingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <RankingsClient />;
}
