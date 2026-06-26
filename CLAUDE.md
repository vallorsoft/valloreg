# CLAUDE.md

Útmutató AI asszisztenseknek (Claude Code és társai) ehhez a repóhoz.

## Mi ez

A **Valloreg** egy multi-tenant SaaS fuvarozói / flottakezelő szervizmenedzsmenthez. A
felhasználó szervizszámlákat tölt fel (PDF/JPG/PNG); a rendszer **OCR + AI** segítségével
kiolvassa, tételenként kategorizálja, járműhöz rendeli, és minimális emberi ellenőrzéssel
digitális szerviztörténetet épít.

Lefedi a jármű-megfelelőséget is (RO ITP/RCA/rovinietă ellenőrzés), emlékeztetőket,
flotta-benchmarkot, GDPR/DSR eszközöket és PWA push értesítéseket.

### Nyelvi konvenciók (fontos)

- **A kódkommentek, a dokumentáció és a commit üzenetek többségükben magyarul vannak.**
  Szerkesztéskor igazodj a fájl meglévő nyelvéhez – ne írd át a magyar kommenteket angolra.
- A **termék UI háromnyelvű**: `hu` (alapértelmezett), `ro`, `en`. **Nincs hardcode-olt
  felhasználói szöveg** – minden i18n dictionary-n és gépi hibakódon megy keresztül.
- Ez a fájl magyarul van; a kódkommenteket a fájl meglévő nyelvén tartsd.

## Tech stack

| Réteg     | Technológia                                             |
| --------- | ------------------------------------------------------- |
| Frontend  | Next.js 15 (App Router) · React 19 · TypeScript · TailwindCSS · PWA |
| Backend   | NestJS 11 · TypeScript · REST                           |
| Adatbázis | PostgreSQL (prod: Neon) · Prisma ORM 6                  |
| Sor       | Redis · BullMQ (aszinkron dokumentum/scan feldolgozás)  |
| Tárolás   | S3-kompatibilis – helyben MinIO, prodban Cloudflare R2  |
| Auth      | JWT (access + refresh) · TOTP 2FA · RBAC                 |
| AI/OCR    | Google Gemini (vision; OCR + extraction), stub providerekkel |
| i18n      | next-intl · hu / ro / en                                |
| Eszközök  | pnpm workspaces · Turborepo · Prettier                  |

Node **20+** (a `.nvmrc` 22-t rögzít), pnpm **10+** (`packageManager: pnpm@10.33.0`).

## Monorepo szerkezet

```
valloreg/
├── apps/
│   ├── api/    # NestJS backend (REST, Prisma, BullMQ, S3, OCR/AI portok)
│   └── web/    # Next.js PWA frontend (i18n, Tailwind brand téma)
├── packages/
│   └── shared/ # @valloreg/shared — szerepkörök, csomagok, feature flag-ek,
│               # extraction kontraktusok (zod), dokumentum-szabályok, hibakódok, locale-ok
├── docs/       # ARCHITECTURE, SECURITY, OCR_AI_ENGINE, DEPLOY, PHASE6, legal/
├── docker-compose.yml   # helyi infra: Postgres, Redis, MinIO, MailHog
├── render.yaml          # Render Blueprint (3 szolgáltatás: redis, api, web)
├── turbo.json · pnpm-workspace.yaml · tsconfig.base.json
```

A `@valloreg/shared` az egyetlen forrása a mindkét app által megosztott szerződéseknek.
CommonJS-re buildel, hogy a NestJS (CJS) és a Next.js egyaránt fogyaszthassa. **Mindkét app
`workspace:*`-on keresztül függ a `@valloreg/shared`-től – buildelni kell, mielőtt a többi
csomag typecheckel/buildel.**

## Gyakori parancsok

A repó gyökeréből (a Turborepo intézi a csomagonkénti taskokat):

