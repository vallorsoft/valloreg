# Audit findings (main – deployolt app)

> Átfogó, több-ügynökös kód-audit a `main` (deployolt) kódján: backend
> biztonság/korrektség, frontend UX, i18n, billing/tárhely. A **Javítva** szekció
> ebben az iterációban elkészült; a **Nyitott backlog** prioritás szerint rendezve.

## Javítva ebben az iterációban

### Build / CI
- **TS build-törés (a main CI piros volt):** a TypeScript 5.9.3 + `moduleResolution: "Node"`
  (TS5107) törte a `pnpm typecheck`/`build`-et. Javítva → `Node16` a shared+api
  tsconfig-ban. **Tesztelve: shared build + web typecheck zöld.**
- **Web typecheck (TS2882) a `globals.css` side-effect importon:** `apps/web/src/css.d.ts`
  ambient `declare module '*.css'`.
- **Friss-klón `pnpm dev` race:** a root `dev` előbb buildeli a `@valloreg/shared`-et.

### A felhasználó által jelzett konkrét hibák
- **TopNav „Nincs kiválasztott cég":** a fejléc most a valós aktív cég nevét mutatja
  (`authApi.me()` + `resolveActiveTenant`).
- **Önkiszolgáló tárhely-vásárlás (eddig csak „írj nekünk"):** valódi igénylés-folyamat
  beépítve – `POST /billing/request-storage` (utalásos: kliens e-mail + admin értesítés +
  audit), shared `STORAGE_PACKS`-ból szerver-oldali árral; a billing oldalon a statikus
  szöveg helyett **vásárlás-gombok** (5/10/25 GB), i18n hu/ro/en.
- **Mobil feltöltés blokk:** a `capture="environment"` eltávolítva
  (`RegistrationScans`, `ComplianceScanModal`) – mobilon újra választható meglévő fájl/PDF.

### Biztonság (backend)
- **KRITIKUS tenant-izolációs szivárgás:** `MajorComponentEvent` és `DurabilityBaseline`
  kimaradt a `TENANT_SCOPED_MODELS`-ból → cross-tenant olvasás/törlés (köztük egy
  **destruktív** `clearBaseline`, ami MINDEN tenant baseline-ját törölte). Hozzáadva a
  scope-hoz (9 szivárgás egyben bezárva).
- **Push unsubscribe IDOR** → `userId`-scope.
- **Jogosultság-eszkaláció** (invite/changeRole/removeMember) → rang-ellenőrzés.
- **Kimenő HTTP timeout** a Gemini ×4 + mailer hívásokra.
- **Gemini API-kulcs** query-stringből → `x-goog-api-key` header.
- **Mailer PII** (jelszó-reset token) logolás megszüntetve.

## Nyitott backlog (prioritás szerint)

### KRITIKUS / HIGH – backend
- **Trial / subscription-státusz sehol nincs betartatva:** a `status`/`trialEndsAt` csak
  kiírásra olvasott; lejárt trial / CANCELED / PAST_DUE után is teljes hozzáférés marad.
  → `SubscriptionGuard` kell (status ∉ {ACTIVE,TRIALING} vagy lejárt trial → blokk).
- **Tárhely-keret megkerülése:** a jármű-dokumentum (`confirmScan`, `confirmDocument`) és
  a scan-staging feltöltések NEM hívják az `assertStorageLimit`-et, pedig beleszámítanak a
  használatba. → közös limit-helper a `vehicleDocument.create` előtt.
- **Refresh-token reuse nincs detektálva:** visszavont token replaykor nincs token-family
  revoke. → session/family-id + kompromittáltság-kezelés.
- **Feature-flag „eladva, de nincs kapuzva":** REPORTS (`reports.controller` csak Jwt+Tenant),
  EXPORT (sehol nem kapuzott), DASHBOARD (`stats.controller`), OCR – az alacsonyabb csomag is
  eléri. **Termékdöntést igényel** (kapuzni vagy a jelvényt levenni), ezért NEM állítottam be
  vakon. API (publikus API-kulcs) nincs implementálva – vegyük le a hirdetésből, amíg nem kész.

### MEDIUM – backend
- **`/health/queues` `@Public`** – BullMQ belső számokat szivárogtat; tegyük admin-guard mögé.
- **JWT secret `.min(1)`** – emeljük `.min(32)`-re.
- **Pénz-összeadás float-tal a Fleet TCO-ban** (`insights.service`) → `Prisma.Decimal.add`.
- **Riport hónap-bucket helyi idő vs UTC** (`reports.service`, `stats.service`) → UTC határ.
- **Per-instance scheduler duplikáció** (reminders/reports/verification/benchmark) elosztott
  lock nélkül; havi riport retry újraküldhet mindenkinek; reminder notify-then-mark nem atomi.
- **TOCTOU a limit-ellenőrzéseken** (count-then-create tranzakció nélkül).
- **Külső JSON (RO verify / recall) validáció és méret-korlát nélkül** (SSRF/DoS, Invalid Date).
- **`notifications` controllernek nincs osztály-szintű guard-ja** (fail-closed kellene).
- **Rankings: ismeretlen megbízhatóságú jármű a legjobbként pontozódik** (`normRel=0`).

### HIGH / MEDIUM – frontend (UX, a felhasználó által is érintett)
- **Meghívó-folyamat halott:** nincs `/accept-invite` oldal → a meghívott e-mail-linkje 404.
  Kell egy elfogadó oldal + `POST /users/accept-invite` + linkes e-mail.
- **Landing Contact űrlap no-op** (`Contact.tsx`, „later phase") – némán eldobja az üzenetet.
  → kösd valódi végpontra vagy `mailto:`-ra.
- **Footer Privacy/Terms/About halott `<span>`, nincs oldal** – GDPR-termékhez kell.
- **Néma hibakezelés mindenhol:** a `.catch(()=>{})` a 500/hálózati hibát „üres adatnak"
  mutatja (dashboard, vehicles, documents, reminders, insights, billing→üres oldal, team,
  admin, rankings). → 401/403 ↔ valódi hiba szétválasztás + retry-állapot.
- **Stub megfelelőség-adat valódiként** (`VehicleVerification`) – kamu ITP/RCA dátumok.
- **Nyers enum/kód kiírva a usernek:** kategóriák, feature-kulcsok, role-ok
  (`DocumentReviewClient`, `InsightsClient`, `BillingClient` funkció-jelvények, `AdminTenantClient`).
- **Hardcode-olt magyar tooltip** „Bizonytalan" (`DocumentReviewClient`); landing `Pricing`
  `toLocaleString('hu-HU')`; nem-lokalizált oldal-metaadat; 404 oldal idegen kulcsokat használ.
- **Modálok a11y:** nincs `role="dialog"`/Esc/fókusz-csapda.
- **Vehicle save hibaüzenet rossz** (`actions.deleteError`); regisztráció nem validálja az adószámot;
  rankings export figyelmen kívül hagyja az aktív fület; néma letöltés-hibák.

### Tartalmi / launch-readiness
- **Fake testimonials valódiként** a landingen; **PhaseNote „Demó nézet"** dead-code.
- Landing Contact „az űrlap bekötése későbbi fázisban érkezik" – valós termékhez kösd be.

> Megjegyzés: az i18n kulcs-paritás **tökéletes** (hu/ro/en × 963 kulcs, nulla eltérés).
> A fenti i18n-tételek nyers-enum kiírások és néhány hardcode, nem hiányzó kulcsok.
