# 5. Procedură de Încălcare a Securității Datelor cu Caracter Personal

> **MARCAJ REVIZUIRE JURIDICĂ** — Procedură conform **art. 33–34 GDPR** și Legii 190/2018. Necesită validare juridică.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Definiție

Încălcare = o încălcare a securității care duce, în mod accidental sau ilegal, la distrugerea, pierderea, modificarea, divulgarea neautorizată sau accesul neautorizat la date cu caracter personal (art. 4 pct. 12).

## B. Etape

1. **Identificare și înregistrare** — orice suspiciune se consemnează în **Registrul intern al încălcărilor** (vezi secțiunea E). Se notează: data/ora descoperirii, sursa, datele afectate.
2. **Evaluarea impactului** — categorii și volum de date, număr de persoane vizate, severitate, probabilitatea unui risc pentru drepturi și libertăți.
3. **Limitarea efectelor** — măsuri tehnice imediate (revocare token-uri, rotație secrete, izolare). Coordonare cu `04`.
4. **Determinarea obligației de notificare:**
   - **Către ANSPDCP** (art. 33): dacă există risc → în **max. 72 ore** de la luarea la cunoștință. Notificare în etape dacă informațiile nu sunt complete.
   - **Către persoanele vizate** (art. 34): dacă **risc ridicat** → fără întârziere nejustificată.
   - **Către clientul-operator**: când Valloreg este **persoană împuternicită**, notifică operatorul (clientul) fără întârziere (art. 33(2)), conform DPA.
5. **Documentare** — toate încălcările se documentează indiferent de notificare (art. 33(5)).
6. **Remediere și follow-up.**

## C. Rolul dublu (operator / împuternicit)

| Tip de date | Rolul Valloreg | Cine notifică ANSPDCP |
|---|---|---|
| Conturi, audit, abonamente | Operator | Valloreg |
| Documente/flotă ale clienților | Împuternicit | Clientul (Valloreg îl informează) |

## D. Conținutul notificării (art. 33(3))

- Natura încălcării, categoriile și numărul aproximativ de persoane/înregistrări;
- Datele de contact ale punctului de contact (DPO);
- Consecințele probabile;
- Măsurile luate/propuse.

## E. Registrul intern al încălcărilor (model)

| ID | Data descoperirii | Descriere | Date afectate | Nr. persoane | Risc | Notificat ANSPDCP (D/N + dată) | Notificat persoane | Măsuri |
|---|---|---|---|---|---|---|---|---|
| | | | | | | | | |

## F. Surse tehnice de probe

`AuditLog` (acțiuni + IP), loguri Render, înregistrările de acces suport (`SupportAccess`).

---

## Ipoteze și limitări

1. Termenul de 72 ore curge de la momentul luării la cunoștință de către operator.
2. Pragul de „risc" / „risc ridicat" se evaluează caz-cu-caz; recomandată consultarea juridică pentru cazuri limită.

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
