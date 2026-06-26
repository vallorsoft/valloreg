# CLAUDE.md

Guidance for AI assistants (Claude Code and others) working in this repository.

## What this is

**Valloreg** is a multi-tenant SaaS for fleet/transport service management. Users upload
service invoices (PDF/JPG/PNG); the system uses **OCR + AI** to read, categorize line items,
assign them to vehicles, and build a digital service history with minimal human review.

It also covers vehicle compliance (RO ITP/RCA/rovinietă verification), reminders, fleet
benchmarking, GDPR/DSR tooling, and PWA push notifications.

### Language conventions (important)

- **Code comments, docs, and commit messages are predominantly in Hungarian.** Match the
  surrounding language when editing a file — don't rewrite Hungarian comments into English.
- The **product UI is trilingual**: `hu` (default), `ro`, `en`. There must be **no hardcoded
  user-facing strings** — everything goes through i18n dictionaries and machine error codes.
- This file is in English; that's fine for AI guidance. Keep new code comments in the file's
  existing language.

## Tech stack

| Layer     | Technology                                              |
| --------- | ------------------------------------------------------- |
| Frontend  | Next.js 15 (App Router) · React 19 · TypeScript · TailwindCSS · PWA |
| Backend   | NestJS 11 · TypeScript · REST                           |
| Database  | PostgreSQL (Neon in prod) · Prisma ORM 6                |
| Queue     | Redis · BullMQ (async document/scan processing)         |
| Storage   | S3-compatible — MinIO locally, Cloudflare R2 in prod    |
| Auth      | JWT (access + refresh) · TOTP 2FA · RBAC                 |
| AI/OCR    | Google Gemini (vision; OCR + extraction), with stub providers |
| i18n      | next-intl · hu / ro / en                                |
| Tooling   | pnpm workspaces · Turborepo · Prettier                  |

Node **20+** (`.nvmrc` pins 22), pnpm **10+** (`packageManager: pnpm@10.33.0`).

## Monorepo layout

```
valloreg/
├── apps/
│   ├── api/    # NestJS backend (REST, Prisma, BullMQ, S3, OCR/AI ports)
│   └── web/    # Next.js PWA frontend (i18n, Tailwind brand theme)
├── packages/
│   └── shared/ # @valloreg/shared — roles, plans, feature flags, extraction
│               # contracts (zod), document rules, error codes, locales
├── docs/       # ARCHITECTURE, SECURITY, OCR_AI_ENGINE, DEPLOY, PHASE6, legal/
├── docker-compose.yml   # local infra: Postgres, Redis, MinIO, MailHog
├── render.yaml          # Render Blueprint (3 services: redis, api, web)
├── turbo.json · pnpm-workspace.yaml · tsconfig.base.json
```

`@valloreg/shared` is the single source of truth for contracts shared by both apps. It builds
to CommonJS so both NestJS (CJS) and Next.js can consume it. **Both apps depend on
`@valloreg/shared` via `workspace:*` — it must be built before they typecheck/build.**

## Common commands

Run from the repo root (Turborepo orchestrates per-package tasks):

```bash
pnpm install              # install all workspaces
cp .env.example .env      # set up env vars (see below)

pnpm infra:up             # start Postgres, Redis, MinIO, MailHog (docker)
pnpm db:migrate           # prisma migrate dev (api)
pnpm db:seed              # seed sample data
pnpm dev                  # run API + web together (turbo, persistent)

pnpm build                # build all packages (respects ^build deps)
pnpm typecheck            # tsc --noEmit everywhere
pnpm lint                 # lint (currently a no-op echo in each package)
pnpm test                 # test (api/web/shared have no real tests yet)
pnpm format               # prettier --write across the repo
pnpm format:check         # prettier --check (use before committing)
pnpm infra:down           # stop local infra

# DB helpers (proxy to @valloreg/api)
pnpm db:generate          # prisma generate
```

Per-app: `pnpm --filter @valloreg/api <script>`, `pnpm --filter @valloreg/web <script>`.

Local URLs: web `http://localhost:3000`, API `http://localhost:4000/api`,
MinIO console `http://localhost:9001` (valloreg / valloreg-secret), MailHog `http://localhost:8025`.

### Verification before committing

