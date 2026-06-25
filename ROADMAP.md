# Valloreg – Fejlesztési Roadmap

Fuvarozói / flottakezelő SaaS platform, amely szervizszámlákból OCR + AI segítségével
automatikusan épít digitális szerviztörténetet.

> **Architektúra alapelv:** multi-tenant adatbiztonság az **első** sortól. A core value
> az OCR + AI feldolgozás. A PWA/UI mélyítése és a SaaS-üzemeltetés (billing, admin)
> a core után jön. A kód moduláris, hogy minden fázis a meglévőre épüljön újratervezés nélkül.

Jelmagyarázat: `[ ]` nyitott · `[~]` folyamatban · `[x]` kész

---

## FÁZIS 1 – CORE ALAPOK

**Cél:** Biztonságos, multi-tenant, skálázható fundamentum, amelyre az összes további
modul ráépül. Itt dől el az adatizoláció, az auth és a feldolgozási pipeline váza.

**Implementálandó:**
- [x] Monorepo (pnpm workspaces + Turbo): `apps/api` (NestJS), `apps/web` (Next.js PWA), `packages/shared`
- [x] Infra: Docker Compose (PostgreSQL, Redis, MinIO/S3, MailHog)
- [x] Megosztott szerződések (`packages/shared`): szerepkörök, csomag-limitek, feature flag kulcsok, **extraction JSON kontraktus** (zod)
- [x] Adatmodell (Prisma): `Tenant`, `User`, `Membership`, `Vehicle`, `Document`, `Invoice`, `InvoiceItem`, `Supplier`, `AuditLog`, `FeatureFlag`, `Plan/Subscription`, `SupportAccess`, tanuló mapping táblák
- [x] Tenant-izoláció: `tenant_id` minden üzleti rekordban + Prisma kiterjesztés a kötelező tenant-scope-ra
- [x] Auth: JWT (access + refresh), regisztráció, login, jelszó-reset, RBAC guard
- [x] RBAC: OWNER / FLEET_MANAGER / ADMIN / ACCOUNTANT / VIEWER + platform SUPER_ADMIN
- [x] Audit log modul (minden érzékeny művelet naplózva)
- [x] Async infrastruktúra: BullMQ + Redis queue modul, worker váz, idempotens job-kulcs
- [x] Storage absztrakció: S3/MinIO adapter (presigned upload/download)
- [x] OCR + Extraction **portok** (interface-ek) stub implementációval (Fázis 2 plugint vár)
- [x] Frontend váz: Next.js App Router, Tailwind brand téma, i18n (hu/ro/en), PWA manifest + SW, app shell, auth + dashboard skeleton, landing skeleton
- [x] CI: lint + typecheck + build (GitHub Actions) – `.github/workflows/ci.yml`

**Deliverable:** Futtatható monorepo. Egy cég regisztrálhat, beléphet, tenant-izolált
adatokat lát; a dokumentum-feltöltés tárolásig eljut; a feldolgozó queue és a provider
portok készen állnak. PWA telepíthető, 3 nyelven jelenik meg.

**NEM része (scope control):** valódi OCR/AI hívás, tételszintű szétosztó UI, billing,
super admin felület, riportok, push értesítések, natív appok.

---

## FÁZIS 2 – OCR + AI MOTOR (MVP VALUE)

**Cél:** A platform „core intelligence layer”-e. Feltöltött számlából automatikusan
strukturált, validált adat lesz minimális emberi beavatkozással.

**Implementálandó:**
- [x] OCR réteg: pluggable provider (stub + Gemini OCR; Mistral/Google Document AI portként előkészítve), HU/RO/EN, szkennelt + digitális PDF, szöveg + layout kinyerés
- [x] Extraction réteg (AI/LLM): OCR szövegből a `packages/shared` **extraction JSON** előállítása (beszállító, dátum, számlaszám, pénznem, tételek, árak, adók, rendszám/VIN jelöltek, confidence)
- [x] Hiányos/hibás adat kezelés → `uncertainFields`
- [x] Intelligens kategorizálás: tétel besorolás (jármű / szerszám / általános / iroda) + alkatrésztípus felismerés (fék, motor, szűrő…)
- [x] Aszinkron pipeline: upload → OCR job → extraction job → kategorizálás → review-ready állapot (BullMQ)
- [x] Idempotencia (dokumentum-hash alapú), retry + dead-letter queue
- [x] Minden AI/OCR döntés audit-logba; nyers OCR és prompt/response megőrzése debughoz (tenant-izoláltan)
- [x] Confidence-alapú státusz: `AUTO_OK` vs `NEEDS_REVIEW`

**Deliverable:** Feltöltött számla a háttérben feldolgozódik és strukturált, kategorizált,
review-re kész adattá válik. Mérhető pontosság teszt-számlákon.

**NEM része:** jármű-hozzárendelő UI finomságok, többjárműes szétosztó UX (csak adatmodell-szinten),
tanulás (csak az adat gyűjtése indul), billing/admin.

---

## FÁZIS 3 – WORKFLOW + JÁRMŰ KEZELÉS

