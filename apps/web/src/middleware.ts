import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

// Locale negotiation + prefixing middleware.
export default createMiddleware(routing);

export const config = {
  // Match everything except API routes, Next internals, the PWA service worker
  // and other static assets at the root of /public.
  matcher: [
    '/((?!api|_next|_vercel|manifest.webmanifest|sw.js|workbox-.*|icons|.*\\..*).*)',
  ],
};
