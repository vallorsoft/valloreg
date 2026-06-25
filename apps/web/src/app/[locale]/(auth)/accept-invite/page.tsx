import { Suspense } from 'react';
import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { AcceptInviteForm } from '@/components/auth/AcceptInviteForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.acceptInvite' });
  return { title: t('title') };
}

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // Az AcceptInviteForm useSearchParams()-t használ (token a query-ből), ezért
  // Suspense boundary kell köré a Next.js App Routerben.
  return (
    <Suspense>
      <AcceptInviteForm />
    </Suspense>
  );
}