**Cél:** Human-in-the-loop ellenőrzés, jármű-hozzárendelés és a tanuló rendszer. Itt válik
a nyers AI-kimenet megbízható, jóváhagyott szerviztörténetté.

**Implementálandó:**
- [x] Jármű matching engine: rendszám / VIN / beszállítói minta / korábbi adatok alapján jelölt, bizonytalanságnál megerősítés
- [x] Review UI: jármű választás/módosítás/új jármű, tételenkénti hozzárendelés (1 jármű / több jármű / általános / szerszám / iroda)
- [x] Több jármű egy számlán: tételszintű szétosztás, csak a járműhöz rendelt tétel számít a jármű költségébe
- [x] Jármű digitális szervizkönyv: számlák, javítások, alkatrészek, munkadíjak, km-állások, dokumentum-archívum, idővonal
- [x] Tanuló rendszer: supplier→jármű és tétel→kategória mapping tárolás és javaslat, pontosság javulás
- [x] Dashboard: havi/éves költség, költség/jármű, költség/km, közelgő karbantartás, legdrágább járművek, doksi- és eseményszám
- [x] Dokumentumkezelés: drag&drop, tömeges feltöltés, előnézet, keresés, archiválás

**Deliverable:** Teljes „feltölt → AI javasol → felhasználó jóváhagy → szervizkönyv frissül”
ciklus, működő tanulással és dashboarddal.

**NEM része:** előfizetés-fizetés, super admin, feature flag UI, push, integrációk.

---

## FÁZIS 4 – SCALE + SAAS (billing, admin, feature flags)

**Cél:** A termék eladható, üzemeltethető, skálázható SaaS-szá válik.

**Implementálandó:**
- [x] Előfizetési csomagok + limit-érvényesítés (jármű/felhasználó/tárhely/dokumentum), Starter/Standard/Professional/Business
- [x] Számlázás integráció: **utalásos** fizetés (bankszámla-adatok + fejlesztői értesítés), próbaidőszak, állapotok. *(Stripe-port a jövőre hagyva.)*
- [x] Super Admin panel: cégek, előfizetések, csomagok, limitek, funkciók, audit logok
- [x] Feature flag rendszer: cégenkénti engedélyezés (OCR, AI, Dashboard, Riportok, API, Export, Emlékeztetők, Dokumentumtár)
- [x] Adatvédelem: üzemeltető alapból NEM látja a számlák/dokumentumok/költségek tartalmát; csak rendszeradat, statisztika, hibák, audit
- [x] Support access: ideiglenes (1 óra / 24 óra / 7 nap), teljesen naplózva
- [~] Felhasználókezelés: email meghívás + szerepkörök **kész**; **2FA** és **opcionális Google login** még nyitott
- [x] Landing page teljes (10 szekció), lead/demo/trial; riportok + export; push értesítések
- [~] Megfigyelhetőség: health-check + alap metrikák **kész**; tracing, alerting és a több-instance worker leader-election (lásd `docs/AUDIT_FINDINGS.md`) még nyitott

**Deliverable:** Több száz cég, több ezer jármű, több százezer dokumentum kiszolgálására
kész, fizetős, üzemeltethető SaaS.

**NEM része (jövő):** natív Android/iOS, üzemanyag/útdíj/biztosítás/műszaki modulok,
ERP/könyvelői integrációk, nyílt API marketplace — ezek a moduláris architektúrára épülnek rá.

---

## FÁZIS 5 – AUTOMATION LAYER (a meglévő okosítása)

**Cél:** A termék ne csak *tárolja* a szerviztörténetet, hanem proaktívan
cselekedjen a felhasználó helyett. Ez a fő versenyképességi különbség a passzív
nyilvántartókhoz képest.

> **Hatókör-elv:** NEM építünk teljeskörű TMS-t. A fókusz végig a
> **szerviztörténet + riportok** marad – ezt tesszük proaktívvá és
> intelligensebbé. **Nincs** könyvelő-export / ERP / SAF-T integráció.

### 5/A – Proaktív emlékeztetők (KÉSZ)

- [x] `Reminder` adatmodell (karbantartás + megfelelőség), tenant-izolált
- [x] Idő- és km-alapú esedékesség, ismétlődő intervallum, „kész” → előregördülő határidő
- [x] Számított sürgősség: `ok` / `due_soon` / `overdue`
- [x] Napi háttér-ütemező (BullMQ ismétlődő job) – esedékesség-szkennelés, throttle-olt értesítés
- [x] Értesítés: Web Push a céghez + e-mail a tulajdonosnak
- [x] Történet-alapú karbantartási **javaslatok** (auto-suggest a szerviztételekből)
- [x] UI: `/reminders` oldal, dashboard widget + **gyors feltöltés a vezérlőpulton**, jármű-szintű panel
- [x] REMINDERS feature flag élővé tétele (eddig csak deklarált volt)

### 5/B – Tier 2 (KÉSZ)

- [x] **Költség-anomália detektálás:** tétel egységár vs. kategória-medián
      (túlárazás), azonos beszállító+számlaszám (duplikátum), kiugró számlaösszeg.
      Olvasásidőben számított, a REPORTS feature mögött. UI: `/insights` + dashboard widget
