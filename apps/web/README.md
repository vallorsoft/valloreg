# @valloreg/web

Valloreg Next.js PWA frontend – marketing landing, authentication, and the
authenticated app shell (dashboard, vehicles, documents).

Phase 1 (Core Foundations) delivers the **UI shell**: every page renders, all
copy is internationalized, the PWA is installable, and the API client / auth
helpers are in place. Real data wiring (live API calls, route guards, presigned
uploads) lands in later phases — those spots are marked with `TODO` comments and
an in-app "demo view" banner (`PhaseNote`).

## Tech

- **Next.js (App Router)** + React 18 + TypeScript
- **TailwindCSS** with the Valloreg brand theme
- **next-intl** for locale-prefixed i18n (`hu` default, `ro`, `en`)
- **@ducanh2912/next-pwa** for the service worker + manifest (disabled in dev)
- `@valloreg/shared` for shared contracts (roles, plans, document status, locales,
  error codes) — imported via `@valloreg/shared`

## Scripts

```bash
pnpm --filter @valloreg/web dev        # next dev on :3000
pnpm --filter @valloreg/web build      # production build (+ service worker)
pnpm --filter @valloreg/web start      # serve the production build on :3000
pnpm --filter @valloreg/web typecheck  # tsc --noEmit
pnpm --filter @valloreg/web lint       # no-op (lint not configured yet)
```

> The shared package must be built first (`pnpm --filter @valloreg/shared build`)
> because it is consumed from its compiled `dist`. Turbo's `^build` dependency
> handles this automatically when you run `pnpm build` from the repo root.

## Environment

| Variable               | Purpose                          | Default                        |
| ---------------------- | -------------------------------- | ------------------------------ |
| `NEXT_PUBLIC_API_URL`  | REST API base URL                | `http://localhost:4000/api`    |
| `NEXT_PUBLIC_APP_NAME` | App display name (optional)      | `Valloreg`                     |

See the repo-root `.env.example`.

## Structure

```
apps/web/
├── next.config.mjs            # next-intl plugin + next-pwa wrapper, transpilePackages
├── tailwind.config.ts         # brand theme (primary/secondary/anthracite/light)
├── postcss.config.mjs
├── tsconfig.json              # extends ../../tsconfig.base.json (ESNext/Bundler, noEmit)
├── public/
│   ├── manifest.webmanifest   # PWA manifest (theme #F97316, bg #F8FAFC)
│   └── icons/icon.svg         # brand icon (SVG) — see "Icons" note below
└── src/
    ├── middleware.ts          # next-intl locale routing
    ├── global.d.ts            # typed IntlMessages (hu.json = source of truth)
    ├── i18n/
    │   ├── routing.ts         # locales + defaultLocale (from @valloreg/shared), nav helpers
    │   └── request.ts         # loads the active locale's message dictionary
    ├── messages/
    │   ├── hu.json            # Hungarian (primary)
    │   ├── ro.json            # Romanian
    │   └── en.json            # English  (identical key structure across all three)
    ├── lib/
    │   ├── api.ts             # fetch wrapper (Bearer + x-tenant-id), ApiError, auth endpoints
    │   ├── auth.ts            # token storage, active-tenant helpers, current-user types
    │   ├── validation.ts      # dependency-free client-side validators
    │   └── cn.ts              # class-name combiner
    ├── components/
    │   ├── ui/                # Button, Card, Input, Badge
    │   ├── landing/           # the 10 marketing sections + header/footer
    │   ├── auth/              # LoginForm, RegisterForm
    │   ├── app/               # AppShell, Sidebar, TopNav, page primitives, upload zone
    │   ├── LanguageSwitcher.tsx
    │   └── Logo.tsx
    └── app/
        ├── layout.tsx                         # root (forwards children)
        └── [locale]/
            ├── layout.tsx                     # <html lang>, NextIntlClientProvider, fonts
            ├── not-found.tsx
            ├── page.tsx                       # landing (10 sections)
            ├── (auth)/{login,register}/page.tsx
            └── (app)/{dashboard,vehicles,documents}/page.tsx
```

## i18n

- Routing is **locale-prefixed** (`/hu/...`, `/ro/...`, `/en/...`); `hu` is the
  default. The locale list and default come from `@valloreg/shared`
  (`SUPPORTED_LOCALES`, `DEFAULT_LOCALE`) so the whole monorepo stays in sync.
- **No hardcoded user-facing strings.** Every label, button, and message is read
  from `src/messages/{locale}.json`. All three dictionaries share the same key
  structure; `hu.json` is the typed source of truth (`src/global.d.ts`).
- Use `useTranslations('namespace')` in components and
  `getTranslations({ locale, namespace })` in async server code/metadata.
- The `LanguageSwitcher` swaps the locale prefix while preserving the route.

## PWA

- `next.config.mjs` wraps the app with `@ducanh2912/next-pwa` (`dest: 'public'`,
  `disable` in development). The service worker and Workbox files are generated
  into `public/` on `build` and are git-ignored.
- `public/manifest.webmanifest` defines name, theme color (`#F97316`),
  background (`#F8FAFC`), `display: standalone`, and `start_url: /`.

### Icons (production note)

`public/icons/icon.svg` is a scalable brand icon referenced by the manifest and
HTML metadata. **Before production, add raster PNG icons** — at minimum:

- `public/icons/icon-192.png` (192×192)
- `public/icons/icon-512.png` (512×512)
- a **maskable** variant (192/512) with adequate safe-zone padding

Then add them to `manifest.webmanifest` (`type: image/png`, correct `sizes`, and a
`purpose: maskable` entry). Binary PNGs cannot be generated from source here, so
they were intentionally left out of Phase 1; the SVG keeps the app installable in
the meantime.

## Theme

Brand colors (Tailwind tokens + CSS variables in `globals.css`):

| Token        | Hex       | Usage                              |
| ------------ | --------- | ---------------------------------- |
| `primary`    | `#F97316` | brand orange (scale 50–900)        |
| `secondary`  | `#C19A6B` | cappuccino accents                 |
| `anthracite` | `#1F2937` | text / dark contrast (scale 50–900)|
| `light`      | `#F8FAFC` | page background                    |
| `surface`    | `#FFFFFF` | cards / surfaces                   |

Buttons and badges use `*-600`+ shades for white text to meet WCAG AA contrast.

## Phase 1 TODOs (later phases)

- `lib/api.ts`: automatic refresh-token rotation on 401.
- `components/app/UploadZone.tsx`: presigned-URL upload to S3 + Document creation.
- `components/app/AppShell.tsx`: real authentication guard / session check.
- `components/landing/Contact.tsx`: submit the contact form to the API.
- Dashboard / vehicles / documents pages: replace placeholder data with live API data.
```
