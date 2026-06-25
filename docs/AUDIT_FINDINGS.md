# Audit findings (main – deployolt app)

> Átfogó, több-ügynökös kód-audit a `main` (deployolt) kódján. A találatok
> túlnyomó többsége **megoldva** (PR #62, #63, #64), mind CI-validálva
> (typecheck + build + `prisma generate`). A végén már csak néhány tudatosan
> **elfogadott / külön tervezést igénylő** tétel marad.

## Megoldva (PR #62 / #63 / #64)

### Build / CI
- TS 5.9.3 + `moduleResolution: "Node"` (TS5107) build-törés → `Node16`; ez tette zöldre
  a `main` CI-t. Web `globals.css` (TS2882) → `css.d.ts`. Friss-klón `pnpm dev` race.

### Felhasználó által jelzett hibák
- **TopNav** valós cégnevet mutat. **Önkiszolgáló tárhely-vásárlás**
  (`POST /billing/request-storage` + vásárlás-gombok). **Mobil feltöltés**: `capture` levéve.

### Biztonság / hozzáférés-kontroll (backend)
- **KRITIKUS tenant-izoláció:** `MajorComponentEvent` + `DurabilityBaseline` a tenant-scope-ba
  (cross-tenant olvasás/destruktív törlés bezárva).
- Push unsubscribe **IDOR** → userId-scope; **jogosultság-eszkaláció** rang-ellenőrzés.
- **Refresh-token reuse-detektálás** (újrahasználatkor a teljes token-család visszavonva).
- Gemini API-kulcs query→header; mailer PII-log megszüntetve; **kimenő HTTP timeoutok**.
- **Külső JSON validáció + méret-korlát** (RO verify / recall: timeout, content-length cap,
  dátum-validáció, sor-korlát).
- **Feature-gating**: REPORTS/EXPORT (reports), DASHBOARD (stats); `/health/queues` admin-guard;
  JWT secret `.min(32)`; notifications osztály-szintű guard.
- **SubscriptionGuard** (lejárt trial / CANCELED / PAST_DUE) a write-végpontokon (document-upload,
  vehicle create/scan).
- **Tárhely-keret betartatás** a jármű-dokumentum és scan-staging feltöltéseknél.
- **Meghívó-token hashelve** a DB-ben (raw csak a linkben).
- **Per-instance scheduler duplikáció:** `SCHEDULER_ENABLED` env-kapu (4 scheduler) – több
  instance esetén egyetlen instance futtatja a jobokat.

### Korrektség (backend)
- Fleet TCO pénz `Decimal`-lal; reports/stats **UTC** dátum-bucketek; pénz-sort komparátorok
  `Prisma.Decimal.comparedTo`-val; rankings: ismeretlen megbízhatóság nem pontozódik legjobbként.

### Frontend (UX)
- **Accept-invite** oldal + endpoint-bekötés + linkes meghívó e-mail (404 megszűnt).
- **Contact-űrlap** valódi mailto-folyamatra kötve; **Privacy/Terms** oldalak + footer-linkek.
- **Néma hibák → error+retry** (`LoadErrorState`) a lista- és részletező oldalakon.
- **Modal a11y** (`useModalA11y`: role=dialog/Esc/fókusz) minden modálon.
- **Stub megfelelőség-adat** jelölve; rossz mentés-hibaüzenet javítva.
- **Nyers enum/kód → i18n** (DocumentReview kategória + „Bizonytalan", Insights itemCategory,
  Admin role/feature, billing funkció-jelvények); landing Pricing aktív locale; **404-oldal** szöveg.

> i18n kulcs-paritás végig fenntartva (hu/ro/en azonos kulcsok).

## Nyitott / elfogadott (külön, megtervezett munka)

- **TOCTOU a limit-ellenőrzéseken** (count-then-create tranzakció nélkül): konkurens kérések
  túlléphetik a keretet. Tranzakcionális (serializable) átírást igényel; a typecheck/build CI
  nem fogná meg egy tranzakció-szemantika hibáját, ezért **integrációs teszttel, külön PR-ben**.
  Render free (alacsony konkurrencia) mellett a kockázat alacsony.
- **Re-enqueue `jobId` no-op** (latens): ma minden upload friss UUID-t kap, így nem éles;
  egy jövőbeli „kézi újrafeldolgozás" funkció előtt kell rendezni.
- **Apró frontend-polish:** regisztráció nem validálja az adószámot; rankings export az aktív
  fül helyett mindig a szegmenst exportálja; landing fake testimonials + `PhaseNote` dead-code
  (tartalmi/launch döntés).
