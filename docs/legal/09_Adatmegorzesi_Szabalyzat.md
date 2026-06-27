# Adatmegőrzési szabályzat (Data Retention Policy)

> **Verzió:** 1.0 · **Hatályos:** 2026-06-27
> ⚠️ **ÜGYVÉDI ELLENŐRZÉS KÖTELEZŐ** – a megőrzési idők a számviteli és ágazati
> jogszabályoktól függenek (RO/HU). Az alábbiak a tényleges adatmodell és
> konfiguráció szerinti értékek; a számviteli megőrzési idők jogszabályi
> véglegesítése ügyvédi ellenőrzést igényel.

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
| Feltöltött szerviz-számlák és tételeik (`Invoice`, `InvoiceItem` – OCR-rel kiolvasott adat) | az Ügyfél utasítása / a dokumentum vagy a tenant törléséig | Az Üzemeltető ezekre **adatfeldolgozó**: nem ő állítja ki, tölti fel vagy szerkeszti, csak feldolgozza a szerviz-adatokért, ezért **nem terheli önálló archiválási kötelezettség** – a kliens törlésével törlődik |
| Az Üzemeltető által **kiállított** előfizetési/szolgáltatási számlák (saját számviteli bizonylatok) | a számviteli jogszabály szerint (RO: jellemzően 10 év) | Saját bizonylat → **kötelező megőrzés** (RO Legea contabilității nr. 82/1991) |
| `extractionRaw` (nyers AI JSON) | a kapcsolódó dokumentummal együtt törlődik | adattakarékosság |
| Audit napló (IP-vel) | 12 hónap (365 nap) | automatikus napi törlési job (`AUDIT_LOG_RETENTION_DAYS=365`, konfigurálható) |
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
