'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/routing';
import { Logo } from '@/components/Logo';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/cn';

const SECTIONS = [
  { id: 'features', key: 'features' },
  { id: 'pricing', key: 'pricing' },
  { id: 'faq', key: 'faq' },
  { id: 'contact', key: 'contact' },
] as const;

export function MarketingHeader() {
  const t = useTranslations('common.nav');
  const [open, setOpen] = useState(false);

  return (
    <header className="sticky top-0 z-40 border-b border-anthracite-100 bg-white/90 backdrop-blur">
      <nav className="container-page flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="Valloreg">
          <Logo />
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="text-sm font-medium text-anthracite-600 transition-colors hover:text-anthracite-900"
            >
              {t(s.key)}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <LanguageSwitcher />
          <Link href="/login">
            <Button variant="ghost" size="sm">
              {t('login')}
            </Button>
          </Link>
          <Link href="/register">
            <Button size="sm">{t('register')}</Button>
          </Link>
        </div>

        <button
          type="button"
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg text-anthracite-700 hover:bg-anthracite-100 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={t('features')}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden="true" className="text-xl">
            {open ? '✕' : '☰'}
          </span>
        </button>
      </nav>

      <div
        id="mobile-menu"
        className={cn(
          'border-t border-anthracite-100 bg-white md:hidden',
          open ? 'block' : 'hidden',
        )}
      >
        <div className="container-page flex flex-col gap-2 py-4">
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="rounded-lg px-2 py-2 text-sm font-medium text-anthracite-700 hover:bg-anthracite-50"
              onClick={() => setOpen(false)}
            >
              {t(s.key)}
            </a>
          ))}
          <div className="mt-2 flex items-center justify-between">
            <LanguageSwitcher />
          </div>
          <div className="mt-2 flex gap-2">
            <Link href="/login" className="flex-1">
              <Button variant="outline" size="sm" fullWidth>
                {t('login')}
              </Button>
            </Link>
            <Link href="/register" className="flex-1">
              <Button size="sm" fullWidth>
                {t('register')}
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  );
}
