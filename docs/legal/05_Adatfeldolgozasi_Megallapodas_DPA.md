# Adatfeldolgozási megállapodás (DPA)

> **Verzió:** 1.0 · **Hatályos:** 2026-06-27
> ⚠️ **ÜGYVÉDI ELLENŐRZÉS KÖTELEZŐ.** Ez a DPA a GDPR 28. cikke szerinti minimum-
> tartalmat fedi le, a Valloreg tényleges működése alapján.

Ez a megállapodás az **Adatkezelő** (a Valloreg előfizető **ügyfele**, „Ügyfél")
és az **Adatfeldolgozó** (a Valloreg **Üzemeltetője**, „Üzemeltető") között jön
létre, és a Főszerződés (ÁSZF) elválaszthatatlan részét képezi. A platformon
feltöltött üzleti tartalom tekintetében az **Ügyfél az adatkezelő**, az Üzemeltető
az adatfeldolgozó.

## 1. A feldolgozás tárgya és időtartama

- **Tárgy:** szervizszámlák és járműokmányok tárolása és **OCR/AI** feldolgozása,
  digitális szerviztörténet, jármű-nyilvántartás, megfelelőségi és karbantartási
  emlékeztetők, riportok, benchmark, csapatkezelés.
- **Időtartam:** a Főszerződés hatálya alatt, a 9. pont szerinti törlésig.

## 2. A feldolgozás jellege és célja

Automatizált tárolás, kiolvasás (OCR), strukturált kinyerés (AI), kategorizálás,
jármű-hozzárendelés, értesítés, aggregálás (anonim benchmark) – az Ügyfél
utasítása és a Platform funkciói szerint.

## 3. A személyes adatok típusai és az érintettek köre

- **Érintettek:** az Ügyfél munkavállalói/felhasználói; a feltöltött dokumentumokban
  esetlegesen szereplő természetes személyek (pl. számlán szereplő nevek, sofőrök,
  járműtulajdonosok).
- **Adattípusok:** azonosító- és kapcsolati adatok, jármű-adatok (rendszám, VIN),
  pénzügyi tételek, megfelelőségi lejáratok, és a dokumentumok szabad szöveges
  tartalma. (A forgalmiból kiolvasott **tulajdonosnév nem kerül tárolásra**.)

> ⚠️ Az Ügyfél felelős azért, hogy csak megfelelő jogalappal és adattakarékosan
> töltsön fel személyes adatot (pl. ne töltsön fel szükségtelen különleges adatot).

## 4. Az Üzemeltető (adatfeldolgozó) kötelezettségei (GDPR 28(3))

Az Üzemeltető:
- a) kizárólag az Ügyfél **dokumentált utasítása** szerint kezel adatot (beleértve a
  nemzetközi továbbítást), a Platform funkcionalitásán keresztül;
- b) biztosítja a feldolgozásra jogosultak **titoktartását**;
- c) megfelelő **technikai/szervezési intézkedéseket** alkalmaz (32. cikk – lásd
  `08_Biztonsagi_Szabalyzat.md`);
- d) az **alfeldolgozókat** a 6. pont szerint veszi igénybe;
- e) segíti az Ügyfelet az **érintetti kérelmek** teljesítésében (lásd 5. pont);
- f) segíti az Ügyfelet a 32–36. cikk szerinti kötelezettségekben (biztonság,
  adatvédelmi incidens, hatásvizsgálat);
- g) a Főszerződés végén **törli vagy visszaadja** az adatokat (9. pont);
- h) **rendelkezésre bocsátja** a megfeleléshez szükséges információt és lehetővé
  teszi az **auditot** (ésszerű keretek között).

## 5. Közreműködés az érintetti jogok teljesítésében

Az Üzemeltető a Platform funkcióival és – ahol szükséges – manuális közreműködéssel
segíti az Ügyfelet a hozzáférési, helyesbítési, törlési, korlátozási, tiltakozási
és adathordozhatósági kérelmek teljesítésében.

> ⚠️ **JELENLEGI KORLÁT (audit):** A Platformon jelenleg nincs önkiszolgáló adat-
> export és fiók-/tenant-törlési funkció; ezeket az Üzemeltető **manuálisan**
> teljesíti az Ügyfél megkeresésére, amíg a funkciók elkészülnek. Ezt a tényt az
> Ügyféllel közölni kell.

## 6. Alfeldolgozók

Az Ügyfél **általános felhatalmazást** ad az alfeldolgozók igénybevételére. Az
aktuális lista: `11_Alfeldolgozok_Listaja.md`. Az Üzemeltető a tervezett
változásokról előzetesen tájékoztat, és az Ügyfél kifogást emelhet. Fő alfeldolgozók:
Render (hosting, EU), Neon (DB, EU), Cloudflare R2 (tár), Brevo (e-mail, EGT),
Google Gemini (AI/OCR, USA – ha aktív), böngésző push-szolgáltatások, RO
megfelelőség-API (ha aktív).

## 7. Nemzetközi adattovábbítás

Ahol az adat az **EGT-n kívülre** kerül (különösen a Google Gemini esetén az USA-ba),
a továbbítás a GDPR 46. cikk szerinti **általános szerződéses kikötések (SCC)**,
illetve – ahol alkalmazható – az **EU–US Data Privacy Framework** alapján történik.
⚠️ Szolgáltatónként dokumentálandó (Transfer Impact Assessment).

## 8. Adatvédelmi incidens

Az Üzemeltető **indokolatlan késedelem nélkül** értesíti az Ügyfelet a tudomására
jutott, az Ügyfél adatait érintő incidensről, és ésszerű közreműködést nyújt a
72 órás bejelentési kötelezettség teljesítéséhez.
Az incidens-értesítés a vallorsoft@gmail.com címen történik, a tudomásra jutástól számított
**48 órán belül**.

## 9. Az adatok törlése / visszaadása

A Főszerződés megszűnését követően az Üzemeltető – az Ügyfél választása szerint –
**törli vagy visszaadja** a személyes adatokat **30 napon belül**,
kivéve, ha jogszabály a megőrzést írja elő. A séma kaszkád-törlést támogat; az
objektumtárból (R2) való törlést is biztosítani kell.

## 10. Felelősség és záró rendelkezések

A felelősségre a Főszerződés irányadó. A jelen DPA és a Főszerződés ellentmondása
esetén adatvédelmi kérdésben a DPA az irányadó.

**Aláírások / elfogadás:** A felek: az Üzemeltető (VALLOR TEAM SRL) és az Ügyfél (előfizető
cég); elfogadás elektronikus úton, az előfizetés megkezdésével / a megrendelés
visszaigazolásával.