```bash
pnpm install              # minden workspace telepítése
cp .env.example .env      # env változók (lásd lent)

pnpm infra:up             # Postgres, Redis, MinIO, MailHog indítása (docker)
pnpm db:migrate           # prisma migrate dev (api)
pnpm db:seed              # mintaadat seedelése
pnpm dev                  # API + web együtt (turbo, persistent)

pnpm build                # minden csomag buildje (tiszteli a ^build függőséget)
pnpm typecheck            # tsc --noEmit mindenhol
pnpm lint                 # lint (jelenleg no-op echo csomagonként)
pnpm test                 # test (api/web/shared még nem tartalmaz valódi tesztet)
pnpm format               # prettier --write a repón
pnpm format:check         # prettier --check (commit előtt)
pnpm infra:down           # helyi infra leállítása

# DB segédparancsok (a @valloreg/api-ra mutatnak)
pnpm db:generate          # prisma generate
```

Csomagonként: `pnpm --filter @valloreg/api <script>`, `pnpm --filter @valloreg/web <script>`.

Helyi URL-ek: web `http://localhost:3000`, API `http://localhost:4000/api`,
MinIO konzol `http://localhost:9001` (valloreg / valloreg-secret), MailHog `http://localhost:8025`.

### Ellenőrzés commit előtt

**Nincs ESLint és nincs valódi tesztcsomag** (a `lint`/`test` scriptek placeholderek). A valódi
kapu a **`pnpm typecheck`** és a **`pnpm format:check`**. Mindig futtasd ezeket a változtatás
után. A projekt `strict` TypeScript, bekapcsolt `noUncheckedIndexedAccess` és
`noImplicitOverride` mellett – a fordító szigorú lesz.

## Architektúra – a lényeg

Három futási egység: Next.js PWA → NestJS API (REST + JWT) → Postgres / Redis+BullMQ → S3. A
BullMQ **worker ugyanabban az `api` appban fut**, külön process-módban. A teljes diagram és a
számla-feldolgozási adatfolyam: `docs/ARCHITECTURE.md`.

### Multi-tenancy – a legfontosabb invariáns

Minden üzleti rekord `tenantId`-t hordoz. A tenant-izoláció **kódszinten, fail-closed módon**
érvényesül, nem csak a séma szintjén:

- A **`PrismaService`** (`apps/api/src/prisma/prisma.service.ts`) két klienst ad:
  - `prisma.scoped` – egy `$extends` query extension, ami minden tenant-scope-olt modell
    olvasásába/írásába injektálja a `tenantId`-t. **Minden üzleti repository ezt használja.**
  - `prisma.system` – a nyers, nem scope-olt kliens. **Kizárólag** globális modellekhez (`User`,
    `RefreshToken`) vagy szándékos cross-tenant műveletekhez (pl. membership-ellenőrzés a
    guardokban). A `prisma.runUnscoped(cb)` ezt a szándékot a hívás helyén teszi explicitté.
- Ha egy tenant-scope-olt modellt **aktív tenant kontextus nélkül** kérdezel le, a kiterjesztés
  **hibát dob** (fail-closed) – nincs néma cross-tenant szivárgás.
- A tenant-scope-olt modellek listája a `TENANT_SCOPED_MODELS` halmaz a `prisma.service.ts`-ben.
  **Ha új üzleti modellt veszel fel a sémába, ide is vedd fel** (és adj neki `tenantId`-t +
  `@@index([tenantId])`-et).
- A tenant kontextus `AsyncLocalStorage`-ben folyik (`TenantContextService`): a
  `TenantContextMiddleware` minden kérésre nyit egy üres ALS holder-t; a `TenantGuard` kiolvassa
  az `x-tenant-id` headert, ellenőrzi a membership-et a `prisma.system`-en, betölti a
  szerepkört, és feltölti a holder-t. Minden ezt követő (a `scoped` is) automatikusan látja.

### Kérés-guard pipeline (a sorrend számít)

A kontrollerek így komponálják a guardokat:
`@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, FeatureGuard)`

