# 20. Registrul Complet al Subîmputerniciților

> **MARCAJ REVIZUIRE JURIDICĂ** — Lista subîmputerniciților a fost extrasă din configurația reală (`.env.example`, `render.yaml`, providerii din cod). Adresele/garanțiile contractuale și mecanismele de transfer trebuie **confirmate juridic** și completate cu DPA-urile semnate.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Subîmputerniciți activi (în configurația implicită de producție)

| # | Subîmputernicit | Serviciu | Categorii de date | Locație/Regiune | Transfer extra-UE | Temei transfer |
|---|---|---|---|---|---|---|
| S1 | **Render** (Render Services, Inc.) | Găzduire API + Web + Redis | Toate datele procesate de aplicație, jurnale | Regiune `frankfurt` (UE) | Posibil (companie SUA) | 「⚖️ SCC de verificat」 |
| S2 | **Neon** (Neon, Inc.) | Bază de date PostgreSQL | Toate datele structurate (conturi, flotă, audit, IP) | `eu-central-1` (Frankfurt, AWS, UE) | Posibil (companie SUA) | 「⚖️ SCC de verificat」 |
| S3 | **Cloudflare R2** (Cloudflare, Inc.) | Stocare obiecte (documente) | Documente încărcate (pot conține date personale) | `region=auto` (global) | **Da** | 「⚖️ SCC + DPA Cloudflare」 |
| S4 | **Brevo** (Sendinblue SAS) | E-mail tranzacțional (invitații, resetare parolă) | E-mail destinatar, conținut mesaj | UE (Franța) | Nu (în principal) | DPA Brevo |

## B. Subîmputerniciți condiționați (activați doar la configurare explicită)

| # | Subîmputernicit | Serviciu | Stare implicită | Date trimise | Transfer |
|---|---|---|---|---|---|
| S5 | **Google** (Gemini API) | OCR + extragere AI | **Dezactivat** (`stub`) | Imagine document (base64) + text OCR | **SUA** (`generativelanguage.googleapis.com`) — vezi TIA |
| S6 | **Furnizor verificare RO** | ITP/RCA/rovinietă | **Dezactivat** (`stub`) | `plate`, `vin`, `country=RO` | Depinde de furnizor (`RO_VERIFY_API_URL`) |
| S7 | **Sursă recall** (ex. feed EU Safety Gate) | Date de rechemare vehicule | **Dezactivat** (`stub`) | Interogări de model (fără date personale) | Depinde de feed |
| S8 | **Servicii push browser** (Google FCM / Mozilla / Microsoft) | Livrare notificări push | Activ doar dacă utilizatorul consimte | `endpoint` push, payload notificare | Variabil (vezi TIA) |

## C. Infrastructură de dezvoltare locală (NU producție)

`docker-compose.yml`: PostgreSQL 16, Redis 7, MinIO (S3 local), MailHog (SMTP local). Nu prelucrează date reale de producție.

---

## D. Cerințe pentru fiecare subîmputernicit (art. 28 GDPR)

Pentru fiecare intrare de mai sus trebuie să existe:
1. **Contract de prelucrare (DPA)** conform art. 28(3);
2. **Garanții de transfer** (SCC / decizie de adecvare) pentru transferurile extra-UE;
3. Evaluarea măsurilor suplimentare (vezi `03_TIA.md`);
4. Includerea în notificarea de confidențialitate către persoanele vizate.

「⚖️ DE REVIZUIT — A se atașa DPA-urile semnate și adresele sediilor sociale ale fiecărui subîmputernicit. A se confirma că lista de subîmputerniciți este comunicată clienților-operatori conform DPA (drept de obiecție).」

---

## Ipoteze și limitări

1. Lista derivă din variabilele de mediu și providerii din cod; subîmputerniciții condiționați (S5–S8) nu prelucrează date în configurația implicită.
2. Locațiile exacte de stocare ale Cloudflare R2 depind de configurația contului (`region=auto`); de fixat o regiune UE dacă se dorește.
3. Statutul de transfer SUA pentru Render/Neon depinde de structura contractuală reală — de confirmat cu furnizorii.

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
