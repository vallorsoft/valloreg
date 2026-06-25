# 3. Evaluarea Impactului Transferului (Transfer Impact Assessment – TIA)

> **MARCAJ REVIZUIRE JURIDICĂ** — TIA întocmit conform Schrems II și recomandărilor EDPB 01/2020, pe baza fluxurilor reale de date din cod. Mecanismele de transfer (SCC, măsuri suplimentare) trebuie **validate juridic**.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Scop

Evaluarea transferurilor de date cu caracter personal către state terțe (în special SUA) și a garanțiilor aferente, pentru subîmputerniciții identificați în `20_Registru_Subimputerniciti.md`.

## B. Cartografierea transferurilor

| Flux | Destinatar | Date transferate | Destinație | Mecanism |
|---|---|---|---|---|
| T1 | Render (găzduire) | Toate (în tranzit/procesare) | Regiune `frankfurt` (UE); entitate SUA | SCC + măsuri tehnice |
| T2 | Neon (DB) | Date structurate, IP audit | `eu-central-1` (UE); entitate SUA | SCC + criptare |
| T3 | Cloudflare R2 (storage) | Documente | `region=auto` (global) | SCC + DPA |
| T4 | Google Gemini (AI) | **Imagine document + text OCR** | **SUA** | SCC Google + măsuri — **doar dacă AI activat** |
| T5 | Brevo (e-mail) | E-mail, conținut mesaj | UE (Franța) | DPA (în principal intra-UE) |
| T6 | Servicii push browser | `endpoint`, payload | Variabil (FCM=SUA) | Condiționat de consimțământ |

## C. Evaluarea per flux critic (T4 — Google Gemini)

| Criteriu | Evaluare |
|---|---|
| Stare implicită | **Transfer inexistent**: `EXTRACTION_PROVIDER=stub`, `OCR_PROVIDER=stub`. T4 apare **numai** la activarea explicită a Gemini. |
| Date | Conținut de documente, care pot include date personale ale terților (nume, `ownerName`, date de factură) |
| Endpoint | `https://generativelanguage.googleapis.com` (Google, fără parametru de regiune → rutare implicită SUA) |
| Sensibilitate | Medie–ridicată (documente de business; posibile date personale incidentale) |
| Risc lege străină (FISA 702) | Aplicabil furnizorilor de comunicații electronice din SUA |
| Măsuri tehnice existente | TLS în tranzit; `temperature=0` (determinist); fără antrenare pe datele clientului — **de confirmat contractual cu Google** |
| Măsuri suplimentare recomandate | Minimizarea datelor trimise; mascarea câmpurilor sensibile; opțiune de a folosi exclusiv `stub`; evaluarea unui endpoint regional UE Vertex AI |

## D. Măsuri suplimentare (EDPB)

- **Tehnice:** criptare în tranzit (TLS) pentru toate fluxurile; criptare în repaus la nivel de furnizor (Neon, R2) — 「⚖️ criptarea la nivel de aplicație **nu** este configurată explicit (vezi audit)」; pseudonimizare unde e posibil.
- **Contractuale:** SCC (module relevante) + clauze privind notificarea cererilor autorităților.
- **Organizatorice:** politică de minimizare; păstrarea AI pe `stub` dacă transferul nu este acceptabil pentru client.

## E. Concluzie

1. În **configurația implicită**, transferurile extra-UE de date personale sunt limitate (AI și verificarea RO dezactivate). Fluxurile de bază (T1–T3) sunt găzduite în UE (Frankfurt), cu entități-mamă din SUA care necesită SCC.
2. La **activarea AI (T4)**, transferul către SUA devine material și impune SCC Google + măsuri suplimentare + informarea clientului-operator.

「⚖️ DE REVIZUIT — A se decide dacă activarea Gemini este permisă contractual cu clienții și a se atașa SCC-urile + analiza de drept aplicabil per furnizor.」

---

## Ipoteze și limitări

1. Rutarea geografică Google/Cloudflare a fost dedusă din absența parametrilor de regiune în cod.
2. Statutul de transfer al Render/Neon depinde de structura contractuală (regiune UE configurată, entitate-mamă SUA).
3. TIA presupune lipsa unei decizii de adecvare aplicabile la data evaluării — de reverificat (ex. EU–US Data Privacy Framework).

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
