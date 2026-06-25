# AI-használati szabályzat (AI Usage Policy)

> **Verzió:** 1.0 (vázlat) · **Hatályos:** 【KITÖLTENDŐ: dátum】
> ⚠️ **ÜGYVÉDI ELLENŐRZÉS AJÁNLOTT.** Ez a szabályzat a Platform AI/OCR
> funkcióinak tényleges működését írja le (audit alapján).

## 1. Mire használjuk az AI-t?

A Valloreg **OCR (optikai karakterfelismerés) + AI** technológiát használ a
feltöltött dokumentumok (szervizszámlák, forgalmi engedélyek, megfelelőségi
okmányok) **kiolvasására, osztályozására és strukturált adattá alakítására**:
- szöveg kiolvasása a képből/PDF-ből (OCR),
- számla- és tételadatok kinyerése (beszállító, dátum, összegek, tételek),
- jármű-adatok kinyerése forgalmiból (rendszám, VIN, márka, modell stb.),
- megfelelőségi lejáratok kiolvasása (ITP/RCA/rovinietă),
- tétel-kategorizálás és jármű-hozzárendelés.

## 2. Melyik AI-szolgáltatót használjuk?

A kiolvasást a **Google Gemini** modellcsalád végzi (vision-képes modellek,
automatikus modell-lánccal a kvóta-kezeléshez), amennyiben az AI-feldolgozás
aktív. A feldolgozáskor a **dokumentum képe/PDF-je és a kiolvasott szöveg** a
Google API-jához (USA) kerül. Az adattovábbításra az Adatvédelmi tájékoztató 6.
pontja és a DPA 7. pontja irányadó (SCC / EU–US Data Privacy Framework).

> 📌 **MEGJEGYZÉS (audit):** A Platform alapértelmezésben `stub` (próba) módban fut,
> ekkor **nincs** külső AI-hívás. Élesben a Google Gemini az aktív provider. A
> `docs/OCR_AI_ENGINE.md` korábbi terve más szolgáltatókat (Anthropic, Mistral,
> Google Document AI) is említ; a **ténylegesen megvalósított** provider a Google
> Gemini.

## 3. Emberi felügyelet (human-in-the-loop)

Az AI eredménye **megbízhatósági pontszámot** kap. A bizonytalan mezőket a rendszer
**emberi ellenőrzésre** jelöli; a felhasználónak meg kell erősítenie az adatokat,
mielőtt azok a szerviztörténetbe kerülnek. Így a feldolgozás **nem** minősül a GDPR
22. cikke szerinti, kizárólag automatizált, joghatással bíró döntéshozatalnak.

## 4. Adattakarékosság

- A forgalmiból kiolvasott **tulajdonosnév nem kerül tárolásra**.
- A nyers AI-eredmény (`extractionRaw`) a kiolvasott adatokat tartalmazza; ezt a
  rendszer a dokumentumhoz kötve tárolja (megőrzés: `09_Adatmegorzesi_Szabalyzat.md`).
- A **flotta-benchmark** kizárólag **anonim, aggregált** adatból készül,
  **k-anonimitási küszöbbel** (≥5 cég és ≥20 jármű) és **opt-in** alapon; egyetlen
  cég vagy jármű sem fejthető vissza.

## 5. Pontosság és felelősség

Az AI/OCR **támogató eszköz**, nem helyettesíti az emberi ellenőrzést. A kiolvasott
adatok helyességéért – a megerősítést követően – a felhasználó felel. Az Üzemeltető
nem szavatolja a kiolvasás 100%-os pontosságát.

## 6. Tiltott használat

Tilos az AI-funkciók megtévesztő, jogellenes vagy a rendszer kijátszására irányuló
használata, valamint olyan dokumentum feltöltése, amelyre a felhasználónak nincs
jogalapja (lásd `06_Elfogadhato_Hasznalat_AUP.md`).

## 7. Modelltréning

> 📌 **TISZTÁZANDÓ / ⚠️ ÜGYVÉDI ELLENŐRZÉS:** Az Üzemeltető a feltöltött ügyfél-
> tartalmat **nem** használja saját AI-modell tréningjére. A külső AI-szolgáltató
> (Google) adatkezelési feltételeit szolgáltatói szinten kell ellenőrizni és
> rögzíteni (a fizetős Gemini API jellemzően nem használja a kéréseket modell-
> tréningre – ezt a szerződésben meg kell erősíteni). Ezt a pontot véglegesíteni kell.

## 8. EU AI Act

> ⚠️ **ÜGYVÉDI ELLENŐRZÉS:** Az (EU) 2024/1689 (AI Act) szerinti besorolást
> érdemes elvégezni. A dokumentum-kiolvasás vélhetően **nem** magas kockázatú
> rendszer, de a megfelelő átláthatósági kötelezettségeket (a felhasználó tudja,
> hogy AI-val lép interakcióba) biztosítani kell.