- [x] **Tanulási hurok erősítés:** tétel-minta → kategória/típus mapping rögzítése
      kézi felülbíráláskor (eddig az `ItemCategoryMapping` modell használatlan volt)
- [x] **Automatizáltsági metrika:** AUTO_OK / (AUTO_OK + NEEDS_REVIEW) arány a dashboardon
- [x] **Ütemezett havi riport e-mailben:** a MEGLÉVŐ riport automatikus kiküldése a
      tulajdonosnak (havi BullMQ job) – NEM könyvelő-export, NEM integráció

### 5/D – Jármű felvétele forgalmi engedélyből (KÉSZ)

- [x] Forgalmi engedély (1–2 kép vagy PDF) **beolvasása**: OCR + AI kiolvasás
      (új `VehicleExtractionProvider` port: stub + Gemini), szinkron `POST /vehicles/scan`
- [x] **Ellenőrző űrlap** előtöltve, alacsony-confidence mezők kiemelve; mobil kamera (`capture`)
- [x] **Duplikátum-felismerés** (rendszám/VIN) → meglévő jármű frissítése új helyett
- [x] A beolvasott kép **archiválása** a jármű dokumentum-archívumában (`VehicleDocument`),
      letöltés a részletezőn; jármű törlésekor az S3 fájl is takarítódik
- [x] Adatvédelem: a tulajdonos neve (személyes adat) csak ellenőrzéshez, nem perzisztáljuk

### 5/F – RO megfelelőség auto-lekérés (ITP / RCA / rovinietă) (KÉSZ)

- [x] Pluggable `VehicleVerificationProvider` (stub + `ro` külső API-ra kész);
      env: `VEHICLE_VERIFY_PROVIDER`, `RO_VERIFY_API_URL/KEY`. API nélkül stub/biztonságos.
- [x] `VehicleVerification` rekord (ITP/RCA/rovinietă lejárat, forrás, állapot, ellenőrizve)
- [x] Az eredmény **automatikusan tölti** a compliance emlékeztetők lejáratát
      (`source="verification"`, a kézi emlékeztetőket nem írja felül) → a napi szkenner értesít
- [x] Heti BullMQ ütemező (boot-biztos) RO-rendszámú járművekre + manuális „Ellenőrzés most"
- [x] UI: megfelelőség-panel a jármű-részletezőn (lejáratok + státusz-badge)
- [x] **Dokumentum-alapú (API NÉLKÜLI) lekérés:** ITP/RCA/rovinietă igazolás
      beolvasása (OCR + AI) → lejárat kiolvasása → megerősítés után emlékeztető +
      dokumentum-archívum. Új `ComplianceExtractionProvider` (stub + Gemini).
      Ez a fő, legális megoldás külső adat-API nélkül.

> Megjegyzés: a RO hatósági/biztosítói adat nincs garantált nyílt API-ban; az
> automatikus lekérés kereskedelmi/saját proxy API-t igényel (a provider erre kész,
> scraping kerülve). API nélkül a dokumentum-alapú beolvasás a javasolt út.

### 5/E – Tömeges járműimport CSV-ből (KÉSZ)

- [x] CSV feltöltés → **soronkénti validáció + előnézet** (create/update/error besorolás),
      majd véglegesítés (`POST /vehicles/import/preview` és `/commit`)
- [x] Duplikátum-kezelés (rendszám/VIN → frissítés), fájlon belüli dupla kiszűrése,
      csomag jármű-limit érvényesítése, HU/RO/EN oszlop-aliasok, `;`/`,` elválasztó
- [x] UI: import modal (előnézet-tábla státusz-badge-ekkel) + sablon letöltés; külső függés nélkül

### 5/C – Tier 3 (KÉSZ)

- [x] **Prediktív karbantartás finomítás:** a jármű SAJÁT történetéből tanult
      intervallumok (2+ adatpontból átlagolt km-/nap-távolság); alap-intervallum
      csak fallback. A javaslat jelzi, ha tanult (`source`, `dataPoints`)
- [x] **Prediktív TCO / csere-javaslat:** járművenkénti összköltség, költségtrend
      (utolsó 12 hó vs. előző 12 hó), költség/km és csere-javaslat
      (`ok` / `watch` / `consider_replacement`). UI: `/insights` TCO szekció

**Tudatosan NEM ide tartozik (külön döntéssel, később):** könyvelő-export,
ERP / számlázz.hu / SAF-T integráció, teljes TMS (telematika, sofőr-/útdíj-/
üzemanyag-modulok), e-mail-alapú számlabeolvasás.

---

## Architektúra-útvonal összefoglaló

```
MVP            →  Produktív SaaS   →  Automatizálás     →  Skálázható enterprise
Fázis 1–2         Fázis 3             Fázis 5/A (kész)     Fázis 4 + 5/B + jövőbeli modulok
core + AI         workflow + tanulás  proaktív emlékeztető billing, admin, scale, okos riport
```
