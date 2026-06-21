'use client';

import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/Button';
import { clearTokens } from '@/lib/auth';

export function TopNav({ onMenuClick }: { onMenuClick: () => void }) {
  const t = useTranslations('app');
  const router = useRouter();

  function onLogout() {
    clearTokens();
    router.push('/login');
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-anthracite-100 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onMenuClick}
          aria-label={t('header.menu')}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-anthracite-700 hover:bg-anthracite-100 lg:hidden"
        >
          <span aria-hidden="true" className="text-xl">
            ☰
          </span>
        </button>
        <p className="hidden text-sm text-anthracite-500 sm:block">
          {t('header.tenantLabel')}:{' '}
          <span className="font-medium text-anthracite-800">
            {t('header.noTenant')}
          </span>
        </p>
      </div>
      <div className="flex items-center gap-3">
        <LanguageSwitcher />
        <Button variant="outline" size="sm" onClick={onLogout}>
          {t('nav.logout')}
        </Button>
      </div>
    </header>
  );
}
