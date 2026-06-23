import { Suspense } from 'react';
import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.resetPassword' });
  return { title: t('title') };
}

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  // A ResetPasswordForm useSearchParams()-t használ (token a query-ből), ezért
  // Suspense boundary kell köré a Next.js App Routerben.
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
