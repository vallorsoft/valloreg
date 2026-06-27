# Valloreg – GDPR és jogi megfelelőségi audit jelentés

> **Verzió:** 1.0 · **Audit dátuma:** 2026-06-24 · **Módszer:** teljes kódbázis-,
> infrastruktúra-, séma-, integráció- és frontend-elemzés (statikus kódvizsgálat).
> **Forrás:** `apps/api`, `apps/web`, `packages/shared`, `prisma/schema.prisma`,
> `render.yaml`, `docker-compose.yml`, `.env.example`, `docs/*`.

Ez a jelentés a tényleges megvalósítást tükrözi. Ahol egy állítás nem volt
egyértelműen levezethető a kódból, azt `📌 FELTÉTELEZÉS` jelöli. Ahol jogi
mérlegelés kell, ott `⚠️ ÜGYVÉDI ELLENŐRZÉS` áll.

---

## 0. Vezetői összefoglaló

A **Valloreg** egy többbérlős (multi-tenant) **SaaS** platform fuvarozó- és
flottakezelő cégeknek. Fő funkció: szervizszámlák és járműokmányok feltöltése,
majd **OCR + AI** alapú automatikus kiolvasás, kategorizálás és digitális
szerviztörténet építése, kiegészítve karbantartási/megfelelőségi emlékeztetőkkel
és anonimizált flotta-benchmarkkal.

**Adatvédelmi szerepkörök (kulcsfontosságú):**
- A **felhasználó cégei (tenant)** az általuk feltöltött üzleti adatok (számlák,
  járművek, sofőr-/jármű-adatok) tekintetében **adatkezelők**; a Valloreg
  üzemeltetője e tekintetben **adatfeldolgozó** → szükséges a **DPA** (5. dok.).
- A **fiók- és számlázási adatok** (felhasználói e-mail, név, cégadat, IP, audit
  napló) tekintetében a **Valloreg üzemeltetője az adatkezelő**.

**Legfontosabb megállapítások:**
- ✅ Erős multi-tenant izoláció (fail-closed Prisma tenant-scope), `argon2`
  jelszó-hash, rotált+visszavonható refresh token, helmet, TLS, audit napló.
- ✅ Adattakarékosság: a forgalmiból kiolvasott **tulajdonos neve NEM kerül
  tárolásra** (`vehicle-extraction.ts`).
- ✅ Nincs analitika/követés, nincs harmadik féltől származó süti, rendszer-betűtípus.
- ⚠️ **Nincs fiók-/adat-törlési (GDPR 17. cikk) és adathordozhatósági (20. cikk)
  végpont** – kritikus hiány.
- ⚠️ **Nincs rate limiting** (a `SECURITY.md` ezt állítja, a kód nem valósítja meg).
- ⚠️ **2FA mező létezik, de nincs implementálva.**
- 🔴 **KRITIKUS:** a `.env.example` **élő Neon adatbázis-jelszót** tartalmaz, ami
  **be van commitolva a git-be** → azonnali kulcsrotáció szükséges.
- ⚠️ Auth tokenek `localStorage`-ban (XSS-kockázat; a kód maga is „Fázis 1"
  ideiglenesnek jelöli).
- ⚠️ Nincs egyetlen élő jogi oldal sem (a footer „Adatvédelem"/„Feltételek" csak
  `<span>`, nem link).

---

## 1. Kötelezően, kézzel megadandó CÉGADATOK

A kódból **nem** állapítható meg egyetlen cégadat sem. Az alábbiak **kötelezően
pótolandók** a dokumentumok élesítése előtt:

| Adat | Állapot | Megjegyzés |
|------|---------|------------|
| Cég hivatalos neve | VALLOR TEAM SRL | A márkanév „Valloreg"; üzemeltető: VALLOR TEAM SRL (e-mail: vallorsoft@gmail.com) |
| Cégforma / cégjegyzékszám (Nr. ORC / Cégjegyzék) | J2023000114142 · EUID: ROONRC.J2023000114142 | RO ORC |
| Adószám / VAT / CUI | 47859317 | RO CUI |
| Bejegyzett székhely (teljes cím) | Sat Arcuș, Cart. Poiana Arcușului nr. 102, cod 527166, jud. Covasna, România | |
| Kapcsolattartó e-mail | vallorsoft@gmail.com | |
| Telefonszám | 0769532015 | |
| Adatvédelmi kapcsolattartó / DPO | 【KITÖLTENDŐ】 | DPO kötelezettség vizsgálandó (lásd lent) ⚠️ |
| Bankszámla (utalásos fizetéshez) | 【KITÖLTENDŐ: bankszámla – kedvezményezett, IBAN, bank, SWIFT】 | env: `BANK_TRANSFER_BENEFICIARY/IBAN/BANK/SWIFT` jelenleg üres |
| Felügyeleti hatóság | ANSPDCP – https://www.dataprotection.ro | A székhely RO (jud. Covasna) |
| Szolgáltatás elérhető országai | 【KITÖLTENDŐ】 | UI nyelvek: hu/ro/en → HU, RO, nemzetközi (megerősítendő) |
| Áraknál: nettó vagy bruttó (ÁFA/TVA) | 【KITÖLTENDŐ】 | A kód „nettó"-t mond, az UI nem jelzi ⚠️ fogyasztóvédelem |

