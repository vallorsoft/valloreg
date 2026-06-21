/** Támogatott nyelvek. Minden UI szöveg ezekből a dictionary-kből jön. */
export const Locale = {
  HU: 'hu',
  RO: 'ro',
  EN: 'en',
} as const;

export type Locale = (typeof Locale)[keyof typeof Locale];

export const SUPPORTED_LOCALES: readonly Locale[] = Object.values(Locale);

export const DEFAULT_LOCALE: Locale = Locale.HU;

export function isSupportedLocale(value: string): value is Locale {
  return (SUPPORTED_LOCALES as readonly string[]).includes(value);
}