- `JwtAuthGuard` → beállítja a `request.user`-t (a `@Public()` kihagyja).
- `TenantGuard` → ellenőrzi a membership-et, beállítja a `request.tenant`-et + ALS kontextust.
- `RolesGuard` → érvényesíti a `@Roles(TenantRole.OWNER, ...)` metaadatot.
- `FeatureGuard` → a `@RequireFeature(FeatureKey.X)`-et a tenant csomagja/override-jai ellen.
- `PlatformAdminGuard` → külön, a Super Admin (platform-üzemeltető) útvonalakhoz.

A dekorátorok az `apps/api/src/common/decorators/`-ból: `@CurrentUser()`, `@CurrentTenant()`,
`@Roles()`, `@RequireFeature()`, `@Public()`.

### Provider „portok" minta (OCR / AI / verification / recall)

A külső/AI képességek **interfész-portok** mögött vannak, DI tokennel és több
implementációval, amelyeket env alapján egy `useFactory` választ ki a modulban:

- `EXTRACTION_PROVIDER`, `VEHICLE_EXTRACTION_PROVIDER`, `COMPLIANCE_EXTRACTION_PROVIDER`
  (`extraction.module.ts`) → `stub` (determinisztikus, kulcs nélkül fut) vagy `gemini`.
- A verification (`verification/providers/`) és a recall-benchmark (`benchmark/providers/`)
  ugyanezt a formát követi.
- **Fallback szabály:** ha `gemini` van kiválasztva, de hiányzik a `GEMINI_API_KEY`, a factory
  **a stubra esik vissza és figyelmeztet** – a deploy sosem bukik el hiányzó kulcs miatt. Új
  provider hozzáadásakor tartsd meg ezt a viselkedést.

### Dokumentum-feldolgozási folyamat

Upload → presigned S3 URL → `Document` rekord (`UPLOADED`, `tenantId`-vel) → enqueue a
`documents` BullMQ sorra (idempotencia-kulcs = dokumentum-hash) → worker: OCR → Extraction →
kategorizálás/matching → státusz `AUTO_OK` / `NEEDS_REVIEW` / `NOT_INVOICE` / `DUPLICATE` →
felhasználói review → `CONFIRMED`. Minden lépés audit-logba kerül. A `DocumentStatus` enum a
Prisma sémában van, és tükrözi a `@valloreg/shared`-et.

## Követendő konvenciók

- **Először a megosztott szerződés.** A szerepkörök, csomag-szintek/limitek, feature kulcsok,
  hibakódok, locale-ok és az extraction JSON alakok (zod) a `packages/shared/src/`-ben élnek. A
  Prisma enumok **string-azonosak** ezekkel a konstansokkal. Előbb a `shared`-ben módosíts,
  utána propagálj.
- **A hibák gépi kódok, nem prózák.** Az API `ApiErrorBody { code, message, details? }`-t ad
  vissza `@valloreg/shared` `ErrorCode`-dal. Dobj `AppException`-nel
  (`common/exceptions/app.exception.ts`); a globális `AllExceptionsFilter` formázza a választ. A
  webkliens a `code`-ot i18n stringre mappeli (`lib/api.ts`). Új kódot a `shared/errors.ts`-be
  **és** minden `messages/*.json` `errors` blokkjába vegyél fel.
- **Nincs hardcode-olt UI szöveg.** Kulcsokat mindhárom `apps/web/src/messages/{hu,ro,en}.json`-be.
- **NestJS domain-enkénti modul.** Minden domain önálló modul (controller + service + `dto/`);
  regisztráld az `app.module.ts`-ben. A DTO-k `class-validator`-t használnak; a globális
  `ValidationPipe` whitelistel és transzformál.
- **Az új API útvonalak** alapból JWT + tenant-scope-oltak – tedd rá a guard stacket és használj
  `prisma.scoped`-et. Csak az auth/health `@Public()`/nem scope-olt.