There is **no ESLint and no real test suite** (the `lint`/`test` scripts are placeholders).
The real gate is **`pnpm typecheck`** plus **`pnpm format:check`**. Always run these after
changes. The project is `strict` TypeScript with `noUncheckedIndexedAccess` and
`noImplicitOverride` on — expect the compiler to be picky.

## Architecture essentials

Three runtime units: Next.js PWA → NestJS API (REST + JWT) → Postgres / Redis+BullMQ → S3.
The BullMQ **worker runs inside the same `api` app** in a separate process mode. See
`docs/ARCHITECTURE.md` for the full diagram and the invoice-processing data flow.

### Multi-tenancy — the most important invariant

Every business record carries `tenantId`. Tenant isolation is **enforced in code, fail-closed**,
not just by schema:

- **`PrismaService`** (`apps/api/src/prisma/prisma.service.ts`) exposes two clients:
  - `prisma.scoped` — a `$extends` query extension that injects `tenantId` into every
    read/write of tenant-scoped models. **All business repositories must use `scoped`.**
  - `prisma.system` — the raw, unscoped client. Use **only** for global models (`User`,
    `RefreshToken`) or deliberate cross-tenant operations (e.g. membership checks in guards).
    `prisma.runUnscoped(cb)` makes that intent explicit at the call site.
- If a tenant-scoped model is queried **without** an active tenant context, the extension
  **throws** (fail-closed) — no silent cross-tenant leak.
- The tenant-scoped model list lives in `TENANT_SCOPED_MODELS` in `prisma.service.ts`. **When
  you add a new business model to the schema, add it to that set** (and give it `tenantId` +
  `@@index([tenantId])`).
- Tenant context flows via `AsyncLocalStorage` (`TenantContextService`): the
  `TenantContextMiddleware` opens an empty ALS holder for every request; the `TenantGuard`
  reads the `x-tenant-id` header, verifies membership on `prisma.system`, loads the role, and
  populates the holder. Everything downstream (including `scoped`) sees it automatically.

### Request guard pipeline (order matters)

Controllers compose guards in this order:
`@UseGuards(JwtAuthGuard, TenantGuard, RolesGuard, FeatureGuard)`

- `JwtAuthGuard` → sets `request.user` (skip with `@Public()`).
- `TenantGuard` → verifies membership, sets `request.tenant` + ALS context.
- `RolesGuard` → enforces `@Roles(TenantRole.OWNER, ...)` metadata.
- `FeatureGuard` → enforces `@RequireFeature(FeatureKey.X)` against the tenant's plan/overrides.
- `PlatformAdminGuard` → separate, for Super Admin (platform operator) routes.

Use decorators from `apps/api/src/common/decorators/`: `@CurrentUser()`, `@CurrentTenant()`,
`@Roles()`, `@RequireFeature()`, `@Public()`.

### Provider "ports" pattern (OCR / AI / verification / recall)

External/AI capabilities are abstracted behind **interface ports** with a DI token and
multiple implementations, selected by env via a `useFactory` in the module:

- `EXTRACTION_PROVIDER`, `VEHICLE_EXTRACTION_PROVIDER`, `COMPLIANCE_EXTRACTION_PROVIDER`
  (`extraction.module.ts`) → `stub` (deterministic, key-free) or `gemini`.
- Verification (`verification/providers/`), recall benchmark (`benchmark/providers/`) follow
  the same shape.
- **Fallback rule:** if `gemini` is selected but `GEMINI_API_KEY` is missing, the factory
  **falls back to the stub and warns** — deploys never fail for a missing key. Preserve this
  behavior when adding providers.

### Document processing flow

Upload → presigned S3 URL → `Document` record (`UPLOADED`, with `tenantId`) → enqueue on the
`documents` BullMQ queue (idempotency key = document hash) → worker runs OCR → Extraction →
categorization/matching → status `AUTO_OK` / `NEEDS_REVIEW` / `NOT_INVOICE` / `DUPLICATE` →
user review → `CONFIRMED`. Every step is audit-logged. `DocumentStatus` enum lives in the
Prisma schema and mirrors `@valloreg/shared`.

## Conventions to follow

- **Shared contracts first.** Roles, plan tiers/limits, feature keys, error codes, locales,
  and extraction JSON shapes (zod) live in `packages/shared/src/`. Prisma enums are kept
  **string-identical** to these constants. Change the contract in `shared`, then propagate.
