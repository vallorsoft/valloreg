# Valloreg – GDPR és jogi megfelelőségi csomag

Ez a könyvtár a Valloreg platform teljes adatvédelmi és jogi dokumentumcsomagját
tartalmazza. A dokumentumok a **tényleges kódbázis, infrastruktúra és konfiguráció
auditja** alapján készültek (lásd `00_GDPR_AUDIT_JELENTES.md`), nem sablonból.

> **Verzió:** 1.0 · **Dátum:** 2026-06-27 · **Nyelv:** magyar
>
> ⚠️ **FONTOS:** Ezek a dokumentumok jogi **vázlatok**. Élesítés előtt
> **ügyvédi / adatvédelmi szakértői ellenőrzés kötelező**. A `【KITÖLTENDŐ: …】`
> jelölésű mezőket cégadatokkal kell pótolni; a `⚠️ ÜGYVÉDI ELLENŐRZÉS` és
> `📌 FELTÉTELEZÉS` jelölésű pontokat felül kell vizsgálni.

## Tartalomjegyzék

| # | Dokumentum | Fájl |
|---|------------|------|
| 0 | Audit jelentés (teljes felmérés + hiánylista) | `00_GDPR_AUDIT_JELENTES.md` |
| 1 | Adatvédelmi tájékoztató (Privacy Policy) | `01_Adatvedelmi_Tajekoztato.md` |
| 2 | Általános Szerződési Feltételek (ÁSZF / ToS) | `02_ASZF_Felhasznalasi_Feltetelek.md` |
| 3 | Cookie- és tárolási szabályzat | `03_Cookie_Szabalyzat.md` |
| 4 | Cookie-/hozzájárulási sáv szövegek | `04_Cookie_Banner_Szovegek.md` |
| 5 | Adatfeldolgozási megállapodás (DPA) | `05_Adatfeldolgozasi_Megallapodas_DPA.md` |
| 6 | Elfogadható használati szabályzat (AUP) | `06_Elfogadhato_Hasznalat_AUP.md` |
| 7 | Lemondási és visszatérítési szabályzat | `07_Lemondasi_es_Visszateritesi_Szabalyzat.md` |
| 8 | Biztonsági szabályzat | `08_Biztonsagi_Szabalyzat.md` |
| 9 | Adatmegőrzési szabályzat | `09_Adatmegorzesi_Szabalyzat.md` |
| 10 | Érintetti jogok szabályzata (GDPR) | `10_Erintetti_Jogok_Szabalyzat.md` |
| 11 | Alfeldolgozók (subprocessor) listája | `11_Alfeldolgozok_Listaja.md` |
| 12 | Impresszum / jogi közlemény | `12_Impresszum.md` |
| 13 | SaaS előfizetési feltételek | `13_SaaS_Elofizetesi_Feltetelek.md` |
| 14 | AI-használati szabályzat | `14_AI_Hasznalati_Szabalyzat.md` |

## Jogszabályi keret

- **GDPR** – az Európai Parlament és a Tanács (EU) 2016/679 rendelete
- **ePrivacy irányelv** – 2002/58/EK (a 2009/136/EK módosítással)
- **EU fogyasztóvédelem** – 2011/83/EU (fogyasztói jogok), 2019/2161/EU (Omnibus)
- **Románia** (elsődleges piac, RON pénznem): Legea nr. 190/2018 (GDPR végrehajtás),
  ANSPDCP (felügyeleti hatóság); **Magyarország:** Infotv. (2011. évi CXII. tv.), NAIH
- A digitális szolgáltatásokra: (EU) 2019/770 irányelv (digitális tartalom/szolgáltatás)

> 📌 **FELTÉTELEZÉS:** Az elsődleges piac Románia (RON árazás, ITP/RCA/rovinietă
> megfelelőség), másodlagos Magyarország és nemzetközi (hu/ro/en nyelv). A
> joghatóságot és felügyeleti hatóságot a cég székhelye dönti el – lásd hiánylista.
