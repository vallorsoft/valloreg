import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Logo } from '@/components/Logo';

export function MarketingFooter() {
  const t = useTranslations('common');
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-anthracite-100 bg-white">
      <div className="container-page grid gap-8 py-12 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-3">
          <Logo />
          <p className="max-w-xs text-sm text-anthracite-500">
            {t('footer.tagline')}
          </p>
        </div>

        <nav aria-label={t('footer.product')} className="space-y-3 text-sm">
          <p className="font-semibold text-anthracite-900">
            {t('footer.product')}
          </p>
          <a href="#features" className="block text-anthracite-500 hover:text-anthracite-900">
            {t('nav.features')}
          </a>
          <a href="#pricing" className="block text-anthracite-500 hover:text-anthracite-900">
            {t('nav.pricing')}
          </a>
          <a href="#faq" className="block text-anthracite-500 hover:text-anthracite-900">
            {t('nav.faq')}
          </a>
        </nav>

        <nav aria-label={t('footer.company')} className="space-y-3 text-sm">
          <p className="font-semibold text-anthracite-900">
            {t('footer.company')}
          </p>
          <a href="#contact" className="block text-anthracite-500 hover:text-anthracite-900">
            {t('nav.contact')}
          </a>
          <span className="block text-anthracite-500">{t('footer.about')}</span>
        </nav>

        <nav aria-label={t('footer.legal')} className="space-y-3 text-sm">
          <p className="font-semibold text-anthracite-900">
            {t('footer.legal')}
          </p>
          <Link
            href="/legal/confidentialitate"
            className="block text-anthracite-500 hover:text-anthracite-900"
          >
            {t('footer.privacy')}
          </Link>
          <Link
            href="/legal/termeni-si-conditii"
            className="block text-anthracite-500 hover:text-anthracite-900"
          >
            {t('footer.terms')}
          </Link>
          <Link
            href="/legal/cookie"
            className="block text-anthracite-500 hover:text-anthracite-900"
          >
            {t('footer.cookies')}
          </Link>
          <Link
            href="/legal"
            className="block text-anthracite-500 hover:text-anthracite-900"
          >
            {t('footer.allLegal')}
          </Link>
        </nav>
      </div>

      <div className="border-t border-anthracite-100">
        <div className="container-page flex flex-col items-center justify-between gap-3 py-6 text-sm text-anthracite-500 sm:flex-row">
          <p>
            © {year} {t('appName')}. {t('footer.rights')}
          </p>
          <Link href="/login" className="hover:text-anthracite-900">
            {t('nav.login')}
          </Link>
        </div>
      </div>
    </footer>
  );
}
