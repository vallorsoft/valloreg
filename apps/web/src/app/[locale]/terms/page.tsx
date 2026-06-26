import type { Metadata } from 'next';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { MarketingHeader } from '@/components/landing/MarketingHeader';
import { MarketingFooter } from '@/components/landing/MarketingFooter';

interface LegalSection {
  heading: string;
  body: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'legal.terms' });
  return { title: t('title') };
}

export default async function TermsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations({ locale, namespace: 'legal' });
  const tc = await getTranslations({ locale, namespace: 'common' });
  const email = tc('contactEmail');
  const sections = t.raw('terms.sections') as LegalSection[];

  return (
    <>
      <MarketingHeader />
      <main className="bg-white py-16">
        <article className="container-page mx-auto max-w-3xl">
          <h1 className="text-3xl font-bold text-anthracite-900">
            {t('terms.title')}
          </h1>
          <p className="mt-2 text-sm text-anthracite-500">{t('lastUpdated')}</p>
          <p className="mt-6 text-anthracite-700">{t('terms.intro')}</p>

          <div className="mt-10 space-y-8">
            {sections.map((section, i) => (
              <section key={i} className="space-y-2">
                <h2 className="text-xl font-semibold text-anthracite-900">
                  {section.heading}
                </h2>
                <p className="text-anthracite-700">
                  {section.body.replace('{email}', email)}
                </p>
              </section>
            ))}
          </div>

          <p className="mt-12 text-sm">
            <Link
              href="/"
              className="font-semibold text-primary-700 hover:text-primary-800"
            >
              {t('backToHome')}
            </Link>
          </p>
        </article>
      </main>
      <MarketingFooter />
    </>
  );
}
