# Fázis 6 – AI Differenciátorok (javaslat)

> **Státusz:** javaslat / ötlettár, megvitatásra. Nem implementált.
> **Cél:** a meglévő szerviztörténet- és riport-magot úgy okosítani, hogy a termék
> **láthatóan kitűnjön** a passzív flotta-nyilvántartók közül – minimális emberi
> munkával, valódi döntéstámogatással.

## Vezérelvek (a Fázis 5 hatóköréből örökölve)

- A fókusz végig a **szerviztörténet + riportok** marad – ezt tesszük proaktívvá.
- **Nincs** könyvelő-export / ERP / SAF-T / teljes TMS.
- Minden új AI-képesség **pluggable provider port** (stub + valódi), ahogy az OCR /
  extraction / verification rétegnél; API-kulcs nélkül biztonságos stub fut.
- Minden cross-tenant adat **anonimizált és aggregált**, k-anonimitással; opt-in.
- Minden új modul **feature flag** mögött, **tenant-izolált**, **audit-logolt**.
- Read-time számítás ott, ahol lehet (mint az `insights`), BullMQ job ott, ahol kell.

---

## A fő differenciátor – „Európai trendek" (anonimizált flotta-benchmark)

**Az ötlet:** a platform már most több cég valódi szervizköltség-adatát látja
(márka / modell / motor / km-sáv / tételkategória bontásban). Ebből
**anonimizált, aggregált európai benchmarkot** képzünk, és minden ügyfélnek
megmutatjuk, hogy **hol áll a piachoz képest**:

> „A Mercedes Sprinter 2.1 CDI flottádon a **fékjavítás** átlagköltsége
> **23%-kal a hasonló RO/HU flották medián fölött** van (n=137 jármű).
> A leggyakoribb ok a korai féktárcsa-csere – nézd meg a 3 érintett beszállítót."

Ez az a képesség, amit egy versenytárs **nem tud lemásolni adat nélkül** – ez
hálózati hatás / adat-moat. A többi ötlet ennek a köré épül.

**Miért különleges:** a benchmark a saját adatból táplálkozik, önerősödő
(minél több cég, annál pontosabb), és közvetlen üzleti értéket ad (túlfizetés,
beszállító-választás, optimális csereidő).

### Megvalósítási terv – 6/A „Benchmark mag"

1. **Adatmodell** (`packages/shared` + Prisma):
   - `FleetBenchmark` aggregált tábla: dimenziók = `makeModel`, `engine`,
     `kmBucket`, `itemCategory`, `region` (RO/HU/EU), `currency`; mértékek =
     `medianUnitPrice`, `p25`, `p75`, `sampleVehicles`, `sampleTenants`,
     `updatedAt`. **Nincs** tenant_id, **nincs** rendszám/VIN/számlaszám – csak szám.
   - `BenchmarkOptIn` a tenanten (alapból be, GDPR-tájékoztatóval kikapcsolható).
