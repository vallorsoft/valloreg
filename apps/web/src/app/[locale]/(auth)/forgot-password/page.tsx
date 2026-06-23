import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { ForgotPasswordForm } from '@/components/auth/ForgotPasswordForm';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.forgotPassword' });
  return { title: t('title') };
}

export default async function ForgotPasswordPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <ForgotPasswordForm />;
}
