# Biztonság és adatvédelem

## Multi-tenant izoláció

- **Minden üzleti rekord** tartalmaz `tenantId`-t (cégazonosító).
- A request életciklusban a hitelesített tokenből kerül a tenant kontextusba.
- A Prisma kliens egy **tenant-scope kiterjesztéssel** automatikusan hozzáadja a
  `tenantId` szűrőt minden tenant-hez kötött modell lekérdezéséhez. Ha üzleti modellt
  tenant nélkül próbálnánk lekérdezni, a kiterjesztés hibát dob (fail-closed).
- Cross-tenant hozzáférés kódszinten kizárt; a teszteknek ezt expliciten ellenőrizniük kell.

## Hitelesítés és jogosultság

- **JWT** access (rövid életű) + refresh (hosszú életű) token.
- Jelszavak `argon2`/`bcrypt` hash-sel, soha nem plaintextben.
- **RBAC**: `OWNER`, `FLEET_MANAGER`, `ADMIN`, `ACCOUNTANT`, `VIEWER` (cég),
  `SUPER_ADMIN` (platform). A guard a `@valloreg/shared` szerepköreit használja.
- **2FA**: a séma tartalmaz `twoFactorSecret` mezőt, de a TOTP-folyamat (engedélyezés/
  ellenőrzés) **még nincs implementálva** – tervezett (roadmap). Opcionális Google login szintén tervezett.
- Felhasználók email meghívással kerülnek a céghez.

## Adatvédelem – az üzemeltető mit lát

A platform üzemeltetője (Super Admin) **alapértelmezés szerint NEM látja**:

- számlák tartalmát, dokumentumokat, javításokat, költségeket, járműadatokat.

Csak ezeket látja: rendszeradatok, statisztikák, előfizetések, hibák, audit logok.

### Support access

> **Megjegyzés (állapot):** a `SupportAccess` adatmodell létezik, de a kiszolgáló
> API (kiadás/visszavonás) és a fogyasztó-oldali kényszerítés (guard) **még nincs
> implementálva** – tervezett. Az alábbi a CÉLZOTT viselkedés.

A cég adminisztrátora **ideiglenes** hozzáférést adhat support célra:
`1 óra` / `24 óra` / `7 nap`. Minden ilyen hozzáférés:

- lejárati idővel jön létre,
- teljesen naplózott (ki, mikor, meddig, mit nézett),
- automatikusan megszűnik a lejáratkor.

## Audit log

Minden érzékeny művelet naplózva: ki (user), melyik cég (tenant), mit (action),
melyik erőforráson (resource), mikor, milyen eredménnyel. Az AI/OCR döntések is
ide kerülnek (Fázis 2), hogy a feldolgozás visszakövethető legyen.

## Adattárolás

- Dokumentumok S3-kompatibilis tárban, hozzáférés presigned URL-lel, tenant-prefixszel.
- Titkosítás nyugalmi állapotban (tároló szint) és átvitel közben (TLS).
- Titkok soha nem a repóban: `.env` (helyi) és secret manager (prod, pl. Render env).

## Limitek és visszaélés-védelem

- Csomag-limitek (jármű/felhasználó/tárhely/dokumentum) szerver oldalon kényszerítve.
- Feltöltés: MIME + méret ellenőrzés (PDF/JPG/PNG, max 25 MB).
- Input-validáció (class-validator) minden végponton.
- **Rate limiting** a hitelesítési végpontokon (login, register, refresh, forgot/reset
  password) – memóriában tartott, per-process (`RateLimitGuard`). Több instance esetén
  Redis-alapú számlálóra váltandó.

## Feature flag-ek

Cégenként engedélyezhető/tiltható funkciók (OCR, AI, Dashboard, Riportok, API, Export,
Emlékeztetők, Dokumentumtár). A tiltott funkció a backenden is elutasít (nem csak UI).

## Flotta-benchmark („Európai trendek") és k-anonimitás

A piaci összevetés több cég VALÓDI költségadatából képzett, **anonimizált aggregátum**
(`FleetBenchmark`). Az adatvédelem több rétegű:

- **Nincs tenantId, nincs azonosító:** a benchmark-tábla csak szegmens-kulcsot
  (márka-modell / kategória / km-sáv / pénznem) és statisztikát (medián, p25, p75)
  tárol. Egyetlen számla, jármű vagy cég sem köthető hozzá.
- **k-anonimitási kapu:** egy cella CSAK akkor publikus, ha legalább **5 különböző
  cég** ÉS **20 különböző jármű** adta (`BENCHMARK_MIN_TENANTS` / `_VEHICLES`).
  Küszöb alatt a szegmens egyszerűen nem jelenik meg – így nem fejthető vissza
  egyetlen flotta költsége sem.
- **Opt-in:** a cég kikapcsolhatja a hozzájárulást (`Tenant.benchmarkOptIn`); ekkor
  az adatai nem számítanak bele az aggregátumba (a piaci összevetést továbbra is láthatja).
- **Super Admin sem lát tenant-szintű benchmark-adatot** – csak a publikus aggregátumot.
- A heti újraszámítás a `system` klienssel fut; perzisztálni csak a küszöböt elért
  cellák statisztikáját perzisztáljuk.

A visszahívás-adat (recall) **ingyenes** forrásból jön (beépített kurált lista, vagy
konfigurált ingyenes feed). Fizetős külső adat-API (érték/maradványérték, OEM
szerviz-intervallum) **szándékosan nincs bekötve**.
