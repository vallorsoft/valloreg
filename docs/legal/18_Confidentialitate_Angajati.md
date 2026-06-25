# 18. Politică de Confidențialitate a Angajaților (Employee Confidentiality Policy)

> **MARCAJ REVIZUIRE JURIDICĂ** — Politică-cadru pentru angajați/colaboratori. Trebuie adaptată dreptului muncii românesc și inclusă în contracte/anexe.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Scop

Stabilește obligațiile de confidențialitate ale angajaților și colaboratorilor VALLOR TEAM SRL cu privire la datele cu caracter personal, datele clienților și secretele comerciale.

## B. Obligații generale

1. **Confidențialitate:** nedivulgarea datelor personale, a documentelor clienților și a informațiilor de business accesate în cursul activității.
2. **Need-to-know:** accesarea datelor doar în limita sarcinilor (corelat cu `15`).
3. **Interdicția exportului neautorizat** de date în afara sistemelor aprobate.
4. **Protecția credențialelor:** nepartajarea parolelor/token-urilor; raportarea compromiterilor.
5. **Utilizarea accesului de suport** strict pentru scopul declarat, conștient că este **temporar și jurnalizat** (`SupportAccess`, audit).
6. **Respectarea separării privilegiilor:** personalul de platformă (`SUPER_ADMIN`) nu accesează conținut de business al clienților fără temei și fără acces suport acordat.

## C. Date sensibile interne

- Secrete de producție (chei JWT, `INTEGRATION_ENC_KEY`, credențiale DB/R2/API) — acces strict limitat, gestionate prin secret manager (Render).
- 「⚖️ Reamintire: credențialele din `.env.example` trebuie tratate ca compromise și rotite (vezi `99`).」

## D. Durata obligației

Obligația de confidențialitate se menține și **după încetarea** raportului de muncă/colaborare.

## E. Consecințe

Încălcarea poate atrage răspundere disciplinară, civilă și/sau penală, conform legii și contractului.

## F. Raportare

Suspiciunile de încălcare a securității/confidențialității se raportează imediat (vezi `04`/`05`).

---

## Ipoteze și limitări

1. Politica este un cadru; clauzele contractuale concrete (NDA, sancțiuni) trebuie redactate juridic.
2. Trebuie corelată cu informarea angajaților privind prelucrarea propriilor date (dacă există angajați).

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
