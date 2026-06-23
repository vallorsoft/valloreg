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
- [~] Adatmodell (Prisma): `Tenant`, `User`, `Membership`, `Vehicle`, `Document`, `Invoice`, `InvoiceItem`, `Supplier`, `AuditLog`, `FeatureFlag`, `Plan/Subscription`, `SupportAccess`, tanuló mapping táblák
- [~] Tenant-izoláció: `tenant_id` minden üzleti rekordban + Prisma kiterjesztés a kötelező tenant-scope-ra
- [~] Auth: JWT (access + refresh), regisztráció, login, jelszó-reset, RBAC guard
- [~] RBAC: OWNER / FLEET_MANAGER / ADMIN / ACCOUNTANT / VIEWER + platform SUPER_ADMIN
- [~] Audit log modul (minden érzékeny művelet naplózva)
- [~] Async infrastruktúra: BullMQ + Redis queue modul, worker váz, idempotens job-kulcs
- [~] Storage absztrakció: S3/MinIO adapter (presigned upload/download)
- [~] OCR + Extraction **portok** (interface-ek) stub implementációval (Fázis 2 plugint vár)
- [~] Frontend váz: Next.js App Router, Tailwind brand téma, i18n (hu/ro/en), PWA manifest + SW, app shell, auth + dashboard skeleton, landing skeleton
- [ ] CI: lint + typecheck + build (GitHub Actions)

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
- [ ] OCR réteg: pluggable provider (Mistral OCR / Google Document AI), HU/RO/EN, szkennelt + digitális PDF, szöveg + layout kinyerés
- [ ] Extraction réteg (AI/LLM): OCR szövegből a `packages/shared` **extraction JSON** előállítása (beszállító, dátum, számlaszám, pénznem, tételek, árak, adók, rendszám/VIN jelöltek, confidence)
- [ ] Hiányos/hibás adat kezelés → `uncertainFields`
- [ ] Intelligens kategorizálás: tétel besorolás (jármű / szerszám / általános / iroda) + alkatrésztípus felismerés (fék, motor, szűrő…)
- [ ] Aszinkron pipeline: upload → OCR job → extraction job → kategorizálás → review-ready állapot (BullMQ)
- [ ] Idempotencia (dokumentum-hash alapú), retry + dead-letter queue
- [ ] Minden AI/OCR döntés audit-logba; nyers OCR és prompt/response megőrzése debughoz (tenant-izoláltan)
- [ ] Confidence-alapú státusz: `AUTO_OK` vs `NEEDS_REVIEW`

**Deliverable:** Feltöltött számla a háttérben feldolgozódik és strukturált, kategorizált,
review-re kész adattá válik. Mérhető pontosság teszt-számlákon.

**NEM része:** jármű-hozzárendelő UI finomságok, többjárműes szétosztó UX (csak adatmodell-szinten),
tanulás (csak az adat gyűjtése indul), billing/admin.

---

## FÁZIS 3 – WORKFLOW + JÁRMŰ KEZELÉS

**Cél:** Human-in-the-loop ellenőrzés, jármű-hozzárendelés és a tanuló rendszer. Itt válik
a nyers AI-kimenet megbízható, jóváhagyott szerviztörténetté.

**Implementálandó:**
- [ ] Jármű matching engine: rendszám / VIN / beszállítói minta / korábbi adatok alapján jelölt, bizonytalanságnál megerősítés
- [ ] Review UI: jármű választás/módosítás/új jármű, tételenkénti hozzárendelés (1 jármű / több jármű / általános / szerszám / iroda)
- [ ] Több jármű egy számlán: tételszintű szétosztás, csak a járműhöz rendelt tétel számít a jármű költségébe
- [ ] Jármű digitális szervizkönyv: számlák, javítások, alkatrészek, munkadíjak, km-állások, dokumentum-archívum, idővonal
- [ ] Tanuló rendszer: supplier→jármű és tétel→kategória mapping tárolás és javaslat, pontosság javulás
- [ ] Dashboard: havi/éves költség, költség/jármű, költség/km, közelgő karbantartás, legdrágább járművek, doksi- és eseményszám
- [ ] Dokumentumkezelés: drag&drop, tömeges feltöltés, előnézet, keresés, archiválás

**Deliverable:** Teljes „feltölt → AI javasol → felhasználó jóváhagy → szervizkönyv frissül”
ciklus, működő tanulással és dashboarddal.

**NEM része:** előfizetés-fizetés, super admin, feature flag UI, push, integrációk.

---

## FÁZIS 4 – SCALE + SAAS (billing, admin, feature flags)

**Cél:** A termék eladható, üzemeltethető, skálázható SaaS-szá válik.

**Implementálandó:**
- [ ] Előfizetési csomagok + limit-érvényesítés (jármű/felhasználó/tárhely/dokumentum), Starter/Standard/Professional/Business
- [ ] Számlázás integráció (Stripe vagy hasonló), próbaidőszak, állapotok
- [ ] Super Admin panel: cégek, előfizetések, csomagok, limitek, funkciók, audit logok
- [ ] Feature flag rendszer: cégenkénti engedélyezés (OCR, AI, Dashboard, Riportok, API, Export, Emlékeztetők, Dokumentumtár)
- [ ] Adatvédelem: üzemeltető alapból NEM látja a számlák/dokumentumok/költségek tartalmát; csak rendszeradat, statisztika, hibák, audit
- [ ] Support access: ideiglenes (1 óra / 24 óra / 7 nap), teljesen naplózva
- [ ] Felhasználókezelés: email meghívás, szerepkörök, 2FA, opcionális Google login
- [ ] Landing page teljes (10 szekció), lead/demo/trial; riportok + export; push értesítések
- [ ] Megfigyelhetőség: metrikák, tracing, alerting; horizontálisan skálázott workerek

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

### 5/C – Tier 3 (következő feladatok)

- [ ] **Prediktív karbantartás finomítás:** tanult intervallumok 2+ adatpontból
      (az alapértelmezett intervallumok helyett/mellett)
- [ ] **Prediktív TCO / csere-javaslat:** növekvő szervizköltség-trend a szerviztörténetből

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
