import type { Metadata, Viewport } from 'next';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, setRequestLocale } from 'next-intl/server';
import { isSupportedLocale, SUPPORTED_LOCALES } from '@valloreg/shared';
import '../globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Valloreg',
    template: '%s · Valloreg',
  },
  description:
    'OCR + AI alapú szervizmenedzsment fuvarozóknak és flottakezelőknek.',
  manifest: '/manifest.webmanifest',
  applicationName: 'Valloreg',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Valloreg',
  },
  icons: {
    icon: '/icons/icon.svg',
    apple: '/icons/icon.svg',
  },
};

export const viewport: Viewport = {
  themeColor: '#F97316',
  width: 'device-width',
  initialScale: 1,
};

// Statically render all supported locales.
export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!isSupportedLocale(locale)) {
    notFound();
  }

  // Enable static rendering for this locale.
  setRequestLocale(locale);

  const messages = await getMessages();

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className="min-h-screen bg-light font-sans text-anthracite-900 antialiased">
        <NextIntlClientProvider locale={locale} messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

export const dynamicParams = false;