> ⚠️ **ÜGYVÉDI ELLENŐRZÉS – DPO:** A GDPR 37. cikk szerinti adatvédelmi
> tisztviselő kinevezése akkor kötelező, ha a fő tevékenység rendszeres és
> szisztematikus, nagyléptékű megfigyelés vagy különleges adatok nagyléptékű
> kezelése. A Valloreg jelenleg nem kezel különleges (9. cikk) adatot, de a
> jármű-/megfelelőségi adatok és a benchmark miatt érdemes mérlegelni.

---

## 2. Platform-elemzés

- **Típus:** többbérlős B2B **SaaS** (előfizetéses), nem marketplace, nem webshop.
- **Frontend:** Next.js (App Router) + TypeScript + TailwindCSS, **PWA**
  (telepíthető, service worker, web push). i18n: hu / ro / en.
- **Backend:** NestJS (REST), Prisma ORM, PostgreSQL (Neon), Redis + BullMQ
  (aszinkron feldolgozás), S3-kompatibilis tár (Cloudflare R2 / MinIO).
- **Funkciók:** dokumentum-feltöltés és OCR/AI kiolvasás; számla- és tételkezelés;
  jármű-nyilvántartás; forgalmi-beolvasás (scan); RO megfelelőség (ITP/RCA/
  rovinietă) ellenőrzés; emlékeztetők (karbantartás + megfelelőség); riportok és
  export; insights/anomáliák; flotta-benchmark („Európai trendek"); csapat/meghívók;
  számlázás (utalásos); admin-panel; web push értesítések.
- **Felhasználói szerepkörök (tenant):** `OWNER`, `ADMIN`, `FLEET_MANAGER`,
  `ACCOUNTANT`, `VIEWER`. **Platform:** `isPlatformAdmin` (Super Admin).
- **Hitelesítés:** e-mail + jelszó (`argon2`), JWT access (15 perc) + refresh
  (14 nap, rotált, hash-elve tárolt, visszavonható). E-mailes meghívó. Jelszó-
  visszaállítás tokennel (1 óra). **2FA: nincs implementálva** (mező létezik).
  **Google login: nincs implementálva** (csak terv).
- **Előfizetés/fizetés:** **banki utalás** (nincs bankkártya/Stripe). A Super
  Admin aktivál manuálisan. 14 napos ingyenes próba.
- **Külső integrációk:** Google Gemini (AI/OCR, opcionális), Brevo (e-mail,
  opcionális), Cloudflare R2 (tár), Neon (DB), Render (hosting), Web Push (böngésző
  push szolgáltatások), RO megfelelőség-API (opcionális), recall feed (opcionális).

> 📌 **FELTÉTELEZÉS:** Több AI/külső szolgáltató **alapértelmezésben `stub`** (nem
> hív ki külső rendszert). Élesben ezeket be kell kapcsolni; a jogi dokumentumok a
> **production konfigurációt** írják le, és jelzik a feltételességet.

---

## 3. Személyes adatok leltára

A séma (`schema.prisma`) és a kód alapján kezelt személyes/üzleti adatok:

| Adat(kör) | Hol (modell/mező) | Forrás | Cél | Jogalap (GDPR) | Tárolás helye |
|---|---|---|---|---|---|
| E-mail | `User.email`, `Invitation.email`, `Tenant.email` | felhasználó | hitelesítés, kapcsolat | szerződés (6(1)b) | Neon (EU) |
| Jelszó (argon2 hash) | `User.passwordHash` | felhasználó | hitelesítés | szerződés (6(1)b) | Neon (EU) |
| Név | `User.name`, `Tenant.contactName` | felhasználó | azonosítás, kapcsolat | szerződés/jogos érdek | Neon (EU) |
| Cégadatok (név, adószám) | `Tenant.name`, `Tenant.taxNumber` | felhasználó | számlázás, szerződés | szerződés / jogi köt. (6(1)c) | Neon (EU) |
| Telefonszám | `Tenant.phone` | felhasználó | kapcsolat | jogos érdek (6(1)f) | Neon (EU) |
| IP-cím | `AuditLog.ip` | rendszer | biztonság, naplózás | jogos érdek (6(1)f) | Neon (EU) |
| Eszköz/böngésző (User-Agent) | `PushSubscription.userAgent` | böngésző | push kézbesítés | hozzájárulás (6(1)a) | Neon (EU) |
| Push végpont + kulcsok | `PushSubscription.endpoint/p256dh/auth` | böngésző | értesítés | hozzájárulás (6(1)a) | Neon (EU) |
| Feltöltött dokumentumok (számla/forgalmi/megfelelőségi PDF/kép) | objektumtár + `Document`, `VehicleDocument`, `VehicleScan.files` | felhasználó | OCR/AI feldolgozás, archívum | szerződés (tenant adatkezelő) | R2/MinIO |
| Kiolvasott számlaadatok | `Invoice`, `InvoiceItem`, `Invoice.extractionRaw` (nyers AI JSON) | AI/OCR | szerviztörténet, költség | szerződés | Neon (EU) |
| Jármű-adatok (rendszám, VIN, márka, modell, év, km) | `Vehicle`, `VehicleScan.draft` | felhasználó/OCR | flottakezelés | szerződés | Neon (EU) |
| Megfelelőségi lejáratok (ITP/RCA/rovinietă) | `VehicleVerification` | RO API / OCR | emlékeztető | szerződés | Neon (EU) |
| Emlékeztetők (jegyzetek) | `Reminder.notes/title` | felhasználó | karbantartás | szerződés | Neon (EU) |
| Audit napló (ki, mit, mikor, IP) | `AuditLog` | rendszer | elszámoltathatóság, biztonság | jogos érdek / jogi köt. | Neon (EU) |
| Refresh / jelszó-reset token (hash) | `RefreshToken`, `PasswordResetToken` | rendszer | munkamenet | szerződés | Neon (EU) |
| Számlázási hivatkozás (`VLR-…`), összeg | e-mail (Brevo) + `AuditLog.metadata` | rendszer | utalás-azonosítás | szerződés | Neon / Brevo |
| Anonimizált benchmark | `FleetBenchmark` | aggregáció | piaci összevetés | jogos érdek (anonim) | Neon (EU) |

**Külön kiemelendők:**
- 🟢 **Tulajdonos neve a forgalmiból:** kiolvasásra kerül a memóriában, de
  **NEM perzisztálódik** (`vehicle-extraction.ts`) → adattakarékosság. ⚠️ A
  feldolgozás során átmenetileg megjelenhet a Geminihez küldött tartalomban.
- 🟡 **Fájlnevek:** a tárolt fájlnév tartalmazhat személyes adatot (pl.
  `kovacs_janos_szamla.pdf`); push értesítés és audit metaadat is tárolhatja.
- 🟡 **`extractionRaw` (nyers AI JSON):** a teljes kiolvasott tartalmat tárolja,
  ami a számla összes adatát (akár sofőr-/aláíró-nevet) tartalmazhatja.
- 🔵 **Sofőr-/járművezető-adat:** dedikált mező nincs, de szabad szöveges
  mezőkben (számlatételek, jegyzetek) előfordulhat → a tenant felelőssége.

> ⚠️ **ÜGYVÉDI ELLENŐRZÉS:** A jogalapokat (különösen jogos érdek vs. szerződés)
> tételesen meg kell erősíteni; jogos érdeknél **érdekmérlegelési teszt** kell.

---

## 4. Adatáramlási térkép

1. **Belépés:** a felhasználó a böngészőből (HTTPS) tölt fel fájlt / ad meg adatot
   a Next.js frontenden → NestJS API (CORS-korlátozott, helmet, validáció).
2. **Tárolás:** a fájl az S3-kompatibilis tárba kerül (`tenants/{tenantId}/…`
   prefix); a metaadat és kiolvasott adat a Neon PostgreSQL-be. Hozzáférés
   presigned URL-lel (15 perc).
3. **Feldolgozás:** a feltöltés egy BullMQ jobot tesz a Redis sorba; a worker
   letölti a fájlt a tárból, **OCR + AI** kiolvasást végez. Ha a provider
   `gemini`, a fájl(kép/PDF) base64-ként a **Google Gemini API**-hoz kerül (US).
4. **Megfelelőség:** opcionálisan a rendszám/VIN egy **RO megfelelőség-API**-hoz
   kerül (ITP/RCA/rovinietă lejáratokért).
5. **Értesítés:** e-mail a **Brevo**-n keresztül (EU); web push a böngésző push
   szolgáltatásán át (pl. Google FCM / Mozilla / Apple).
6. **Nemzetközi adattovábbítás:** lásd 5. szakasz – elsősorban a **Google Gemini
   (US)** és a US-anyacégű szolgáltatók (Cloudflare, Render, Neon) miatt.
7. **Mentések:** a Neon és az R2 szolgáltatói szintű mentést/replikációt biztosít;
   **dedikált alkalmazás-szintű mentési eljárás nincs a kódban dokumentálva.** 📌
8. **Törlés:** kaszkád törlés a sémában definiált (`onDelete: Cascade`), **de
   nincs API-végpont, amely felhasználó-/tenant-törlést kiváltana**, és az S3
   objektumok automatikus törlése sem garantált → lásd 7. és hiánylista.

---

## 5. Harmadik felek / alfeldolgozók auditja

| Szolgáltató | Cél | Ország/régió | EGT-n kívülre? | SCC szükséges? | Állapot |
|---|---|---|---|---|---|
| **Neon** (PostgreSQL) | adatbázis | AWS `eu-central-1` (Frankfurt) | adat EU-ban; anyacég US | igen (US anyacég) ⚠️ | aktív (kötelező) |
| **Cloudflare R2** | dokumentum-tár | konfigurálható (R2, `auto`) | lehet, anyacég US | igen ⚠️ | aktív (prod) |
| **Render** | hosting (API, web, Redis) | Frankfurt (EU) | anyacég US | igen ⚠️ | aktív (prod) |
| **Brevo** (Sendinblue) | tranzakciós e-mail | Franciaország (EGT) | nem | nem (EGT) | opcionális (`BREVO_API_KEY`) |
| **Google Gemini** | AI/OCR kiolvasás | USA | **igen** | **igen** ⚠️ | opcionális (`gemini`); alap `stub` |
| **Böngésző push szolg.** (Google/Mozilla/Apple) | web push kézbesítés | jellemzően US | igen | igen ⚠️ | opcionális (VAPID) |
| **RO megfelelőség-API** | ITP/RCA/rovinietă | Románia (konfig.) | nem (vélhetően) | nem | opcionális; alap `stub` |
| **Recall feed** | visszahívások | EU (konfig.) | nem | nem | opcionális; alap `stub` (kurált lista) |

> ⚠️ **ÜGYVÉDI ELLENŐRZÉS / TEENDŐ:** Minden aktív szolgáltatóval **adatfeldolgozói
> szerződés (DPA)** és EGT-n kívülre **SCC + Transfer Impact Assessment** szükséges.
> A Google és számos US szolgáltató tagja az **EU–US Data Privacy Framework**-nek –
> ezt szolgáltatónként ellenőrizni kell.

A teljes, ügyfélnek publikálandó listát lásd: `11_Alfeldolgozok_Listaja.md`.

---

## 6. Cookie- és követés-audit

- **Hagyományos süti:** a frontend **nem** használ klasszikus sütit hitelesítésre.
- **localStorage kulcsok** (`apps/web/src/lib/auth.ts`):
  - `valloreg.accessToken` – JWT access token (feltétlenül szükséges)
  - `valloreg.refreshToken` – JWT refresh token (feltétlenül szükséges)
  - `valloreg.activeTenantId` – aktív cég azonosító (feltétlenül szükséges, funkcionális)
- **Analitika / marketing / harmadik féltől származó követő:** **NINCS** (nincs
  Google Analytics, GTM, Meta Pixel, Sentry, Hotjar, Plausible, PostHog stb.).
- **Betűtípus/CDN:** rendszer-betűtípus, nincs Google Fonts; minden ikon helyi.
- **Service worker / PWA:** offline shell + **web push** (külön hozzájárulással).
- **Következmény:** mivel csak **feltétlenül szükséges** technikai tárolás van,
  az ePrivacy szerint **előzetes hozzájárulás nem kötelező** ezekhez; **tájékoztatás
  viszont igen**. A web push **hozzájáruláshoz kötött** (böngésző engedélykérés).

Teljes leltár: `03_Cookie_Szabalyzat.md`. Sávszövegek: `04_Cookie_Banner_Szovegek.md`.

---

## 7. Biztonsági áttekintés és GDPR-kockázatok

**Erősségek:**
- `argon2` jelszó-hash; JWT access 15 perc + refresh 14 nap (rotáció, SHA-256
  hash-elt tárolás, visszavonás logoutkor és jelszó-resetkor).
- Multi-tenant izoláció Prisma kiterjesztéssel, **fail-closed** (tenant kontextus
  hiányában hibát dob). Membership-ellenőrzés guarddal.
- `helmet`, CORS allowlist (`CORS_ORIGINS`), `class-validator` whitelist.
- TLS adatbázisra (`sslmode=require`), presigned URL 15 perc, tenant-prefix.
- Audit napló minden érzékeny műveletre (IP-vel).
- Super Admin **alapból nem látja** a tenant üzleti tartalmát.
- Benchmark **k-anonimitás** (≥5 cég és ≥20 jármű) + opt-in.

**Hiányosságok / kockázatok:**
| Kockázat | Súlyosság | Részlet |
|---|---|---|
| Élő DB-jelszó a `.env.example`-ben, git-be commitolva | 🔴 kritikus | Azonnali rotáció + git-előzmény tisztítás |
| Nincs törlési (17. cikk) végpont | 🔴 magas | Sem felhasználó, sem tenant törlés API nincs |
| Nincs adathordozhatóság (20. cikk) / export-végpont | 🟠 magas | Gépi exportot biztosítani kell |
| Nincs rate limiting | 🟠 magas | Brute-force a login/reset/register ellen lehetséges |
| 2FA nincs implementálva | 🟡 közepes | `twoFactorSecret` mező használaton kívül |
| `INTEGRATION_ENC_KEY` nincs használva | 🟡 közepes | Nincs alkalmazás-szintű mezőtitkosítás |
| Auth token `localStorage`-ban | 🟡 közepes | XSS-kockázat; httpOnly cookie javasolt (kód is jelzi) |
| Fájlnév/`extractionRaw` személyes adatot tárolhat | 🟡 közepes | Adattakarékosság/áttekintés szükséges |
| Mentés/visszaállítás eljárás nincs dokumentálva | 🟡 közepes | Szolgáltatói mentésre támaszkodik |
| `SECURITY.md` állít rate limitinget, kód nem | 🟡 dokumentációs | Dok. és valóság eltér |
| Dok. (`OCR_AI_ENGINE.md`) Anthropic/Claude-ot említ, a kód Geminit használ | 🟡 dokumentációs | A valós provider Google Gemini |

---

## 8. Hiányzó információk – ellenőrzőlista (élesítés előtt)

**Cégadatok (1. szakasz):** mind kötelező.

**Üzleti/jogi döntések:**
- [ ] Árak **nettó vagy bruttó** (ÁFA/TVA mértéke, RO 19%)? Megjelenítés a fogyasztónak.
- [ ] Joghatóság, irányadó jog, felügyeleti hatóság (székhely szerint).
- [ ] Szolgáltatás célországai (HU/RO/EGT/UK?).
- [ ] DPO szükséges-e; ha igen, elérhetőség.
- [ ] Adatmegőrzési idők véglegesítése (lásd `09_Adatmegorzesi_Szabalyzat.md`).
- [ ] Lemondás/visszatérítés üzleti szabálya (B2B; elállási jog kérdése).
- [ ] Benchmark jogalapja és opt-in/opt-out szövegezése.

**Technikai teendők a megfeleléshez (fejlesztés):**
- [ ] 🔴 Neon-jelszó rotálása + `.env.example` titok eltávolítása a git-előzményből.
- [ ] Fiók-/tenant-törlési (17. cikk) folyamat + S3-objektum törlés.
- [ ] Adat-export (20. cikk) végpont (gépi formátum: JSON/CSV).
- [ ] Rate limiting a hitelesítési végpontokon.
- [ ] (Ajánlott) 2FA, httpOnly cookie, `extractionRaw`/fájlnév minimalizálás.
- [ ] Élő jogi oldalak bekötése a frontendbe (footer linkek, `/privacy`, `/terms`,
      `/cookie-policy`, `/impresszum`), regisztrációs **elfogadó jelölőnégyzet**.
- [ ] DPA-k és SCC-k aláírása az alfeldolgozókkal.

> ⚠️ Az „Soha ne találj ki hiányzó adatot" elv miatt a fenti `【KITÖLTENDŐ】`
> mezők kitöltése és e teendők elvégzése nélkül a dokumentumcsomag **nem
> élesíthető**.
