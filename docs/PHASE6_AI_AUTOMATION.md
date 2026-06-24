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
