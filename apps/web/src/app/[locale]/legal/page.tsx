import type { Metadata } from 'next';
import { setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { MarketingHeader } from '@/components/landing/MarketingHeader';
import { MarketingFooter } from '@/components/landing/MarketingFooter';
import { LEGAL_CATEGORIES, getDocsByCategory } from '@/lib/legal';
import { SUPPORTED_LOCALES } from '@valloreg/shared';

export function generateStaticParams() {
  return SUPPORTED_LOCALES.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: 'Documente legale și GDPR',
  description:
    'Politici, registre și proceduri de conformitate GDPR, securitate și AI ale Valloreg.',
};

export default async function LegalHubPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <>
      <MarketingHeader />
      <main className="bg-light">
        <section className="container-page max-w-4xl py-14">
          <h1 className="text-3xl font-bold text-anthracite-900">
            Documente legale și de conformitate
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-anthracite-600">
            Pachetul complet de politici, registre și proceduri GDPR, de
            securitate și privind inteligența artificială (EU AI Act),
            conform GDPR, Legii 190/2018 și Directivei ePrivacy. Documentele
            sunt redactate în limba română și sunt pregătite pentru revizuire
            juridică.
          </p>

          <div className="mt-10 space-y-10">
            {LEGAL_CATEGORIES.map((cat) => {
              const docs = getDocsByCategory(cat.key);
              if (docs.length === 0) return null;
              return (
                <div key={cat.key}>
                  <h2 className="text-lg font-bold text-anthracite-900">
                    {cat.title}
                  </h2>
                  <p className="mt-1 text-sm text-anthracite-500">
                    {cat.description}
                  </p>
                  <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                    {docs.map((doc) => (
                      <li key={doc.slug}>
                        <Link
                          href={`/legal/${doc.slug}`}
                          className="block h-full rounded-xl border border-anthracite-100 bg-white p-4 transition-colors hover:border-primary-300 hover:bg-primary-50"
                        >
                          <span className="block text-sm font-semibold text-anthracite-900">
                            {doc.title}
                          </span>
                          <span className="mt-1 block text-xs leading-relaxed text-anthracite-500">
                            {doc.summary}
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}
