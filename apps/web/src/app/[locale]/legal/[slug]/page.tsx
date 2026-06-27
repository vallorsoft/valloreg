import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { MarketingHeader } from '@/components/landing/MarketingHeader';
import { MarketingFooter } from '@/components/landing/MarketingFooter';
import { LegalDocView } from '@/components/legal/LegalDocView';
import { fetchPublicLegalDoc } from '@/lib/legal-api';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const doc = await fetchPublicLegalDoc(slug);
  if (!doc) return {};
  return { title: doc.title, description: doc.summary };
}

export default async function LegalDocPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);

  const doc = await fetchPublicLegalDoc(slug);
  if (!doc) notFound();

  return (
    <>
      <MarketingHeader />
      <main className="bg-light">
        <div className="container-page max-w-3xl pt-8">
          <Link
            href="/legal"
            className="text-sm font-medium text-primary-600 hover:text-primary-700"
          >
            ← Toate documentele legale
          </Link>
        </div>
        <LegalDocView doc={doc} />
      </main>
      <MarketingFooter />
    </>
  );
}
