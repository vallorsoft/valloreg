import { getRequestConfig } from 'next-intl/server';
import { isSupportedLocale, DEFAULT_LOCALE } from '@valloreg/shared';
import { routing } from './routing';

/**
 * next-intl request config: resolves the active locale and loads its
 * message dictionary. Falls back to the default locale for unknown values.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale =
    requested && isSupportedLocale(requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});

export { DEFAULT_LOCALE };
