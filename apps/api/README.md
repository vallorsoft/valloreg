# @valloreg/api – NestJS backend

A Valloreg multi-tenant SaaS backendje: hitelesítés, cégen belüli RBAC,
tenant-izoláció, csomag-limitek, feature flag-ek, és a dokumentum-feldolgozó
pipeline (OCR → AI extraction → kategorizálás) BullMQ-val.

> Fázis 1 (Core Foundations). Az OCR és extraction Fázis 1-ben **stub**
> providerrel fut, de a teljes pipeline (queue, státuszok, perzisztálás)
> végigfut és tesztelhető.

## Gyors start

```bash
# A repo gyökeréből (egyszeri install + infra)
pnpm install
pnpm infra:up          # postgres, redis, minio, mailhog

# api modul
cp ../../.env.example ../../.env   # majd töltsd ki a titkokat
pnpm --filter @valloreg/api prisma:generate
pnpm --filter @valloreg/api prisma:migrate
pnpm --filter @valloreg/api prisma:seed
pnpm --filter @valloreg/api dev    # http://localhost:4000/api
```

## Scriptek

| Script | Leírás |
| --- | --- |
| `build` | `nest build` (tsconfig.build.json) |
| `dev` | `nest start --watch` |
| `start:prod` | `node dist/main` |
| `typecheck` | `tsc --noEmit -p tsconfig.json` |
| `lint` | jelenleg no-op echo |
| `test` | jelenleg no-op echo |
| `prisma:generate` | Prisma client generálás |
| `prisma:migrate` | `prisma migrate dev` (DIRECT_URL-t használ) |
| `prisma:deploy` | `prisma migrate deploy` (prod) |
| `prisma:seed` | seed (`ts-node prisma/seed.ts`) |

## Modulok

| Modul | Felelősség |
| --- | --- |
| `config` | Tipizált, zod-validált env (`AppConfigService`); hibás konfig → nem indul. |
| `prisma` | `PrismaService` (system + scoped kliens), `TenantContextService` (AsyncLocalStorage). |
| `common` | Decorators (`@CurrentUser`, `@CurrentTenant`, `@Roles`, `@RequireFeature`, `@Public`), guard-ok (Jwt, Tenant, Roles, Feature), exception filter, `AppException`. |
| `auth` | Regisztráció (User+Tenant+Membership+Subscription), login, refresh-rotáció, logout, me; JWT strategy. |
| `tenants` | Aktuális cég lekérése/módosítása. |
| `users` | Tagok listája, meghívás (limit + email stub), meghívó elfogadása, szerepkör-váltás, eltávolítás. |
| `vehicles` | Jármű CRUD + csomag jármű-limit. |
| `documents` | Presign (S3 PUT), regisztráció (MIME/méret/havi limit, idempotens sha256), lista, részletek, letöltés (presign GET). |
| `invoices` | Számla + tételek olvasása (Fázis 3: review/confirm). |
| `audit` | `AuditService.log(...)`, `GET /audit` (ADMIN+). |
| `feature-flags` | Effektív feature-ök (csomag ∪ override), `GET /feature-flags`. |
| `storage` | `StorageService` (S3 presign + key builder), `MailerService` (SMTP/MailHog). |
| `queue` | `documents` BullMQ queue + `DocumentsProcessor` worker. |
| `ocr` | `OcrProvider` port + `StubOcrProvider` + factory (`OCR_PROVIDER` env). |
| `extraction` | `ExtractionProvider` port + `StubExtractionProvider` + factory (`EXTRACTION_PROVIDER` env). |
| `health` | `GET /health` (db ping + redis). |

## Tenant-scope – hogyan működik

A multi-tenant izoláció két rétegből áll:

1. **`TenantContextService`** – `AsyncLocalStorage`-ben tárolja a kérés
   `{ tenantId, userId, role }` kontextusát. A `TenantGuard` tölti fel: kiolvassa
   az `x-tenant-id` headert, a **system** klienssel ellenőrzi a membership-et
   (cross-tenant hozzáférés kizárása), betölti a szerepkört, majd `enter()`-rel
   belép a kontextusba a kérés további feldolgozásához.