- **Errors are machine codes, not prose.** The API returns `ApiErrorBody { code, message,
  details? }` with an `ErrorCode` from `@valloreg/shared`. Throw via `AppException`
  (`common/exceptions/app.exception.ts`); the global `AllExceptionsFilter` shapes the response.
  The web client maps `code` → i18n string (`lib/api.ts`). Add new codes to `shared/errors.ts`
  **and** to each `messages/*.json` `errors` block.
- **No hardcoded UI text.** Add keys to all three `apps/web/src/messages/{hu,ro,en}.json`.
- **NestJS module-per-domain.** Each domain is a self-contained module (controller + service +
  `dto/`); register it in `app.module.ts`. DTOs use `class-validator`; global `ValidationPipe`
  whitelists and transforms.
- **New API routes** are JWT + tenant-scoped by default — apply the guard stack and use
  `prisma.scoped`. Only auth/health are `@Public()`/unscoped.
- **Next.js App Router** under `apps/web/src/app/[locale]/`, with route groups `(auth)` and
  `(app)`. Pages are server components that delegate to `*Client.tsx` client components.
  Use locale-aware navigation from `i18n/routing.ts` (`Link`, `useRouter`, `redirect`).
- **Formatting:** Prettier — single quotes, semicolons, trailing commas (`all`), width 100,
  2-space indent, LF. Run `pnpm format` before committing.

## Database / Prisma notes

- Schema: `apps/api/prisma/schema.prisma`. Migrations in `apps/api/prisma/migrations/`.
- Two URLs: `DATABASE_URL` = **pooled** Neon endpoint (must include `pgbouncer=true`, or
  interactive transactions like registration fail with a "prepared statement" 500);
  `DIRECT_URL` = direct endpoint for migrations. `PrismaService.withPgBouncer` auto-appends
  `pgbouncer=true` to `-pooler.` URLs.
- After schema changes: `pnpm db:migrate` (dev) and the generated client updates via
  `prisma generate` (runs on `postinstall`). In prod, migrations run at **startup**
  (`prisma:deploy`), not at build time — see `render.yaml`.
- Add new business models with `tenantId`, `@@index([tenantId])`, **and** register them in
  `TENANT_SCOPED_MODELS` (see Multi-tenancy above).

## Configuration & secrets

- Copy `.env.example` → `.env`. It documents every variable with inline notes (DB pooling,
  R2/MinIO, JWT, Gemini model chain, VAPID push, Brevo email, bank-transfer billing, GDPR
  retention windows). Env is validated by `apps/api/src/config/env.validation.ts` and surfaced
  through `AppConfigService` — **read config via that service, not `process.env` directly.**
- **Never commit real secrets.** Production secrets live in Render env vars (`sync: false`).
- Key toggles: `EXTRACTION_PROVIDER`/`OCR_PROVIDER` (`stub`|`gemini`),
  `BENCHMARK_RECALL_PROVIDER` (`stub`|`external`).

## Deployment

Render Blueprint (`render.yaml`) provisions three services in `frankfurt` (free tier):
`valloreg-redis`, `valloreg-api` (build runs `shared build` → `prisma:generate` → `api build`;
start runs `prisma:deploy` non-fatally then `node apps/api/dist/main.js`), and `valloreg-web`.
DB is external (Neon). The `keep-alive` GitHub Action pings `/api/health` every ~14 min to
fight Render free-tier spin-down. Full steps: `docs/DEPLOY.md`.

## Where to read more

- `docs/ARCHITECTURE.md` — layers, data flow, scaling.
- `docs/SECURITY.md` — tenant isolation, Super Admin boundaries (operator can't see invoice
  contents), GDPR.
- `docs/OCR_AI_ENGINE.md` — the OCR/AI extraction engine.
- `docs/DEPLOY.md` — Render + Neon + R2 deployment.
- `ROADMAP.md` — phased plan and feature status.
- `docs/legal/` and `apps/web/src/lib/legal/` — GDPR/compliance content.

## Git workflow for this environment

- Develop on the assigned feature branch; create it locally if missing.
- Commit with clear, descriptive messages (match the repo's Hungarian style where natural).
- Push with `git push -u origin <branch>`; retry with backoff on network errors.
- **Do not open a pull request unless explicitly asked.**
