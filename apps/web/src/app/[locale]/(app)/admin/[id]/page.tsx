import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AdminTenantClient } from './AdminTenantClient';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'admin' });
  return { title: t('title') };
}

export default async function AdminTenantPage({
  params,
}: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await params;
  setRequestLocale(locale);
  return <AdminTenantClient id={id} />;
}
