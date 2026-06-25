# CLAUDE.md — Valloreg

Ghid pentru agenți AI (și dezvoltatori) care lucrează în acest repository.

## Ce este Valloreg

SaaS B2B de administrare a flotelor (OCR + AI pentru documente). Monorepo pnpm + Turbo:

- `apps/api` — backend **NestJS** (REST + workeri BullMQ), Prisma + PostgreSQL (Neon).
- `apps/web` — frontend **Next.js** (App Router, PWA, next-intl: hu/ro/en).
- `packages/shared` — tipuri/constante partajate (`@valloreg/shared`): roluri, planuri, locale, coduri de eroare.

Infrastructură (prod): Render (regiune **frankfurt**, EU), Neon PostgreSQL, Cloudflare R2 (storage), Redis (BullMQ). AI: Google Gemini — **implicit `stub`** (dezactivat).

## Comenzi

```bash
pnpm install                              # necesită rețea (Prisma engines)
pnpm --filter @valloreg/shared build      # build shared (necesar înainte de api/web)
pnpm --filter @valloreg/api prisma:generate
pnpm --filter @valloreg/api build
pnpm --filter @valloreg/web typecheck
pnpm infra:up                             # docker-compose: Postgres, Redis, MinIO, MailHog
```

> În medii fără rețea, `prisma generate` eșuează (descărcare engine) → typecheck-ul API nu poate rula complet. Web typecheck funcționează după linkarea dependențelor.

## Convenții esențiale

### Multi-tenant (CRITIC)
- Fiecare model de business are `tenantId` + `@@index([tenantId])`.
- `prisma.scoped` injectează automat filtrul `tenantId` (fail-closed) — folosește-l pentru date de business.
- `prisma.system` = client neîngrădit, **doar** pentru auth/platformă/cron (fără context de tenant).
- `User`, `RefreshToken`, `PasswordResetToken` sunt GLOBALE.

### Erori
- Aruncă `AppException.*` (mapează la `ApiErrorBody` cu `ErrorCode`). Nu arunca erori brute.

### Securitate
- Parole: **Argon2**. JWT access (scurt) + refresh (rotit, stocat ca hash SHA-256).
- RBAC: `OWNER > ADMIN > FLEET_MANAGER > ACCOUNTANT > VIEWER` (rang) + `SUPER_ADMIN` (platformă).
- Rate limiting pe endpoint-urile de auth: `@RateLimit(limit, windowMs)` + `RateLimitGuard`.
- Secrete DOAR în env (Render), niciodată în cod. `.env.example` = doar placeholdere.

### Concurență / TOCTOU (IMPORTANT — citește înainte de a scrie „check-then-act")

Pattern-uri obligatorii pentru a evita race conditions (vezi `docs/legal/99_Audit_Tehnic_Conformitate.md`):

1. **Consumarea unui token** (refresh, reset parolă, acceptare invitație) — folosește
   `updateMany({ where: { id, <campStare>: null }, data: {...} })` și verifică
   `count === 0` ca să respingi „dublul consum". NU face `update` necondiționat după
   un `findUnique` + check (fereastra TOCTOU permite double-spend).
2. **Insert idempotent pe un unique constraint** (email user, `(tenantId, sha256)`
   document, mapping-uri cu `@@unique`) — prinde `Prisma.PrismaClientKnownRequestError`
   cu `err.code === 'P2002'` și tratează-l ca domain-error (ex. `emailTaken`) sau
   re-citește câștigătorul. NU te baza doar pe `findFirst` înainte de `create`.
3. Operațiile cu mai mulți pași care trebuie atomice → `$transaction`; aruncarea în
   interior produce rollback.

**Race-uri rezolvate prin migrarea `20260625130000_supplier_itemcat_dedup_unique`:**
- `Supplier` are acum `@@unique([tenantId, normalizedName])`; `matching.service.ts`
  prinde P2002 → întoarce câștigătorul.
- `ItemCategoryMapping` are `@@unique([tenantId, supplierId, pattern, category, type])`;
  `invoices.service.ts` prinde P2002 → increment. **Excepție:** `supplierId NULL` —
  Postgres tratează NULL-urile ca distincte, deci unique nu acoperă rândurile fără
  furnizor (race rezidual rar; calea `findFirst`+increment îl gestionează).
- Migrarea deduplică datele existente (reorientează FK-uri, însumează ponderi) ÎNAINTE
  de a adăuga constrângerile. **Nu adăuga un `@@unique` fără pas de dedup.**

### Schedulere
- BullMQ direct (nu `@nestjs/schedule`). Pattern: vezi `reminders.scheduler.ts` /
  `cleanup.scheduler.ts`. Un scheduler NU trebuie să blocheze bootul API-ului (try/catch,
  fire-and-forget pentru `queue.add` cu `repeat`).

### Retenție (GDPR art. 5(1)(e))
- `CleanupService` (zilnic 03:30) purjează: audit (`AUDIT_RETENTION_DAYS`=365),
  refresh tokens revocate/expirate (30z), reset tokens expirate (1z), scan staging
  blocat (7z). Configurabil prin env.

### Ștergere (GDPR art. 17)
- `DELETE /tenants/current` (doar OWNER) → șterge obiectele R2 sub `tenants/{id}/` +
  cascadă DB. `StorageService.deleteByPrefix` listează+șterge cu paginare.

## Pachetul de conformitate
- `docs/legal/` — 20 documente RO de conformitate GDPR/AI Act + audit tehnic intern
  (`99_*`). Generate din implementarea reală; necesită revizuire juridică.

## Reguli pentru modificări
- Reflectă realitatea codului în documente (`docs/SECURITY.md`, `docs/legal/`). Dacă o
  funcție e doar pe roadmap, marcheaz-o ca atare — nu pretinde că e implementată.
- Pentru date de business folosește `prisma.scoped`; pentru platformă `prisma.system`.
- Adaugă traduceri în toate cele 3 limbi (`apps/web/src/messages/{hu,ro,en}.json`).