2. **`PrismaService` tenant-scope kiterjesztés** – a `prisma.scoped` kliens egy
   Prisma `$extends` query extension. Minden tenant-scope-olt modellnél
   (Membership, Invitation, Subscription, FeatureFlagOverride, Supplier, Vehicle,
   Document, Invoice, InvoiceItem, SupportAccess, SupplierVehicleMapping,
   ItemCategoryMapping):
   - olvasásnál/`updateMany`/`deleteMany`: `where AND tenantId`,
   - `create`/`createMany`: `data.tenantId` beállítása,
   - `update`/`delete`/`upsert`: `where.tenantId` + (upsert create) `tenantId`.

   **Fail-closed:** ha tenant-scope-olt modellt tenant kontextus NÉLKÜL
   kérdezünk le, a kiterjesztés HIBÁT dob.

### Mikor melyik klienst használd

- **`prisma.scoped`** – minden normál, kérés-kontextusban futó üzleti művelet.
  Automatikusan a kérés tenantjére szűr.
- **`prisma.system`** – szándékos megkerülés: auth/regisztráció (még nincs
  tenant), super-admin, tenant-feloldás (membership lookup), audit naplózás
  (a tenantId opcionális), és a **worker** (nem request-kontextusban fut –
  ott a tenantId-t EXPLICITEN adjuk meg minden where/data-ban).
- `prisma.runUnscoped(fn)` – ugyanaz mint a system, csak olvashatóbb a hívás
  helyén.

> A `Tenant` és `User`/`RefreshToken` modellek SZÁNDÉKOSAN nem scope-oltak:
> a `User`/`RefreshToken` globális (auth), a `Tenant` PK-ja az `id` (nem
> `tenantId`), ezért rajta a műveletek expliciten az aktív tenant id-jére mennek.

## Hibakezelés

Minden felhasználó felé menő hiba a `@valloreg/shared` `ErrorCode` + `AppException`
kombináción át megy, amit a globális `AllExceptionsFilter` egységes
`ApiErrorBody` (`{ code, message, details? }`) alakra képez. A frontend a kódot
i18n-eli.

## Környezeti változók

Lásd a repo gyökerében a `.env.example`-t. A `DIRECT_URL` (Neon direct endpoint a
migrációkhoz) opcionális; ha nincs, a Prisma a `DATABASE_URL`-t használja.

| Változó | Cél |
| --- | --- |
| `API_PORT`, `API_GLOBAL_PREFIX`, `CORS_ORIGINS` | API |
| `DATABASE_URL`, `DIRECT_URL` | PostgreSQL (pooled / direct) |
| `REDIS_HOST/PORT/PASSWORD` | Redis / BullMQ |
| `JWT_ACCESS_SECRET/REFRESH_SECRET/ACCESS_TTL/REFRESH_TTL` | JWT |
| `S3_ENDPOINT/REGION/ACCESS_KEY/SECRET_KEY/BUCKET/FORCE_PATH_STYLE` | objektumtár |
| `OCR_PROVIDER` (`stub`\|`mistral`\|`google`) | OCR választás |
| `EXTRACTION_PROVIDER` (`stub`\|`anthropic`), `ANTHROPIC_MODEL`, `ANTHROPIC_API_KEY` | AI extraction |
| `SMTP_*` | mailer (dev: MailHog) |
| `MAX_DOCUMENT_SIZE_BYTES` | feltöltési limit (alap 25 MB) |

## Feldolgozó pipeline (összefoglaló)

1. Kliens presigned PUT URL-t kér (`POST /documents/presign`), feltölt S3-ba.
2. `POST /documents` – MIME/méret/havi limit validáció, idempotens sha256,
   `Document(UPLOADED→QUEUED)`, job sorbavétel.
3. `DocumentsProcessor` (worker): `OCR_RUNNING` → OCR → `EXTRACTING` → extraction
   (`ExtractionResult` shared sémával validálva) → `Invoice` + `InvoiceItem`
   perzisztálás → `AUTO_OK` (confidence ≥ 0.8) vagy `NEEDS_REVIEW` → audit.
4. Retry: 3 próbálkozás exponenciális backoff-fal; tartós hiba → a job a queue
   `failed` halmazában marad (DLQ-szerű, monitorozható/újrapróbálható).

## TODO / Fázis 2-3

- OCR: `MistralOcrProvider`, `GoogleDocumentAiOcrProvider` (interfész kész).
- Extraction: `AnthropicExtractionProvider` (Claude, `ANTHROPIC_MODEL`).
- Invoices: review/confirm flow, tételenkénti módosítás, tanuló mappingek.
- Külön processz-módú (skálázható) worker bootstrap.
