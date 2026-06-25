# 11. Registrul de Riscuri AI (AI Risk Register)

> **MARCAJ REVIZUIRE JURIDICĂ** — Registru de riscuri pentru componentele AI/OCR, conform abordării EU AI Act și bunelor practici de management al riscului.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## Registru

| ID | Risc | Sursă | Probabil. | Impact | Măsuri existente (cod) | Risc rezidual | Responsabil |
|---|---|---|---|---|---|---|---|
| AI-01 | Extragere incorectă a câmpurilor (factură/vehicul) | Limitări model | Mediu | Mediu | Validare umană obligatorie; scor `confidence`; status `NEEDS_REVIEW` | Scăzut | 「DE NUMIT」 |
| AI-02 | „Halucinație" / date inventate | LLM | Mediu | Mediu | `temperature=0`; schema strictă de parsare; validare umană | Scăzut | |
| AI-03 | Transfer de date personale către SUA (Google) | Apel API extern | Mediu (dacă activat) | Mediu–Ridicat | Implicit `stub`; TLS; vezi TIA; minimizare | Mediu | |
| AI-04 | Indisponibilitate model / depășire cvotă | API extern | Mediu | Scăzut | Lanț de fallback (429/5xx → următorul model) | Scăzut | |
| AI-05 | Clasificare greșită a tipului de document | Model | Mediu | Scăzut | Status `NOT_INVOICE`/`NEEDS_REVIEW`; revizuire | Scăzut | |
| AI-06 | Prelucrare incidentală de date sensibile (art. 9) | Conținut documente | Scăzut | Ridicat | Limitarea câmpurilor extrase; politică de minimizare | Mediu | |
| AI-07 | Lipsa antrenării pe datele clientului (confidențialitate) | Termeni furnizor | — | Ridicat | 「⚖️ de confirmat contractual cu Google că datele nu sunt folosite la antrenare」 | De stabilit | |
| AI-08 | Dependență de un singur furnizor (Google) | Arhitectură | Mediu | Scăzut | Abstractizare provider (`stub`/`gemini`); comutare ușoară | Scăzut | |
| AI-09 | Lipsă de transparență față de utilizator | Design | Scăzut | Mediu | Notificare AI (`13`); status vizibil de revizuire | Scăzut | |
| AI-10 | Eroare la duplicate/deduplicare | Logică AI+hash | Scăzut | Scăzut | Hash SHA-256 unic per tenant; marcare `DUPLICATE` reversibilă | Scăzut | |

## Scală

- **Probabilitate / Impact:** Scăzut / Mediu / Ridicat.
- Revizuire recomandată: la fiecare modificare a providerului AI sau **cel puțin semestrial**.

---

## Ipoteze și limitări

1. Riscurile AI-03/AI-07 sunt materiale doar la activarea Gemini (`EXTRACTION_PROVIDER=gemini`).
2. Responsabilii și termenele de tratare trebuie atribuite intern.

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
