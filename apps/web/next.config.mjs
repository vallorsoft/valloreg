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

// KAPCSOLÓ: same-origin auth proxy. Ha be van kapcsolva, a böngésző a saját
// originjáról hívja a /api/auth/* végpontokat, amit a Next az API-ra proxyz – így
// a refresh cookie first-party (SameSite=Lax), nincs harmadik-fél-cookie gond.
// CSAK az auth-végpontokat proxyzzuk (mind POST), hogy a service worker ne
// cache-eljen adat-GET-eket; minden más hívás marad a közvetlen (cross-origin)
// úton az access tokennel.
const SAME_ORIGIN_AUTH =
  process.env.NEXT_PUBLIC_SAME_ORIGIN_AUTH === 'true' ||
  process.env.NEXT_PUBLIC_SAME_ORIGIN_AUTH === '1';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Csökkenti a webpack csúcs-memóriahasználatát build közben (kicsit lassabb
  // build, de elkerüli az OOM-ot a korlátozott erőforrású Render-free buildnél).
  experimental: {
    webpackMemoryOptimizations: true,
  },
  // The shared workspace package ships TypeScript-compiled CJS; transpile it so
  // Next can bundle it consistently across server and client.
  transpilePackages: ['@valloreg/shared'],
  typedRoutes: false,
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!SAME_ORIGIN_AUTH || !apiUrl) return [];
    const base = apiUrl.replace(/\/+$/, '');
    return [{ source: '/api/auth/:path*', destination: `${base}/auth/:path*` }];
  },
};

export default withPWA(withNextIntl(nextConfig));
