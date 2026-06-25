# 12. Procedură de Supraveghere Umană (Human Oversight) pentru AI

> **MARCAJ REVIZUIRE JURIDICĂ** — Procedură conform principiului de supraveghere umană (EU AI Act, art. 14) și art. 22 GDPR. Reflectă fluxul real de revizuire din aplicație.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Principiu

**Niciun rezultat AI nu produce efecte fără validare umană.** Extragerea OCR/AI generează un **draft** pe care utilizatorul îl confirmă, corectează sau respinge. Nu există decizii complet automatizate cu efect juridic (art. 22 GDPR).

## B. Fluxul de supraveghere (verificat în cod)

1. **Procesare AI** → document primește status (`UPLOADED → QUEUED → OCR_RUNNING → EXTRACTING → NEEDS_REVIEW / AUTO_OK / NOT_INVOICE / DUPLICATE`).
2. **Semnalizare pentru revizuire** — statusul `NEEDS_REVIEW` și scorul `confidence` (pe `Invoice`/`InvoiceItem`) indică încrederea extragerii.
3. **Revizuire umană** — interfața de revizuire a documentului (`DocumentReviewClient`) permite utilizatorului să verifice și să **confirme** (`CONFIRMED`) sau să corecteze datele.
4. **Scanare vehicul** — `VehicleScan` produce un `draft`; confirmarea umană leagă datele de vehicul (`confirm`).
5. **Duplicate** — marcate `DUPLICATE` (pe baza furnizor + număr factură); utilizatorul poate **suprascrie** decizia.
6. **Jurnalizare** — confirmările și deciziile relevante sunt înregistrate în audit.

## C. Responsabilități ale operatorului uman

- Verificarea acurateței câmpurilor extrase înainte de confirmare;
- Corectarea valorilor greșite;
- Respingerea clasificărilor eronate (ex. `NOT_INVOICE`);
- Escaladarea cazurilor neclare.

## D. Competență și instruire

「⚖️ DE OPERAȚIONALIZAT — instruirea utilizatorilor privind limitele AI (literație AI, art. 4 AI Act) și recunoașterea erorilor de extragere.」

## E. Măsuri tehnice de sprijin

| Mecanism | Rol |
|---|---|
| Scor `confidence` | Prioritizează revizuirea |
| Status `NEEDS_REVIEW` | Forțează atenția umană |
| `temperature=0` | Reduce variabilitatea |
| Audit log | Trasabilitate a deciziilor |

---

## Ipoteze și limitări

1. Procedura presupune că utilizatorii confirmă efectiv datele; o eventuală „auto-confirmare" în masă ar trebui evitată/limitată.
2. Pragurile de `confidence` pentru `AUTO_OK` vs. `NEEDS_REVIEW` trebuie revizuite periodic pentru a menține supravegherea efectivă.

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
