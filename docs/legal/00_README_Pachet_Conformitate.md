# Pachet de Conformitate Tehnică GDPR & EU AI Act — Valloreg

> **MARCAJ REVIZUIRE JURIDICĂ** — Toate documentele din acest pachet au fost generate pe baza **implementării tehnice reale** a platformei Valloreg (cod sursă, schemă de bază de date, configurație de infrastructură) și sunt destinate **revizuirii și aprobării de către avocatul societății** înainte de utilizarea în producție. Niciun document nu constituie consultanță juridică.

## Operator de date

| Câmp | Valoare |
|---|---|
| Denumire | **VALLOR TEAM SRL** |
| CUI | 47859317 |
| Nr. Reg. Com. | J2023000114142 |
| EUID | ROONRC.J2023000114142 |
| Sediu | Sat Arcuș, Cart. Poiana Arcușului nr. 102, cod 527166, jud. Covasna, România |
| Telefon | 0769532015 |
| E-mail | vallorsoft@gmail.com |
| Frontend (PWA) | https://valloreg-web.onrender.com |
| API | https://valloreg-api.onrender.com |

## Cadru legal de referință

- **GDPR** — Regulamentul (UE) 2016/679;
- **Legea nr. 190/2018** privind măsuri de punere în aplicare a GDPR în România;
- **Directiva ePrivacy** 2002/58/CE și **Legea nr. 506/2004** (transpunere RO);
- **EU AI Act** — Regulamentul (UE) 2024/1689;
- Autoritatea de supraveghere: **ANSPDCP** (www.dataprotection.ro).

## Conținutul pachetului

| # | Document | Fișier |
|---|---|---|
| 1 | Registrul Activităților de Prelucrare (ROPA) | `01_ROPA.md` |
| 2 | Evaluarea Impactului asupra Protecției Datelor (DPIA) | `02_DPIA.md` |
| 3 | Evaluarea Impactului Transferului (TIA) | `03_TIA.md` |
| 4 | Plan de Răspuns la Incidente | `04_Plan_Raspuns_Incidente.md` |
| 5 | Procedură de Încălcare a Securității Datelor | `05_Procedura_Incalcare_Date.md` |
| 6 | Registrul Măsurilor de Securitate | `06_Registru_Masuri_Securitate.md` |
| 7 | Plan de Backup și Recuperare în caz de Dezastru | `07_Backup_Disaster_Recovery.md` |
| 8 | Plan de Continuitate a Activității | `08_Continuitate_Activitate.md` |
| 9 | Politică de Divulgare a Vulnerabilităților | `09_Divulgare_Vulnerabilitati.md` |
| 10 | Declarație de Conformitate EU AI Act | `10_Declaratie_EU_AI_Act.md` |
| 11 | Registrul de Riscuri AI | `11_Registru_Riscuri_AI.md` |
| 12 | Procedură de Supraveghere Umană (AI) | `12_Procedura_Supraveghere_Umana.md` |
| 13 | Notificare de Transparență AI | `13_Notificare_Transparenta_AI.md` |
| 14 | Procedură Internă GDPR | `14_Procedura_Interna_GDPR.md` |
| 15 | Politică de Control al Accesului | `15_Politica_Control_Acces.md` |
| 16 | Procedură de Revizuire a Accesului Utilizatorilor | `16_Revizuire_Acces_Utilizatori.md` |
| 17 | Schema de Retenție a Datelor | `17_Schema_Retentie_Date.md` |
| 18 | Politică de Confidențialitate a Angajaților | `18_Confidentialitate_Angajati.md` |
| 19 | Procedură de Onboarding/Offboarding | `19_Onboarding_Offboarding.md` |
| 20 | Registrul Complet al Subîmputerniciților | `20_Registru_Subimputerniciti.md` |

## Document complementar (audit tehnic)

- `99_Audit_Tehnic_Conformitate.md` — **Atenție**: raport intern de neconformități tehnice identificate în cod (ex. credențiale expuse, controale documentate dar neimplementate). NU este destinat publicării; servește remedierii interne și informării avocatului.

## Note metodologice transversale

1. **Sursa adevărului = codul.** Fiecare afirmație tehnică derivă din cod/configurație reală. Nu au fost inventate funcționalități.
2. **Provider AI implicit = `stub`.** În configurația de producție (`render.yaml`), `EXTRACTION_PROVIDER=stub` și `OCR_PROVIDER=stub`. Prelucrarea AI prin Google Gemini se activează **doar** la configurare explicită (`EXTRACTION_PROVIDER=gemini` + cheie API). Documentele tratează ambele stări.
3. **Ipotezele** sunt enumerate explicit la finalul fiecărui document, în secțiunea „Ipoteze și limitări".
4. **Marcajele 「⚖️ DE REVIZUIT」** semnalează punctele care necesită decizie sau validare juridică.

---
*Versiune tehnică: 1.0 · Data generării: 2026-06-25 · Generat pentru revizuire juridică profesională.*
