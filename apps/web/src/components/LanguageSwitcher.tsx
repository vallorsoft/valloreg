'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { SUPPORTED_LOCALES, type Locale } from '@valloreg/shared';
import { usePathname, useRouter } from '@/i18n/routing';
import { cn } from '@/lib/cn';

/**
 * Locale switcher. Re-navigates to the same pathname under the chosen locale
 * using next-intl's locale-aware router (preserves the route, swaps the prefix).
 */
export function LanguageSwitcher({ className }: { className?: string }) {
  const t = useTranslations('common.language');
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  function onChange(next: Locale) {
    if (next === locale) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div
      className={cn('inline-flex items-center gap-1', className)}
      role="group"
      aria-label={t('label')}
    >
      {SUPPORTED_LOCALES.map((code) => {
        const active = code === locale;
        return (
          <button
            key={code}
            type="button"
            onClick={() => onChange(code)}
            disabled={isPending}
            aria-current={active ? 'true' : undefined}
            aria-label={t(code)}
            className={cn(
              'rounded-md px-2 py-1 text-xs font-semibold uppercase transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500',
              active
                ? 'bg-primary-600 text-white'
                : 'text-anthracite-500 hover:bg-anthracite-100 hover:text-anthracite-800',
            )}
          >
            {code}
          </button>
        );
      })}
    </div>
  );
}
