import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { TeamClient } from './TeamClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'team' });
  return { title: t('title') };
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <TeamClient />;
}
