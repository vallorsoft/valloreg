# Adatmegőrzési szabályzat (Data Retention Policy)

> **Verzió:** 1.0 (vázlat) · **Hatályos:** 【KITÖLTENDŐ: dátum】
> ⚠️ **ÜGYVÉDI ELLENŐRZÉS KÖTELEZŐ** – a megőrzési idők a számviteli és ágazati
> jogszabályoktól függenek (RO/HU). Az alábbiak **javasolt** értékek; a
> `【KITÖLTENDŐ】` mezőket az Üzemeltetőnek véglegesítenie kell.

## 1. Alapelv

A személyes adatokat csak a célhoz szükséges ideig őrizzük (GDPR 5(1)(e)). A
megőrzési idő lejárta vagy az adat céljának megszűnése után az adatot töröljük
vagy anonimizáljuk.

## 2. Megőrzési táblázat (a tényleges adatmodell alapján)

| Adat | Megőrzés | Forrás / megjegyzés |
|---|---|---|
| Fiók (User: e-mail, név, jelszó-hash) | a fiók megszűnéséig | törlés a fiók-törlési folyamattal (bevezetendő) |
| Cégadatok (Tenant: név, adószám, e-mail, telefon) | szerződés + számviteli idő | jogi kötelezettség miatt hosszabb lehet |
| Feltöltött dokumentumok + kiolvasott adat | az Ügyfél utasítása / előfizetés szerint | törlés a tenant/dokumentum törlésekor |
| Számlák, számlatételek (`Invoice`, `InvoiceItem`) | 【KITÖLTENDŐ: pl. 5–10 év (számviteli)】 | RO/HU számviteli megőrzés |
| `extractionRaw` (nyers AI JSON) | 【KITÖLTENDŐ – ajánlott: rövidíteni / a dokumentummal együtt törölni】 | adattakarékosság |
| Audit napló (IP-vel) | 【KITÖLTENDŐ: pl. 12 hónap】 | jelenleg nincs automatikus törlés → bevezetendő |
| Refresh token (hash) | 14 nap (lejárat) | automatikus lejárat |
| Jelszó-visszaállító token (hash) | 1 óra (lejárat) | egyszer használatos |
| Meghívó (Invitation) | lejáratig / elfogadásig | token alapú |
| Push feliratkozás | leiratkozásig / érvénytelen végpontig | hozzájárulás visszavonásakor törlés |
| Presigned URL | 15 perc | átmeneti hozzáférés |
| Megfelelőségi adat (`VehicleVerification`) | a jármű/tenant törléséig | emlékeztetőhöz |
| Anonim benchmark (`FleetBenchmark`) | korlátlan (anonim, nem személyes) | nem visszafejthető |
| Forgalmiból a tulajdonosnév | **nem tárolódik** | adattakarékosság |

## 3. Törlési eljárás

- A séma **kaszkád-törlést** támogat: a felhasználó/tenant törlésekor a kapcsolódó
  rekordok automatikusan törlődnek.
- 📌 **JELENLEGI KORLÁT (audit):** Nincs API-végpont, amely a fiók/tenant törlését
  kiváltaná, és az **objektumtárból (R2)** való fájltörlés sem garantált
  automatikusan. Ezt fejlesztéssel pótolni kell; addig a törlés **manuálisan**
  történik megkeresésre.
- Az e-mail-szolgáltatónál (Brevo) és az AI-szolgáltatónál (Google) az adatok a
  **szolgáltató saját megőrzési ideje** szerint is tárolódhatnak átmenetileg.

## 4. Mentések

> 📌 **FELTÉTELEZÉS:** A mentés/replikáció a Neon és az R2 **szolgáltatói** szintjén
> valósul meg; dedikált alkalmazás-szintű mentési és visszaállítási eljárás nincs
> dokumentálva. A mentésekben lévő adatok a szolgáltatói mentési ciklus szerint
> törlődnek. ⚠️ Véglegesítendő.

## 5. Felülvizsgálat

Az Üzemeltető a megőrzési időket évente, illetve jogszabályváltozáskor felülvizsgálja.
