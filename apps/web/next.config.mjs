import createNextIntlPlugin from 'next-intl/plugin';
import withPWAInit from '@ducanh2912/next-pwa';

// next-intl: point to the request config that loads the message dictionaries.
const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

// PWA: generate a service worker into /public and register the manifest.
// Disabled in development to avoid caching noise during local work.
const withPWA = withPWAInit({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  workboxOptions: {
    disableDevLogs: true,
  },
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The shared workspace package ships TypeScript-compiled CJS; transpile it so
  // Next can bundle it consistently across server and client.
  transpilePackages: ['@valloreg/shared'],
  experimental: {
    typedRoutes: false,
  },
};

export default withPWA(withNextIntl(nextConfig));
