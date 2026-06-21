# Architektúra

## Áttekintés

Valloreg egy multi-tenant SaaS, amely három futási egységből áll:

```
                       ┌──────────────────────────┐
                       │      Next.js PWA (web)    │  böngésző / mobil (telepíthető)
                       │  i18n · Tailwind · SW     │
                       └────────────┬─────────────┘
                                    │ REST (JWT)
                       ┌────────────▼─────────────┐
                       │      NestJS API (api)     │  REST, auth, RBAC, tenant-scope
                       │  Prisma · BullMQ producer │
                       └─────┬───────────────┬─────┘
              SQL (tenant_id)│               │ jobs
                       ┌──────▼──────┐  ┌─────▼───────────────┐
                       │ PostgreSQL  │  │  Redis + BullMQ      │
                       └─────────────┘  └─────┬───────────────┘
                                              │ consume
                                       ┌──────▼───────────────┐
                                       │  Worker (api, queue)  │  OCR → Extraction → Kategorizálás
                                       │  OCR/AI provider portok│
                                       └──────┬───────────────┘
                                              │ objektumok
                                       ┌──────▼───────────────┐
                                       │  S3 / MinIO            │  eredeti dokumentumok
                                       └───────────────────────┘
```

## Rétegek

### Frontend (`apps/web`)
- Next.js App Router, TypeScript, TailwindCSS, brand téma (narancs/kapucsínó/antracit).
- PWA: manifest + service worker, offline shell, telepíthető mobilon/tableten.
- i18n: `hu` / `ro` / `en` JSON dictionary-k, **nincs hardcode-olt szöveg**.
- API kommunikáció REST-en, JWT a `Authorization` headerben; refresh flow.

### Backend (`apps/api`)
- NestJS moduláris felépítés: minden domain külön modul (auth, tenants, users,
  vehicles, documents, invoices, audit, feature-flags, billing…).
- Prisma ORM PostgreSQL fölött.
- **Tenant-scope kiterjesztés**: a Prisma client minden lekérdezést a kérés
  tenant-jére szűr; a tenant nélküli üzleti lekérdezés hibát dob.
- RBAC guard a szerepkörökhöz (`@valloreg/shared` `TenantRole`).
- BullMQ producer a feldolgozó jobokhoz; a worker ugyanebben az appban fut
  külön processz-módban (horizontálisan skálázható).

### Megosztott csomag (`packages/shared`)
- Szerződések egy helyen: szerepkörök, csomag-limitek, feature flag kulcsok,
  **extraction JSON kontraktus** (zod), dokumentum-szabályok, hibakódok, locale-ok.
- Build CommonJS-re, hogy a NestJS (CJS) és a Next.js egyaránt fogyaszthassa.

## Adatfolyam: számla feldolgozás (Fázis 2 plumbing már Fázis 1-ben)

1. **Upload** – a web presigned URL-t kér az API-tól, és közvetlenül S3-ba tölt.
2. **Document rekord** – az API létrehoz egy `Document`-et (`UPLOADED`), `tenant_id`-vel.
3. **Enqueue** – job kerül a `documents` queue-ba (idempotens kulcs = dokumentum-hash).
4. **Worker** – OCR provider → nyers szöveg/layout; Extraction provider → `ExtractionResult`.
5. **Kategorizálás + matching** – tételek típusozása, jármű-jelöltek.
6. **Státusz** – `AUTO_OK` (magas confidence) vagy `NEEDS_REVIEW`.
7. **Review** – a felhasználó jóváhagy/módosít → `CONFIRMED`, a szervizkönyv frissül.

Minden lépés audit-logba kerül.

## Skálázhatóság

- Az API stateless → vízszintesen skálázható a Render mögött.
- A workerek külön process-ek, a queue alapján skálázódnak.
- A PostgreSQL kapcsolatok poolozva (Neon: pooled endpoint); migráció direct URL-en.
- Az objektumtár (S3) korlátlanul nő; a DB csak metaadatot és strukturált eredményt tárol.

## Moduláris bővíthetőség (jövő)

Új domének (üzemanyag, útdíj, biztosítás, műszaki vizsga, integrációk) saját NestJS
modulként és Next.js route-ként adhatók hozzá, a meglévő tenant-scope, RBAC és audit
infrastruktúra újrahasználatával — újratervezés nélkül.