2. **Aggregáló BullMQ job** (heti, boot-biztos – a `reminders.scheduler` mintájára):
   - végigmegy az opt-in tenantek anonimizált tételein, csoportosít, mediánt számol;
   - **k-anonimitás kapu:** egy cella csak akkor publikus, ha `sampleTenants >= 5`
     **és** `sampleVehicles >= 20` (különben „nincs elég adat");
   - eredmény a `FleetBenchmark` táblába, audit-logba a futás ténye (nem a tartalom).
3. **Olvasásidejű összevetés** (`insights` modul bővítése, read-time, mint a TCO):
   - a tenant saját medián tételköltsége vs. a `FleetBenchmark` cella → `deltaPct`,
     `percentile`, `sampleSize`. Provider/extra hívás nélkül, tisztán SQL+TS.
4. **UI:** `/insights` új „Piaci összevetés" szekció + jármű-részletező badge
   („piac felett / piacon / piac alatt"), nyelvfüggetlen (hu/ro/en).
5. **Feature flag:** `BENCHMARK`; **adatvédelem:** Super Admin sem lát tenant-szintű
   adatot, csak az aggregátumot; a doc/SECURITY.md-be külön szakasz a k-anonimitásról.

**Becsült méret:** közepes. A nehézség nem a kód, hanem a **k-anonimitás +
GDPR-megfogalmazás** helyes belövése. Stub mód: szintetikus seed benchmark, hogy
a UI kevés tenanttel is demózható legyen.

---

## Másodlagos ötletek (a magra építve)

### 6/B – „Szerviz-tanácsadó" természetes nyelvű chat (RAG a saját adaton)

Beszélgető réteg a cég **saját** szervizkönyve fölött:
„Melyik járművem a legdrágább km-enként?", „Mikor cseréltem utoljára vezérlést a
RO-12-ABC-n?", „Mennyit költöttem fékre idén márka szerint?".

- Új `AssistantProvider` port (stub: determinisztikus sablon-válaszok kulcsszóból;
  valódi: Gemini **tool-calling**, ahol a „tool"-ok a meglévő read-only service-ek
  – `insights`, `reports`, `vehicles` –, így az LLM **nem lát nyers adatot**, csak
  a saját szűrt API-nkat hívja → tenant-izoláció és adatvédelem megmarad).
- Feature flag `ASSISTANT`; minden kérdés-válasz audit-logba.
- **Differenciátor:** a felhasználónak nem kell megtanulnia a dashboardot.

### 6/C – Márkaspecifikus prediktív hibajóslás (saját history + tudásbázis)

A meglévő prediktív karbantartást (5/C) kiegészíti **modell-specifikus ismert
hibákkal**: „Ennél a motornál 120–150 e km között gyakori a vezérlőlánc-nyúlás;
a tiéd 138 e km-en jár, és nincs erre vonatkozó tétel a történetben."

- A jelek két forrásból: (a) a 6/A benchmark anomáliái (egy modellnél feltűnően
  gyakori tételkategória), (b) opcionális `KnownIssueProvider` port külső
  recall/TSB-tudásbázishoz (stub: kurált JSON; valódi: külső API/RAG).
- A javaslat a **meglévő `Reminder`** mechanizmusba folyik be (nincs új csatorna).

### 6/D – Beszállító-scorecard + reklamáció-asszisztens

A meglévő anomália-detektálást (5/B) cselekvéssé fordítja:

- **Beszállító-pontszám** read-time: átlagos túlárazás a benchmarkhoz képest,
  duplikátum-arány, árszórás → `A–F` jegy a beszállítóra.
- **Reklamáció-draft:** túlárazott tételnél AI-generált, szerkeszthető e-mail
  vázlat (a meglévő mail-réteggel), tényekkel alátámasztva. A felhasználó
  küldi el, nem a rendszer → nincs külső automata művelet engedély nélkül.

### 6/E – AI havi narratíva a meglévő riporthoz

A már kiküldött havi riport (5/B) mellé **rövid, természetes nyelvű összefoglaló**
+ 3 konkrét akció-javaslat („Két járművön az ITP 30 napon belül lejár; a 7-es
kamion fékköltsége kiugró – kérj árajánlatot máshonnan"). Nincs új csatorna,
csak a meglévő e-mail gazdagítása az `AssistantProvider`-rel.

---

## Javasolt sorrend és indoklás

| Lépés | Modul | Miért most |
| ----- | ----- | ---------- |
| 1 | **6/A Benchmark mag** | Ez a moat; minden más ráépül. Adatot is gyűjt. |
| 2 | **6/E AI narratíva** | Kicsi, a meglévő riportot azonnal feldobja (gyors win). |
| 3 | **6/D Scorecard + reklamáció** | A meglévő anomáliát üzleti cselekvéssé teszi. |
| 4 | **6/B Asszisztens chat** | Nagy „wow", de tool-calling + audit gondos munka. |
| 5 | **6/C Hibajóslás** | Külső tudásbázist igényel; a benchmark adat után pontos. |

## Kockázatok / nyitott kérdések

- **GDPR / cross-tenant:** a 6/A jogi megfogalmazása (opt-in, anonimizálás,
  k-anonimitás küszöb) – jogi review-t igényel a kódolás előtt.
- **LLM-költség és determinizmus** a 6/B-nél: tool-calling korláttal, cache-eléssel.
- **Külső adat megbízhatósága** a 6/C-nél: csak kurált forrás, „javaslat" címkével.
- Minden provider stub-bal indul, hogy API-kulcs nélkül is fusson a teszt/CI.

---

## Cold-start: hogyan kap az ELSŐ cég is értéket (külső adat)

A 6/A benchmark a saját adatból táplálkozik → eleinte üres (kevés cég, sok cella a
k-anonimitás küszöb alatt). Hogy az **első ügyfél is azonnal** értéket kapjon, a
hiányzó belső adatot **külső, kurált baseline** tölti ki. A logika **blended**:

```
ha a belső cella eléri a k-anonimitást → belső medián (a moat)
egyébként                              → külső baseline (azonnali érték)
mindkettő hiányában                    → „nincs adat"
```

Ahogy nő a tenant-szám, a belső adat fokozatosan átveszi a külső baseline helyét –
a termék magától „okosodik", de már nap 1-en is hasznos.

### Külső adatforrások (kutatás eredménye, RO/HU-relevánsan)

| Cél | Forrás | Költség | Megjegyzés |
| --- | ------ | ------- | ---------- |
| **Visszahívások / ismert hibák (6/C)** | EU Safety Gate (RAPEX), `car-recalls.eu`, KBA (DE), DVSA (UK) | **ingyenes** | Hivatalos EU-s, heti frissülő. Azonnali érték tenant-adat nélkül. |
| **VIN→specifikáció / motor / üzemanyag** (autofill + benchmark kulcsok) | `vindecoder.eu`/Vincario, AutoRef (EU-fókusz), Zyla EU VIN | freemium | EU-fedettség jó. NHTSA vPIC ingyenes, de **US-only** (csak make/model/year megbízható). |
| **OEM karbantartási intervallumok (6/C baseline)** | Vehicle Databases, DataOne, Edmunds | fizetős | Gyári szerviz-intervallum → ajánlás **0 előzményből** is. |
| **Használtautó piaci / maradványérték (6/C TCO csere-időzítés)** | **Eurotax / Autovista** (lefedi HU+RO-t!), `vindecoder.eu` market value (ingyenes próbakvóta) | fizetős / freemium | A csereablak-előrejelzéshez. |
| **RO megfelelőség (ITP/RCA)** | RAR `rarom.ro` ITP-ellenőrzés, AIDA/BAAR RCA | ingyenes/publikus | Részben már az 5/F-ben; itt csak baseline-hoz. |

> **Javasolt induló minimum (mind ingyenes/olcsó):** EU Safety Gate visszahívások +
> egy freemium VIN-decoder. Ez már nap 1-en ad „ismert hiba" figyelmeztetést és
> autofillt, mindenféle belső adat nélkül. A fizetős intervallum/érték-adat
> később, ügyfél-igény szerint kapcsolható be (pluggable provider).

---

## Teljes bekötési terv (6/A benchmark, a meglévő mintákra)

Az alábbi pontosan a repo jelenlegi rétegeit követi (`extraction`/`verification`
provider-port minta, `reminders.scheduler` BullMQ minta, `insights` read-time minta,
`packages/shared` kontraktus minta).

### 1. Megosztott kontraktus – `packages/shared`

- Új fájl `src/benchmark.ts`: `BenchmarkDimensions` (makeModel, engine, kmBucket,
  itemCategory, region, currency), `BenchmarkCell` (median, p25, p75, sampleTenants,
  sampleVehicles, source: `'internal' | 'external'`), küszöb-konstansok
  `BENCHMARK_MIN_TENANTS = 5`, `BENCHMARK_MIN_VEHICLES = 20`, `KM_BUCKETS`.
- `src/feature-flags.ts`: `BENCHMARK` flag hozzáadása.
- `src/index.ts`: re-export. (zod sémák, mint az extraction kontraktusnál.)

### 2. Adatmodell – Prisma (`apps/api/prisma/schema.prisma`)

- `model FleetBenchmark` – **nincs `tenantId`**, csak aggregátum:
  `id, makeModel, engine, kmBucket, itemCategory, region, currency,`
  `medianUnitPrice, p25, p75, sampleTenants, sampleVehicles, source, updatedAt`,
  unique index a dimenzió-tuple-ön.
- `model BenchmarkOptIn` a tenanten (vagy bool a `Tenant`-on): alapból `true`,
  GDPR-tájékoztatóval kikapcsolható.
- Migráció + a `db:seed`-be **szintetikus benchmark seed**, hogy kevés tenanttel is
  demózható legyen a UI (a stub-elv folytatása).

### 3. Provider port – külső baseline (`apps/api/src/benchmark/providers`)

- `benchmark-baseline.provider.ts` interfész: `getExternalCell(dim) → BenchmarkCell | null`,
  `getKnownIssues(makeModel, engine, km) → KnownIssue[]`.
- `stub-baseline.provider.ts` – kurált JSON (visszahívások + tipikus intervallumok),
  API-kulcs nélkül fut (CI-biztos).
- `recall-baseline.provider.ts` – EU Safety Gate / car-recalls.eu adapter (env mögött).
- Provider-választás env-ből, ahogy `OCR_PROVIDER` / `VEHICLE_VERIFY_PROVIDER`.

### 4. Aggregáló job – BullMQ (`apps/api/src/benchmark/benchmark.scheduler.ts`)

- A `reminders.scheduler.ts` mintája: **boot-biztos**, ismétlődő (heti) job.
- Lépések: opt-in tenantek anonimizált tételeinek beolvasása → csoportosítás a
  dimenziók szerint → medián/p25/p75 → **k-anonimitás kapu** (`>=5` cég ÉS `>=20`
  jármű, különben a cella nem publikálódik) → upsert `FleetBenchmark`.
- Audit-logba **csak a futás ténye** (cellaszám), nem tartalom.
- Idempotens job-kulcs (a meglévő queue-mintával).

### 5. Olvasásidejű összevetés – `apps/api/src/insights`

- Az `InsightsService` bővítése `getBenchmarkComparison(tenant)`:
  a tenant saját tétel-mediánja vs. `FleetBenchmark` cella → `deltaPct`,
  `percentile`, `sampleSize`, `source`. **Blended**: belső, ha k-anonim; külső
  baseline egyébként; nincs külön provider-hívás kérésidőben (mint a TCO).
- Controller: `GET /insights/benchmark` a `REPORTS`/`BENCHMARK` flag mögött, RBAC-cel.

### 6. Frontend – `apps/web`

- `/insights` új „Piaci összevetés" szekció (a meglévő anomália/TCO szekciók mellé).
- Jármű-részletezőn badge: `piac alatt / piacon / piac felett` + minta-méret tooltip.
- i18n kulcsok hu/ro/en (nincs hardcode szöveg, a meglévő szabály szerint).
- A `BENCHMARK` flag kikapcsolva → a szekció nem renderelődik.

### 7. Konfiguráció, biztonság, teszt

- `.env.example`: `BENCHMARK_BASELINE_PROVIDER`, `RECALL_API_URL/KEY` (opcionális).
- `docs/SECURITY.md`: új szakasz a k-anonimitásról és az opt-inról; Super Admin
  **nem** lát tenant-szintű benchmark-adatot, csak aggregátumot.
- Tesztek: k-anonimitás kapu (4 cég → nincs cella, 5 cég → van), blended fallback,
  stub-provider determinisztikus válasza. CI: API-kulcs nélkül zöld.

### Bekötési sorrend (függőségek)

```
shared kontraktus + flag
        ↓
Prisma modell + migráció + seed
        ↓
baseline provider port (stub) ──► külső adapter (opcionális, env)
        ↓
aggregáló scheduler (k-anonimitás)
        ↓
insights read-time összevetés (blended)
        ↓
web UI + i18n + flag-gate
        ↓
SECURITY.md + tesztek
```

**Becsült méret:** közepes (≈ egy 5/B-hez hasonló epik). A kritikus pont nem a
mennyiség, hanem a k-anonimitás és a GDPR-megfogalmazás pontossága.
