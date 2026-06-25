# Általános Szerződési Feltételek (ÁSZF) / Felhasználási feltételek

> **Verzió:** 1.0 (vázlat) · **Hatályos:** 【KITÖLTENDŐ: dátum】
> ⚠️ **ÜGYVÉDI ELLENŐRZÉS KÖTELEZŐ.** B2B szolgáltatás; a fogyasztói rendelkezések
> alkalmazhatósága a székhely és a célpiac joga szerint vizsgálandó.

## 1. A Szolgáltató

【KITÖLTENDŐ: cégnév, székhely, cégjegyzékszám, adószám/CUI, e-mail, telefon】
(a továbbiakban: „Szolgáltató"). A szolgáltatás neve: **Valloreg** (a továbbiakban:
„Szolgáltatás" vagy „Platform").

## 2. A Szolgáltatás tárgya

A Valloreg többbérlős, előfizetéses **SaaS** flottakezelő platform fuvarozó- és
flottaüzemeltető cégek számára. Funkciói: szervizszámlák és járműokmányok feltöltése
és **OCR + AI** alapú kiolvasása, digitális szerviztörténet, jármű-nyilvántartás,
megfelelőségi és karbantartási emlékeztetők, riportok és export, anonimizált flotta-
benchmark, csapatkezelés. A funkciók köre az előfizetett csomagtól függ (lásd 5. pont).

## 3. A szerződés létrejötte, regisztráció

A szerződés a regisztrációval és a jelen ÁSZF elfogadásával jön létre. A felhasználó
köteles valós cég- és kapcsolati adatokat megadni. A regisztráló szavatolja, hogy
jogosult a cég nevében eljárni. A Szolgáltatás kizárólag **18. életévét betöltött,
cselekvőképes**, üzleti céllal eljáró személyek számára nyújtható.

## 4. Felhasználói fiók, szerepkörök, biztonság

Egy felhasználó több céghez (tenant) tartozhat. A cégen belüli szerepkörök:
`OWNER`, `ADMIN`, `FLEET_MANAGER`, `ACCOUNTANT`, `VIEWER`. A felhasználó felel a
hozzáférési adatai bizalmas kezeléséért. A jelszavak `argon2` algoritmussal,
hash-elve tárolódnak. A munkamenet JWT alapú (rövid életű access + 14 napos,
visszavonható refresh token).

## 5. Csomagok és funkciók

A mindenkori csomagokat és árakat a `13_SaaS_Elofizetesi_Feltetelek.md` és a Platform
árazási oldala tartalmazza. Aktuálisan: **Start (49 RON/hó)**, **Pro (129 RON/hó)**,
**Fleet (299 RON/hó)**, valamint vásárolható extra tárhely. Minden csomag **14 napos
ingyenes próbaidőszakkal** indul. A csomag-limitek (jármű, felhasználó, havi
dokumentum, tárhely) a Platformon szerver oldalon kényszerítve vannak.

## 6. Díjazás és fizetés

A fizetés **banki utalással** történik; a Szolgáltató az igényléskor e-mailben küldi
az utalási adatokat és az azonosító közleményt. Az előfizetést a Szolgáltató az utalás
beérkezése után aktiválja. **Bankkártyás fizetés nincs.** A díjak pénzneme **RON**.

> ⚠️ **ÜGYVÉDI ELLENŐRZÉS:** Tisztázandó, hogy a feltüntetett árak **nettó vagy
> bruttó** (TVA/ÁFA) értékek, és ezt a fogyasztó/üzleti ügyfél felé egyértelműen
> jelezni kell (lásd fogyasztóvédelem / RO TVA 19%).

## 7. Próbaidőszak, megújulás, lemondás

A 14 napos próbaidő alatt minden funkció elérhető. A próbaidő végén az előfizetés a
választott csomagra vált, az aktiválás az utalás függvénye. A lemondás és
visszatérítés részleteit a `07_Lemondasi_es_Visszateritesi_Szabalyzat.md` szabályozza.

## 8. A Szolgáltatás használata, elfogadható használat

A felhasználó a Platformot kizárólag jogszerűen, az **Elfogadható használati
szabályzat** (`06_Elfogadhato_Hasznalat_AUP.md`) szerint használhatja. Tilos
különösen a jogosulatlan hozzáférés kísérlete, a rendszer túlterhelése, harmadik
fél adatainak jogalap nélküli feltöltése, illetve jogsértő tartalom feltöltése.

## 9. Szellemi tulajdon

A Platform, annak szoftvere, megjelenése és tartalma a Szolgáltató (vagy licenc-
adói) szellemi tulajdona. A felhasználó az előfizetés idejére **nem kizárólagos,
nem átruházható** használati jogot kap. A felhasználó által feltöltött adatok és
tartalom a felhasználóé (illetve az általa képviselt cégé) marad.

## 10. Adatvédelem

A személyes adatok kezelését az **Adatvédelmi tájékoztató**
(`01_Adatvedelmi_Tajekoztato.md`), a feldolgozói viszonyt az **Adatfeldolgozási
megállapodás** (`05_Adatfeldolgozasi_Megallapodas_DPA.md`) szabályozza.

## 11. Rendelkezésre állás, karbantartás

A Szolgáltató törekszik a magas rendelkezésre állásra, de azt – külön SLA hiányában –
nem garantálja. Tervezett karbantartásról lehetőség szerint előzetesen értesít.

> 📌 **FELTÉTELEZÉS:** Nincs külön SLA dokumentum a kódbázisban. Ha van/lesz, ide
> kell hivatkozni. A jelenlegi infrastruktúra (Render free plan) nem nyújt SLA-t.

## 12. Felelősség korlátozása

A Szolgáltató felelőssége az irányadó jog által megengedett mértékben korlátozott.
A Szolgáltató nem felel az AI/OCR kiolvasás esetleges pontatlanságaiból eredő
károkért; a kiolvasott adatok **ellenőrzése a felhasználó felelőssége**
(human-in-the-loop). A Platform „adott állapotában" (as-is) áll rendelkezésre.

> ⚠️ **ÜGYVÉDI ELLENŐRZÉS:** A felelősségkorlátozás mértéke és a fogyasztókra
> vonatkozó kógens szabályok a célpiac joga szerint pontosítandók.

## 13. A szerződés megszűnése

Bármelyik fél felmondhatja a szerződést; a felhasználó a fiókja lemondásával. A
Szolgáltató súlyos szerződésszegés (pl. AUP megsértése) esetén azonnali hatállyal
felfüggesztheti vagy megszüntetheti a hozzáférést. A megszűnést követő
adatkezelésre az **Adatmegőrzési szabályzat** irányadó.

## 14. Módosítás

A Szolgáltató az ÁSZF-et módosíthatja; a lényeges változásokról a felhasználókat
előzetesen értesíti. A folyamatos használat a módosítás elfogadását jelenti.

## 15. Irányadó jog és jogviták

Az irányadó jog és az illetékes bíróság a Szolgáltató **székhelye** szerinti.
【KITÖLTENDŐ: irányadó jog / illetékesség】

> ⚠️ **ÜGYVÉDI ELLENŐRZÉS:** Joghatóság, irányadó jog, esetleges választottbíróság,
> valamint a fogyasztói jogviták (ODR-platform) szabályainak pontosítása.