- **Next.js App Router** az `apps/web/src/app/[locale]/` alatt, `(auth)` és `(app)` route
  csoportokkal. Az oldalak server komponensek, amelyek a `*Client.tsx` kliens komponensekre
  delegálnak. Locale-tudatos navigáció az `i18n/routing.ts`-ből (`Link`, `useRouter`, `redirect`).
- **Formázás:** Prettier – single quote, pontosvessző, trailing comma (`all`), 100 szélesség,
  2 szóköz, LF. Commit előtt `pnpm format`.

## Adatbázis / Prisma jegyzetek

- Séma: `apps/api/prisma/schema.prisma`. Migrációk: `apps/api/prisma/migrations/`.
- Két URL: `DATABASE_URL` = **pooled** Neon endpoint (kötelező a `pgbouncer=true`, különben az
  interaktív tranzakciók – pl. regisztráció – „prepared statement" 500-zal elhasalnak);
  `DIRECT_URL` = direct endpoint a migrációkhoz. A `PrismaService.withPgBouncer` automatikusan
  hozzáfűzi a `pgbouncer=true`-t a `-pooler.` URL-ekhez.
- Sémaváltozás után: `pnpm db:migrate` (dev), a generált kliens a `prisma generate`-tel frissül
  (a `postinstall` futtatja). Prodban a migráció **indításkor** fut (`prisma:deploy`), nem
  buildkor – lásd `render.yaml`.
- Új üzleti modellt `tenantId`-vel, `@@index([tenantId])`-vel **és** a `TENANT_SCOPED_MODELS`-be
  felvéve adj hozzá (lásd Multi-tenancy fent).

## Konfiguráció és titkok

- Másold a `.env.example`-t `.env`-be. Minden változót dokumentál inline jegyzetekkel (DB
  pooling, R2/MinIO, JWT, Gemini modell-lánc, VAPID push, Brevo email, utalásos billing, GDPR
  retenciós ablakok). Az env-et az `apps/api/src/config/env.validation.ts` validálja, és az
  `AppConfigService`-en keresztül érhető el – **a konfigot ezen a service-en át olvasd, ne
  közvetlenül `process.env`-ből.**
- **Soha ne commitolj valódi titkot.** A production titkok Render env változókban élnek
  (`sync: false`).
- Fő kapcsolók: `EXTRACTION_PROVIDER`/`OCR_PROVIDER` (`stub`|`gemini`),
  `BENCHMARK_RECALL_PROVIDER` (`stub`|`external`).

## Deploy

A Render Blueprint (`render.yaml`) három szolgáltatást hoz létre `frankfurt`-ban (free tier):
`valloreg-redis`, `valloreg-api` (build: `shared build` → `prisma:generate` → `api build`;
start: nem-fatális `prisma:deploy`, majd `node apps/api/dist/main.js`) és `valloreg-web`. A DB
külső (Neon). A `keep-alive` GitHub Action ~14 percenként pingeli a `/api/health`-et a Render
free-tier spin-down ellen. Részletek: `docs/DEPLOY.md`.

## További olvasnivaló

- `docs/ARCHITECTURE.md` — rétegek, adatfolyam, skálázás.
- `docs/SECURITY.md` — tenant-izoláció, Super Admin határok (az üzemeltető NEM látja a számlák
  tartalmát), GDPR.
- `docs/OCR_AI_ENGINE.md` — az OCR/AI extraction motor.
- `docs/DEPLOY.md` — Render + Neon + R2 deploy.
- `ROADMAP.md` — fázisos terv és a funkciók státusza.
- `docs/legal/` és `apps/web/src/lib/legal/` — GDPR/megfelelőség tartalom.

## Git workflow ehhez a környezethez

- A kijelölt feature branchen fejlessz; ha hiányzik, hozd létre helyben.
- Commitolj világos, leíró üzenettel (igazodj a repó magyar stílusához, ahol természetes).
- Pushold `git push -u origin <branch>`-csel; hálózati hibánál backoff-fal próbálkozz újra.
- **Ne nyiss pull requestet, csak ha kifejezetten kérik.**
