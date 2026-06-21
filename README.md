# valloreg

Next.js (App Router, TypeScript) + Drizzle ORM + Neon Postgres alapú alkalmazás.

## Stack

| Réteg          | Technológia                                           |
| -------------- | ----------------------------------------------------- |
| Framework      | [Next.js 16](https://nextjs.org) (App Router)         |
| Nyelv          | TypeScript (strict)                                   |
| Adatbázis      | [Neon](https://neon.tech) (serverless Postgres)       |
| ORM / migráció | [Drizzle ORM](https://orm.drizzle.team) + drizzle-kit |
| DB driver      | `@neondatabase/serverless` (HTTP)                     |
| Validáció      | [Zod](https://zod.dev)                                |
| Lint / format  | ESLint + Prettier                                     |

## Előfeltételek

- Node.js **20+** (ajánlott 22)
- Egy Neon **project** (külön organization nem szükséges egy alkalmazáshoz)

## 1. Neon beállítása

A Neon hierarchiája: **Organization → Project → Branch → Database**. Egy app
egy fejlesztővel: elég **egy project**, a `main` branch = production. A
környezeteket (dev / staging / prod) Neonban **branch-ekkel** célszerű kezelni
egy projekten belül, nem külön projektekkel.

1. A [Neon konzolban](https://console.neon.tech) hozz létre egy projektet
   (pl. `valloreg`).
2. Másold ki a connection stringet: **Connect → Connection string**.
   - **Pooled** (a host `-pooler`-t tartalmaz): ezt használja az app futásidőben.
   - **Direct** (unpooled): migrációkhoz ajánlott.

## 2. Környezeti változók

Másold a példafájlt és töltsd ki:

```bash
cp .env.example .env
```

```dotenv
DATABASE_URL="postgresql://USER:PASSWORD@ep-xxxx-pooler.REGION.aws.neon.tech/valloreg?sslmode=require"
# Opcionális, migrációkhoz (direct kapcsolat):
# DATABASE_URL_UNPOOLED="postgresql://USER:PASSWORD@ep-xxxx.REGION.aws.neon.tech/valloreg?sslmode=require"
```

Az env validációja Zod-dal történik (`src/env.ts`), lustán (csak első
használatkor), így `next build` titok nélkül is lefut.

## 3. Telepítés és adatbázis-migráció

```bash
npm install
npm run db:migrate   # alkalmazza a drizzle/ alatti migrációkat a Neon DB-re
npm run db:seed      # (opcionális) példa adatok feltöltése
```

## 4. Fejlesztés

```bash
npm run dev
# http://localhost:3000
```

- Főoldal: kilistázza a `users` táblát.
- `GET  /api/health` – DB egészség-ellenőrzés (`select 1`).
- `GET  /api/users` – felhasználók listája.
- `POST /api/users` – felhasználó létrehozása.

```bash
curl -X POST http://localhost:3000/api/users \
  -H 'content-type: application/json' \
  -d '{"email":"teszt@valloreg.dev","name":"Teszt"}'
```

## Adatbázis-workflow (Drizzle)

| Parancs               | Mit csinál                                           |
| --------------------- | ---------------------------------------------------- |
| `npm run db:generate` | SQL migrációt generál a sémából (`src/db/schema.ts`) |
| `npm run db:migrate`  | Alkalmazza a generált migrációkat                    |
| `npm run db:push`     | Sémát közvetlenül szinkronizál (gyors prototípushoz) |
| `npm run db:studio`   | Drizzle Studio (vizuális adatböngésző)               |
| `npm run db:seed`     | Példa adatok betöltése                               |

Séma módosítása után: szerkeszd a `src/db/schema.ts`-t → `npm run db:generate`
→ commitold a `drizzle/` alá generált fájlt → `npm run db:migrate`.

## Hasznos parancsok

```bash
npm run lint        # ESLint
npm run typecheck   # tsc --noEmit
npm run format      # Prettier (írás)
npm run build       # production build
```

## Projektstruktúra

```
src/
├─ env.ts                 # Zod-os, lusta env-validáció
├─ db/
│  ├─ index.ts            # Drizzle kliens (lusta, Neon HTTP driver)
│  ├─ schema.ts           # táblák + típusok
│  └─ seed.ts             # seed script
└─ app/
   ├─ layout.tsx
   ├─ page.tsx            # users lista
   ├─ globals.css
   └─ api/
      ├─ health/route.ts  # DB health check
      └─ users/route.ts   # GET / POST users
drizzle/                  # generált SQL migrációk (verziózva)
.github/workflows/ci.yml  # lint + typecheck + build
```

## Deploy

Vercelen (vagy bármely Node hostingon) állítsd be a `DATABASE_URL`
környezeti változót, és a build/start a megszokott módon megy. A migrációkat
deploy előtt/közben futtasd: `npm run db:migrate`.

## Megjegyzés a függőség-auditról

Két **dev-only, tranzitív** moderate sebezhetőség (`esbuild` a `drizzle-kit`
alatt, `postcss` a `next` alatt) ismert; az `npm audit fix --force` ezeket csak
értelmetlen major-downgrade-del „javítaná" (next@9, drizzle-kit@0.18), ezért
nem alkalmazzuk. Futásidőre nincs hatásuk.
