import { notFound } from 'next/navigation';
import { setRequestLocale, getTranslations } from 'next-intl/server';
import { MarketingHeader } from '@/components/landing/MarketingHeader';
import { MarketingFooter } from '@/components/landing/MarketingFooter';
import { CookieSettingsButton } from '@/components/consent/CookieSettingsButton';

const SLUGS = ['cookies', 'privacy'] as const;
type Slug = (typeof SLUGS)[number];

// A jogi információs oldalakat statikusan rendereljük minden locale-ra.
export function generateStaticParams() {
  return SLUGS.map((slug) => ({ slug }));
}

export const dynamicParams = false;

const OPERATOR = 'VALLOR TEAM SRL';
const OPERATOR_DETAILS = 'CUI 47859317 · J2023000114142 · Sat Arcuș, jud. Covasna, România';
const CONTACT_EMAIL = 'vallorsoft@gmail.com';

export default async function LegalPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  if (!SLUGS.includes(slug as Slug)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations('legal');
  const isCookies = slug === 'cookies';
  const section = isCookies ? 'cookies' : 'privacy';

  return (
    <>
      <MarketingHeader />
      <main className="container-page py-16">
        <article className="mx-auto max-w-3xl space-y-8">
          <header className="space-y-3">
            <h1 className="text-3xl font-bold text-anthracite-900">
              {t(`${section}.title`)}
            </h1>
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              {t('reviewBanner')}
            </div>
          </header>

          <p className="text-base text-anthracite-700">
            {t(`${section}.intro`)}
          </p>

          {isCookies ? (
            <section className="space-y-4">
              <h2 className="text-xl font-semibold text-anthracite-900">
                {t('cookies.tableTitle')}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-anthracite-200 text-left text-anthracite-500">
                      <th className="py-2 pr-4 font-medium">{t('cookies.colName')}</th>
                      <th className="py-2 pr-4 font-medium">{t('cookies.colType')}</th>
                      <th className="py-2 pr-4 font-medium">{t('cookies.colPurpose')}</th>
                      <th className="py-2 font-medium">{t('cookies.colRetention')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(t.raw('cookies.rows') as string[][]).map((row, i) => (
                      <tr key={i} className="border-b border-anthracite-100 align-top">
                        {row.map((cell, j) => (
                          <td key={j} className="py-2 pr-4 text-anthracite-700">
                            {cell}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-sm text-anthracite-600">{t('cookies.manage')}</p>
              <CookieSettingsButton label={t('cookies.manage')} />
            </section>
          ) : (
            <>
              <section className="space-y-2">
                <h2 className="text-xl font-semibold text-anthracite-900">
                  {t('privacy.dataTitle')}
                </h2>
                <p className="text-anthracite-700">{t('privacy.data')}</p>
              </section>
              <section className="space-y-2">
                <h2 className="text-xl font-semibold text-anthracite-900">
                  {t('privacy.rightsTitle')}
                </h2>
                <p className="text-anthracite-700">{t('privacy.rights')}</p>
              </section>
            </>
          )}

          <footer className="space-y-1 border-t border-anthracite-100 pt-6 text-sm text-anthracite-500">
            <p>
              <span className="font-medium text-anthracite-700">{t('operator')}:</span>{' '}
              {OPERATOR} — {OPERATOR_DETAILS}
            </p>
            <p>
              <span className="font-medium text-anthracite-700">{t('contact')}:</span>{' '}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary-700 underline">
                {CONTACT_EMAIL}
              </a>
            </p>
          </footer>
        </article>
      </main>
      <MarketingFooter />
    </>
  );
}
