# 10. Declarație de Conformitate EU AI Act

> **MARCAJ REVIZUIRE JURIDICĂ** — Evaluare conform **Regulamentului (UE) 2024/1689 (EU AI Act)**, bazată pe utilizarea reală a AI în platformă. Clasificarea de risc trebuie confirmată juridic.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Sistemul AI utilizat

| Element | Detaliu (sursă: cod) |
|---|---|
| Funcție | OCR + extragere de date din documente (facturi, certificate de înmatriculare) |
| Furnizor model | **Google Gemini** (`generativelanguage.googleapis.com`) |
| Modele | Lanț: `gemini-2.0-flash` → `-flash-lite` → `2.5-flash` → `2.5-flash-lite` → `1.5-flash` → `1.5-flash-8b` |
| Mod | `temperature=0` (determinist) |
| Rol Valloreg | **Operator/Deployer** al unui sistem Aic de uz general integrat (nu dezvoltăm modelul) |
| Stare implicită | **Dezactivat** (`EXTRACTION_PROVIDER=stub`) |

## B. Clasificarea riscului (Titlul II–III)

| Categorie AI Act | Aplicabilitate | Justificare |
|---|---|---|
| Practici interzise (art. 5) | **Nu** | Fără scoring social, manipulare, biometrie interzisă |
| Risc ridicat (Anexa III) | **Nu** (evaluare preliminară) | Extragere de date din documente de business; **fără** decizii cu efect juridic asupra persoanelor; **validare umană obligatorie** |
| Risc limitat / transparență (art. 50) | **Da** | Obligație de transparență: utilizatorii sunt informați că interacționează cu rezultate generate de AI (vezi `13`) |
| Risc minim | Parțial | Restul funcțiilor |

**Concluzie preliminară:** sistemul se încadrează la **risc limitat**, cu obligații de **transparență** și **supraveghere umană**, nu în categoria „risc ridicat". 「⚖️ DE REVIZUIT — confirmarea că extragerea nu alimentează decizii automate cu efect semnificativ.」

## C. Obligații aplicabile și conformitate

| Obligație | Stare |
|---|---|
| Transparență AI (art. 50) | Notificare AI publicată — vezi `13` |
| Supraveghere umană | Validare obligatorie a rezultatelor — vezi `12` |
| Acuratețe/robustețe | Scor `confidence`, lanț de modele cu fallback, audit |
| Trasabilitate | Rezultatele AI sunt jurnalizate (audit) |
| Literație AI (art. 4) | 「⚖️ instruire a personalului — de operaționalizat」 |

## D. Interacțiunea cu GDPR

AI procesează documente ce pot conține date personale → vezi `02_DPIA.md` și `03_TIA.md` (transfer SUA). Fără decizii automatizate art. 22 GDPR.

---

## Ipoteze și limitări

1. Clasificarea „risc limitat" presupune că extragerea AI **nu** determină decizii cu efect juridic/semnificativ asupra persoanelor — de confirmat pentru toate cazurile de uz.
2. Calendarul de aplicare a EU AI Act este eșalonat; obligațiile concrete se activează la termenele prevăzute.
3. Dacă se introduc funcții AI noi (ex. profilare), reclasificarea este obligatorie.

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
