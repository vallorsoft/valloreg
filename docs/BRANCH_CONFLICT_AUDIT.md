# Branch-ütközés audit és feloldás

**Dátum:** 2026-06-25
**Audit branch:** `claude/branch-conflict-audit-zh4i9z`
**Vizsgált ágak:**
- `claude/gdpr-compliance-audit-nwgrin` (= nyitott **PR #60**) — 3 sávos RON árazás + GDPR csomag
- `claude/storage-pricing-strategy-osjo3u` — extra tárhely + RON árazás (nincs nyitott PR)

**Közös ős (merge-base):** `2e8a2af`

---

## 1. Összefoglaló

A két ág **egymástól függetlenül, ugyanazt a feature-t** (RON-ra váltás + megvásárolható
extra tárhely add-on) implementálta, és **minden közös érintkezési ponton ütköznek**.
A két megoldás kibékíthetetlen: eltérő csomagmodell, eltérő DB-enum, **azonos időbélyegű,
de eltérő tartalmú migráció**, és eltérő oszlopnév-betűzés.

**Döntés (a tulajdonos jóváhagyásával): a 3 sávos modell (PR #60) a kanonikus.**
A `storage-pricing-strategy` ág **elavult / felülírt** — egyedi értéke nincs, amit a #60 ne
tartalmazna már, viszont ütköző DB-migrációt és csomagmodellt hoz. **Nem szabad mergelni.**

---

## 2. Az ütközések részletesen

| Terület | `storage-pricing-strategy-osjo3u` | `gdpr-compliance-audit-nwgrin` (**PR #60**, kanonikus) |
|---|---|---|
| Csomagmodell | Megtartja a **4 sávot** (STARTER/STANDARD/PROFESSIONAL/BUSINESS) | **3 sáv** (START/PRO/FLEET), enum átnevezéssel |
| Árak | 99 / 199 / 399 / 799 RON | 49 / 129 / 299 RON |
| `PlanTier` enum (DB) | változatlan | enum eldobás + újradefiniálás (`START`/`PRO`/`FLEET`) |
| Migrációs mappa | `20260625120000_subscription_extra_storage` | `20260625120000_plan_tier_3tier_storage` |
| **Migráció időbélyeg** | `20260625120000` | `20260625120000` — **ÜTKÖZIK (azonos)** |
| Új oszlop | `extraStorageGb` (kis *b*) | `extraStorageGB` (nagy *B*) |
| Shared függvény | `effectiveMaxStorageBytes()` | `effectiveStorageBytes()` |
| `StorageAddon` mező | `gb` | `extraGB` |
| Konstans | `BYTES_PER_GB` (exportált) | `GB` (lokális) |
| Éves díj | nincs | van (12 helyett 11 havidíj = 1 hó ingyen) |
| Limit-túllépés üzenet | „…Vásárolj extra tárhelyet a feltöltés folytatásához." | „…Vásárolj extra tárhelyet, vagy törölj dokumentumokat." |

### Miért tört volna el, ha mindkettő main-re kerül
- **Két migráció azonos `20260625120000` időbélyeggel** → a Prisma migrációs sorrend
  bizonytalan, és **mindkét `ALTER TABLE` lefutna**, így a `subscriptions` táblába
  **két különböző extra-tárhely oszlop** (`extraStorageGb` ÉS `extraStorageGB`) kerülne.
- A `PlanTier` enum **nem lehet egyszerre** 4 sávos és 3 sávos.
- A `shared/plans.ts`-ben **két, eltérő nevű** `effectiveStorageBytes` /
  `effectiveMaxStorageBytes` függvény és **két eltérő** `StorageAddon` alak — TS fordítási hiba.

### Érintett, mindkét ágon módosított fájlok (overlap)
`packages/shared/src/plans.ts`, `apps/api/prisma/schema.prisma`,
`apps/api/prisma/migrations/20260625120000_*`, `apps/api/src/billing/billing.service.ts`,
`apps/api/src/documents/documents.service.ts`, `apps/api/src/admin/admin.service.ts`,
`apps/api/src/admin/dto/set-subscription.dto.ts`,
`apps/api/src/common/exceptions/app.exception.ts`,
`apps/web/src/lib/api.ts`, `apps/web/src/components/landing/Pricing.tsx`,
`apps/web/src/app/[locale]/(app)/billing/BillingClient.tsx`,
`apps/web/src/app/[locale]/(app)/admin/[id]/AdminTenantClient.tsx`,
`apps/web/src/messages/{hu,en,ro}.json`.

---

## 3. A kanonikus ág (PR #60) ellenőrzése — TISZTA

- ✅ **Nincs maradék 4-sávos hivatkozás** a kódban (`STARTER|STANDARD|PROFESSIONAL|BUSINESS`
  csak a migráció `USING` leképezésében és a doksikban, ahol kell).
- ✅ A megmaradt `HUF` találatok **nem az árazás** — azok a *számla*-pénznem opciók
  (`extraction`, OCR-stub) és a demó-seed adatok; ez helyes.
- ✅ **Pontosan egy** extra-tárhely migráció és **egy** oszlop (`extraStorageGB`),
  mindenhol egységesen használva (API + web + shared).
- ✅ i18n: `hu` / `en` / `ro` **érvényes JSON**, **kulcs-paritás rendben** (781–781–781).

---

## 4. Site-szintű audit (szintaxis / build)

- ✅ i18n JSON érvényes a base-en és a kanonikus ágon is.
- ⚠️ Teljes `tsc --noEmit` / `turbo build` futtatásához `pnpm install` kell, ami a
  környezetben az API `@prisma/engines` postinstalljánál hálózati hibával elszáll
  (engine bináris letöltés blokkolt). Ezt a Render build validálja `prisma generate` után.
  Ez **környezeti** korlát, nem kódhiba — a PR #59/#60 leírása is jelzi.

---

## 5. Javasolt feloldás (teendők)

1. **A `storage-pricing-strategy-osjo3u` ágat NE mergeld.** Zárd le PR/branch szinten —
   a feature (extra tárhely add-on) már benne van a #60-ban.
2. **PR #60 leírásának pontosítása:** a leírás tévesen állítja, hogy „a másik ág nem
   módosította a DB-sémát → nincs migrációs ütközés". Ez **téves** — a storage ág sémát
   módosított (`extraStorageGb` oszlop), és pont az **azonos `20260625120000` migrációs
   időbélyeg** ütközik. (Mivel a storage ágat nem mergeljük, élesben nincs valós ütközés,
   de a leírást érdemes javítani, hogy ne legyen félrevezető.)
3. **Opcionális átemelendő apróság a storage ágból:** a limit-túllépési üzenet
   („…vagy törölj dokumentumokat") a #60-ban felhasználóbarátabb — ez már a #60-ban így van,
   nincs teendő. A storage ág egyéb egyedi tartalma nem visz hozzá értéket.
4. **Jövőbeli migrációknál** használjatok valós (növekvő) időbélyeget a párhuzamos ágak
   ütközésének elkerülésére.

---

## 6. A feloldás státusza

A két ág kibékíthetetlen; a **#60 (3 sáv, RON)** a kanonikus irány, és **belsőleg
konzisztens**. A tényleges „összevonás" nem kódbeli merge, hanem a felülírt
`storage-pricing-strategy` ág visszavonása (lásd 5. pont) — ezt a repo tulajdonosa
végzi GitHubon. Ez a dokumentum rögzíti a vizsgálatot és a döntést.
