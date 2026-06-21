# Valloreg

Fuvarozói / flottakezelő **SaaS platform**, amely szervizszámlákból **OCR + AI**
segítségével automatikusan épít digitális szerviztörténetet.

A felhasználó feltölt egy számlát (PDF/JPG/PNG), a rendszer kiolvassa és értelmezi,
tételenként kategorizálja, járműhöz rendeli, és csak minimális emberi ellenőrzést kér.

> Részletes ütemterv: **[ROADMAP.md](./ROADMAP.md)** · Architektúra:
> **[docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md)** · Biztonság:
> **[docs/SECURITY.md](./docs/SECURITY.md)** · Core motor:
> **[docs/OCR_AI_ENGINE.md](./docs/OCR_AI_ENGINE.md)** · Deploy:
> **[docs/DEPLOY.md](./docs/DEPLOY.md)**

## Tech stack

| Réteg        | Technológia                                            |
| ------------ | ------------------------------------------------------ |
| Frontend     | Next.js (App Router) · TypeScript · TailwindCSS · PWA  |
| Backend      | NestJS · TypeScript · REST                             |
| Adatbázis    | PostgreSQL · Prisma ORM                                |
| Háttér       | Redis · BullMQ (aszinkron feldolgozás)                 |
| Tárolás      | S3-kompatibilis (MinIO helyben)                        |
| Auth         | JWT (access + refresh) · RBAC                           |
| i18n         | hu / ro / en (nincs hardcode-olt szöveg)              |

## Monorepo szerkezet

```
valloreg/
├── apps/
│   ├── api/          # NestJS backend (REST, Prisma, BullMQ, S3, OCR/AI portok)
│   └── web/          # Next.js PWA frontend (i18n, Tailwind brand téma)
├── packages/
│   └── shared/       # Megosztott típusok: szerepkörök, csomagok, feature flag-ek,
│                     # extraction JSON kontraktus (zod), hibakódok
├── docs/             # Architektúra, biztonság, OCR/AI motor, deploy
├── docker-compose.yml
├── turbo.json
└── pnpm-workspace.yaml
```

## Gyors indítás (helyi fejlesztés)

Előfeltétel: Node 20+, pnpm 10+, Docker.

```bash
# 1. Függőségek
pnpm install

# 2. Környezeti változók
cp .env.example .env

# 3. Infra (Postgres, Redis, MinIO, MailHog)
pnpm infra:up

# 4. Adatbázis séma + seed
pnpm db:migrate
pnpm db:seed

# 5. Fejlesztői szerverek (API + web együtt)
pnpm dev
```

Elérhetőségek (alapértelmezés):

- Web (PWA): http://localhost:3000
- API: http://localhost:4000/api
- MinIO konzol: http://localhost:9001 (valloreg / valloreg-secret)
- MailHog: http://localhost:8025

## Hasznos parancsok

```bash
pnpm build        # minden csomag build
pnpm typecheck    # típusellenőrzés mindenhol
pnpm lint         # lint
pnpm test         # tesztek
pnpm infra:down   # infra leállítás
```

## Multi-tenant és adatvédelem

Minden üzleti rekord `tenant_id`-vel izolált; a Prisma kiterjesztés kötelezővé teszi a
tenant-scope-ot. Az üzemeltető (Super Admin) alapból **nem** látja a számlák tartalmát,
csak rendszeradatot, statisztikát, hibát és audit logot. Részletek:
[docs/SECURITY.md](./docs/SECURITY.md).
