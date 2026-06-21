import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Button } from '@/components/ui/Button';

export default function LocaleNotFound() {
  const t = useTranslations('common');
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <p className="text-6xl font-bold text-primary-600">404</p>
      <p className="max-w-md text-anthracite-600">{t('tagline')}</p>
      <Link href="/">
        <Button>{t('nav.dashboard')}</Button>
      </Link>
    </main>
  );
}
