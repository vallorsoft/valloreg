# Adatvédelmi tájékoztató (Privacy Policy)

> **Verzió:** 1.0 · **Hatályos:** 2026-06-27 ·
> **Utolsó módosítás:** 2026-06-27
> ⚠️ **ÜGYVÉDI ELLENŐRZÉS KÖTELEZŐ az élesítés előtt.**

Ez a tájékoztató az **EU 2016/679 (GDPR)** rendelet 13–14. cikke alapján
ismerteti, hogyan kezeli a Valloreg platform a személyes adatokat. A dokumentum
a platform **tényleges működését** tükrözi.

## 1. Az adatkezelő

- **Cégnév:** VALLOR TEAM SRL (a továbbiakban: „Üzemeltető")
- **Székhely:** Sat Arcuș, Cart. Poiana Arcușului nr. 102, cod 527166, jud. Covasna, România
- **Cégjegyzék-/nyilvántartási szám:** J2023000114142 (EUID: ROONRC.J2023000114142)
- **Adószám / CUI / VAT:** 47859317
- **E-mail:** vallorsoft@gmail.com · **Telefon:** 0769532015
- **Adatvédelmi kapcsolat / DPO:** vallorsoft@gmail.com (külön DPO jelenleg nincs kijelölve; a DPO szükségessége jogi mérlegelés tárgya)

## 2. Adatkezelői és adatfeldolgozói szerepkörök

A Valloreg többbérlős üzleti (B2B) szolgáltatás. Két különböző viszony van:

1. **Fiók- és számlázási adatok** (regisztráló felhasználó és cég adatai,
   bejelentkezési adatok, IP, audit napló): ezekért az **Üzemeltető az adatkezelő**,
   és e tájékoztató irányadó.
2. **Ügyfél által feltöltött üzleti tartalom** (szervizszámlák, járműokmányok,
   jármű- és kapcsolódó adatok): ezekért az **előfizető cég (ügyfél) az adatkezelő**,
   az Üzemeltető pedig **adatfeldolgozó**. E viszonyt az **Adatfeldolgozási
   megállapodás (DPA)** szabályozza (lásd külön dokumentum). Ha Ön egy előfizető cég
   ügyfeleként, alkalmazottjaként vagy partnereként érintett, kérjük, forduljon az
   adott céghez mint adatkezelőhöz.

## 3. Kezelt személyes adatok, célok, jogalapok és megőrzés

| Adatkör | Cél | Jogalap (GDPR) | Megőrzés |
|---|---|---|---|
| E-mail, név | regisztráció, hitelesítés, kapcsolat | szerződés teljesítése (6(1)(b)) | a fiók megszűnéséig + jogszabályi idő |
| Jelszó (argon2 hash) | biztonságos hitelesítés | szerződés (6(1)(b)) | a fiók megszűnéséig |
| Cégnév, adószám | szerződés, számlázás | szerződés / jogi kötelezettség (6(1)(c)) | számviteli megőrzés szerint (lásd 9. dok.) |
| Telefonszám | kapcsolattartás | jogos érdek (6(1)(f)) | a fiók megszűnéséig |
| IP-cím, audit napló | biztonság, visszaélés-megelőzés, elszámoltathatóság | jogos érdek (6(1)(f)) | 12 hónap (365 nap), automatikus törléssel |
| Eszköz/böngésző (User-Agent), push végpont | értesítések kézbesítése | **hozzájárulás** (6(1)(a)) | a leiratkozásig / hozzájárulás visszavonásáig |
| Feltöltött dokumentumok és kiolvasott adat | OCR/AI feldolgozás, szerviztörténet | szerződés (ügyfél adatkezelő – DPA) | az ügyfél utasítása / előfizetés szerint |
| Számlázási hivatkozás, fizetési adat (utalás) | előfizetés kezelése | szerződés / jogi kötelezettség | számviteli megőrzés |

> 📌 **FELTÉTELEZÉS:** A konkrét megőrzési idők a `09_Adatmegorzesi_Szabalyzat.md`
> szerint; a számviteli megőrzés a székhely országának joga szerint (RO/HU
> jellemzően 5–10 év). ⚠️ Véglegesítendő.

## 4. Az adatok forrása

Az adatok elsődlegesen **Öntől** származnak (regisztráció, feltöltés). Egyes
adatok **automatikusan** keletkeznek (IP, audit napló, eszközadat), illetve a
feltöltött dokumentumokból **AI/OCR kiolvasással** (pl. számla- és jármű-adatok).

## 5. Címzettek és adatfeldolgozók (alfeldolgozók)

Az Üzemeltető az alábbi kategóriájú szolgáltatókat veszi igénybe. A teljes,
naprakész lista: **Alfeldolgozók listája** (külön dokumentum).

- **Tárhely/hosting:** Render (EU, Frankfurt) – alkalmazás és sor.
- **Adatbázis:** Neon (PostgreSQL, AWS `eu-central-1`).
- **Dokumentum-tár:** Cloudflare R2 (S3-kompatibilis).
- **E-mail:** Brevo (Sendinblue), Franciaország (EGT) – ha aktív.
- **AI/OCR:** Google Gemini (USA) – **csak ha az AI-feldolgozás aktív**.
- **Web push:** a böngésző push-szolgáltatása (pl. Google/Mozilla/Apple) – csak ha
  Ön engedélyezi az értesítéseket.
- **Megfelelőség-ellenőrzés (RO):** külső ITP/RCA/rovinietă forrás – ha aktív.

## 6. Nemzetközi adattovábbítás (EGT-n kívülre)

Egyes szolgáltatók USA-beli anyacéghez tartoznak, és az **AI/OCR (Google Gemini)**
esetén az adat ténylegesen az **USA-ba** kerülhet. Ilyenkor a továbbítás a GDPR
46. cikke szerinti **általános adatvédelmi kikötések (SCC)**, illetve – ahol
alkalmazható – az **EU–US Data Privacy Framework** alapján történik.

> ⚠️ **ÜGYVÉDI ELLENŐRZÉS:** Az egyes továbbítások jogalapját és a megfelelő
> garanciákat szolgáltatónként dokumentálni kell (Transfer Impact Assessment).

## 7. Automatizált döntéshozatal és AI

A platform **AI/OCR**-rel olvassa ki és kategorizálja a feltöltött dokumentumokat
(lásd `14_AI_Hasznalati_Szabalyzat.md`). Ez **nem** jár az érintettre nézve
joghatással bíró, kizárólag automatizált döntéssel a GDPR 22. cikk értelmében:
a bizonytalan eredményt a rendszer **emberi ellenőrzésre** jelöli (human-in-the-loop).
A forgalmiból kiolvasott **tulajdonosnév nem kerül tárolásra**.

## 8. Az Ön jogai

Az érintettként Önt megilletik a GDPR szerinti jogok: **hozzáférés** (15. cikk),
**helyesbítés** (16.), **törlés** (17.), **korlátozás** (18.), **adathordozhatóság**
(20.), **tiltakozás** (21.), valamint **hozzájárulás visszavonása** (7(3)).
Részletek és gyakorlati lépések: `10_Erintetti_Jogok_Szabalyzat.md`.

Kérelmét a vallorsoft@gmail.com címen jelezheti. Válaszidő: legfeljebb 1 hónap.
Panasszal a felügyeleti hatósághoz fordulhat:
- **Székhely szerint (Románia):** ANSPDCP – www.dataprotection.ro
- **Magyarország:** NAIH – www.naih.hu

> ⚠️ **JELENLEGI KORLÁT:** A platformon jelenleg **nincs automatikus fiók-törlési
> és adat-export funkció**; e jogokat az Üzemeltető manuálisan teljesíti a fenti
> e-mailen keresztül, amíg a megfelelő funkciók elkészülnek. (Lásd audit 7–8.)

## 9. Süti és tárolás

A platform nem használ analitikai vagy marketing sütit/követőt; kizárólag a
működéshez **feltétlenül szükséges** helyi tárolást (`localStorage`) és – külön
engedéllyel – **web push** értesítést alkalmaz. Részletek: `03_Cookie_Szabalyzat.md`.

## 10. Adatbiztonság

Az Üzemeltető megfelelő technikai és szervezési intézkedéseket alkalmaz: titkosított
adatátvitel (TLS), `argon2` jelszó-tárolás, rotált/visszavonható munkamenet-tokenek,
többbérlős izoláció, audit naplózás, hozzáférés-korlátozás. Részletek:
`08_Biztonsagi_Szabalyzat.md`.

## 11. A tájékoztató módosítása

Az Üzemeltető a tájékoztatót módosíthatja; a lényeges változásokról a felhasználókat
e-mailben vagy a felületen értesíti. A mindenkori hatályos verzió a platformon érhető el.
