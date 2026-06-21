import { defineRouting } from 'next-intl/routing';
import { createNavigation } from 'next-intl/navigation';
import { SUPPORTED_LOCALES, DEFAULT_LOCALE } from '@valloreg/shared';

/**
 * Locale-prefixed routing.
 * Locales and the default come from the shared package so the whole
 * monorepo stays in sync (hu = default, ro, en).
 */
export const routing = defineRouting({
  locales: [...SUPPORTED_LOCALES],
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: 'always',
});

export type AppLocale = (typeof routing.locales)[number];

// Locale-aware navigation helpers (Link, useRouter, redirect, usePathname).
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
