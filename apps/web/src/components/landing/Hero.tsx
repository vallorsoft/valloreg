import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';

export function Hero() {
  const t = useTranslations('landing.hero');

  return (
    <section className="relative overflow-hidden bg-light">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-primary-100 blur-3xl"
      />
      <div className="container-page relative grid gap-10 py-20 lg:grid-cols-2 lg:items-center lg:py-28">
        <div className="space-y-6">
          <span className="inline-flex items-center rounded-full bg-primary-100 px-3 py-1 text-xs font-semibold text-primary-800">
            {t('badge')}
          </span>
          <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight text-anthracite-900 sm:text-5xl">
            {t('headline')}
          </h1>
          <p className="max-w-xl text-lg text-anthracite-600">{t('subtitle')}</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link href="/register">
              <Button size="lg" fullWidth>
                {t('ctaPrimary')}
              </Button>
            </Link>
            <a href="#contact">
              <Button size="lg" variant="outline" fullWidth>
                {t('ctaSecondary')}
              </Button>
            </a>
          </div>
          <p className="text-sm text-anthracite-500">{t('trustNote')}</p>
        </div>

        {/* Decorative product visual placeholder */}
        <div className="relative">
          <div className="rounded-2xl border border-anthracite-100 bg-white p-4 shadow-card-hover">
            <div className="brand-gradient h-3 w-24 rounded-full" />
            <div className="mt-4 grid grid-cols-2 gap-3">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-anthracite-100 bg-light p-4"
                  aria-hidden="true"
                >
                  <div className="h-2 w-12 rounded-full bg-anthracite-200" />
                  <div className="mt-3 h-5 w-20 rounded bg-anthracite-300" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
