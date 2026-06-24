# SaaS előfizetési feltételek

> **Verzió:** 1.0 (vázlat) · **Hatályos:** 【KITÖLTENDŐ: dátum】 ·
> **Árak forrása:** a Valloreg árazási oldala (2026-06; a felhasználó által megadott
> aktuális RON-árak). ⚠️ **ÜGYVÉDI ELLENŐRZÉS:** nettó/bruttó (TVA) tisztázandó.

Ez a dokumentum az ÁSZF (`02_ASZF_Felhasznalasi_Feltetelek.md`) kiegészítése, és az
előfizetés kereskedelmi feltételeit rögzíti.

## 1. Csomagok

Minden csomag **14 napos ingyenes próbaidőszakkal** indul; a próbaidő alatt minden
funkció elérhető. A fizetés a próbaidő után **banki utalással** történik. Pénznem: **RON**.

| Csomag | Havi díj (RON) | Jármű | Felhasználó | Dokumentum / hó | Tárhely |
|---|---|---|---|---|---|
| **Start** – kisebb flottáknak, az első lépésekhez | **49** | 3 | 3 | 75 | 1 GB |
| **Pro** (Legnépszerűbb) – növekvő flottáknak: riport, export, emlékeztető, komplex szerviz | **129** | 15 | 10 | 400 | 5 GB |
| **Fleet** – teljes flotta-intelligencia: ranglista, tartósság, beszállító-minőség | **299** | korlátlan | korlátlan | korlátlan | 15 GB |

> 📌 **KÓD-ELTÉRÉS (audit):** A jelenlegi forráskód (`packages/shared/src/plans.ts`)
> még a **régi, 4 sávos** struktúrát tartalmazza HUF-ban (STARTER/STANDARD/
> PROFESSIONAL/BUSINESS). A fenti **3 sávos (Start/Pro/Fleet) RON** árazás az
> aktuális üzleti ajánlat. A kód összehangolása külön feladat (lásd a projekt
> teendői; a tier-átnevezés a Prisma enumot és migrációt is érinti).

## 2. Vásárolható extra tárhely

A tárhely **teljes kapacitás** (nem nullázódik havonta); bármely csomaghoz vásárolható.

| Extra tárhely | Havi díj (RON) |
|---|---|
| +5 GB | 19 |
| +10 GB | 29 |
| +25 GB | 59 |

## 3. Limitek érvényesítése

A csomag-limiteket (jármű, felhasználó, havi dokumentum, tárhely) a rendszer
**szerver oldalon** kényszeríti. A „havi dokumentum" a naptári hónapban feldolgozott
dokumentumok számát jelenti; a tárhely a tárolt fájlok teljes méretét.

## 4. Megrendelés és aktiválás

1. A felhasználó a felületen kiválasztja a csomagot.
2. A rendszer e-mailben elküldi az **utalási adatokat** és egy **közlemény-
   azonosítót** (`VLR-…`), amelyet az utalásnál fel kell tüntetni.
3. Az utalás beérkezése után a Szolgáltató **manuálisan aktiválja** az előfizetést.

## 5. Számlázási időszak, megújulás

- A számlázás **havi** ciklusú, előre fizetett.
- Megújuláskor az aktuális díj az irányadó; díjmódosításról a Szolgáltató előzetesen
  értesít.

## 6. Lemondás és visszatérítés

Lásd `07_Lemondasi_es_Visszateritesi_Szabalyzat.md`.

## 7. Funkciók csomagonként (feature flag-ek)

A funkciók (OCR, AI-feldolgozás, dashboard, dokumentumtár, riportok, export,
emlékeztetők, API stb.) a csomaghoz kötöttek; a tiltott funkciót a backend is
elutasítja. A pontos funkció-mátrixot a Platform árazási oldala tartalmazza.

> 📌 **FELTÉTELEZÉS:** A fenti UI-leírások (pl. „riport, export, emlékeztető" a
> Pro-nál, „ranglista, tartósság, beszállító-minőség" a Fleet-nél) tükrözik a
> csomagonkénti funkciókat; a kódbeli feature-flag-térkép a régi 4 sávhoz igazodik,
> ezért a végleges mátrixot a 3 sávhoz kell igazítani.

## 8. Adó

⚠️ **TISZTÁZANDÓ:** A feltüntetett árak nettó vagy bruttó (TVA/ÁFA) értékek-e, és
ezt a megrendelési folyamatban egyértelműen jelezni kell (RO TVA jellemzően 19%).
