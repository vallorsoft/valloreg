# Alfeldolgozók (subprocessor) listája

> **Verzió:** 1.0 (vázlat) · **Utolsó frissítés:** 2026-06-24
> ⚠️ **ÜGYVÉDI / MŰSZAKI ELLENŐRZÉS:** A pontos jogi entitások, régiók és a DPA/SCC
> állapota szolgáltatónként megerősítendő. Ez a lista a kódbázis és az
> infrastruktúra-konfiguráció (`render.yaml`, `.env.example`) auditján alapul.

A Valloreg az alábbi alfeldolgozókat veszi igénybe a szolgáltatás nyújtásához. A
„Feltételes" oszlop jelzi, ha az adott szolgáltató csak bizonyos – jellemzően
opcionális – funkció bekapcsolásakor kezel adatot (a Platform alapértelmezésben
több AI/külső providert `stub` módban futtat).

## Aktív / kötelező alfeldolgozók

| Szolgáltató | Funkció | Kezelt adat | Régió | EGT-n kívül? | Feltételes? |
|---|---|---|---|---|---|
| **Render** (Render, Inc.) | hosting (API, web, Redis/sor) | minden alkalmazás-adat tranzit/feldolgozás közben | Frankfurt (EU); anyacég US | anyacég US ⚠️ | nem |
| **Neon** (Neon, Inc.) | PostgreSQL adatbázis | minden strukturált adat | AWS `eu-central-1` (EU); anyacég US | anyacég US ⚠️ | nem |
| **Cloudflare R2** (Cloudflare, Inc.) | dokumentum-/objektumtár | feltöltött fájlok (számla/forgalmi/kép) | konfigurálható; anyacég US | lehet ⚠️ | nem |

## Feltételes / opcionális alfeldolgozók

| Szolgáltató | Funkció | Kezelt adat | Régió | EGT-n kívül? | Mikor aktív |
|---|---|---|---|---|---|
| **Brevo** (Sendinblue SAS) | tranzakciós e-mail | címzett e-mail, üzenet tartalma | Franciaország (EGT) | nem | ha `BREVO_API_KEY` beállítva |
| **Google Gemini** (Google LLC) | AI/OCR kiolvasás | a feltöltött dokumentum **képe/PDF-je** és kiolvasott szöveg | USA | **igen** ⚠️ | ha `OCR/EXTRACTION_PROVIDER=gemini` |
| **Böngésző push-szolgáltatás** (pl. Google FCM, Mozilla, Apple) | web push kézbesítés | push-végpont, titkosított üzenet | jellemzően US | igen ⚠️ | ha a felhasználó engedélyezi az értesítést |
| **RO megfelelőség-API** | ITP/RCA/rovinietă lekérés | rendszám, VIN | Románia (konfig.) | nem (vélhetően) | ha `VEHICLE_VERIFY_PROVIDER=ro` |
| **Recall feed** | jármű-visszahívások | márka, modell, év (nem személyes) | EU (konfig.) | nem | ha `BENCHMARK_RECALL_PROVIDER=external` |

## Megjegyzések

- **Nem alfeldolgozó:** a belső Redis (sor) önmagában nem harmadik fél, hanem a
  Render által nyújtott szolgáltatás (a fenti Render sorban szerepel). A sorban csak
  **job-azonosítók** (tenantId, dokumentum-/scan-azonosító) utaznak, nem a fájl
  tartalma.
- **EGT-n kívüli továbbítás:** lásd az Adatvédelmi tájékoztató 6. pontját és a DPA
  7. pontját – SCC / EU–US Data Privacy Framework szükséges.

> ⚠️ **TEENDŐ:** Minden aktív szolgáltatóval **DPA** aláírása; EGT-n kívülre **SCC +
> Transfer Impact Assessment**. A lista változásáról az Ügyfeleket előzetesen
> tájékoztatni kell (lásd DPA 6. pont).
