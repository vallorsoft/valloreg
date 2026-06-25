# 14. Procedură Internă GDPR (inclusiv cererile persoanelor vizate)

> **MARCAJ REVIZUIRE JURIDICĂ** — Procedură internă de conformitate GDPR și de soluționare a cererilor persoanelor vizate (art. 12–22). Necesită validare juridică.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Principii operaționale

- **Need-to-know:** accesul la date se acordă strict pe baza necesității (vezi `15`).
- **Minimizare:** se colectează și se procesează doar datele necesare.
- **Răspundere (accountability):** documentarea prelucrărilor (ROPA, audit log).
- **Privacy by design/default:** izolare multi-tenant, AI implicit `stub`, opt-in pentru push/benchmark.

## B. Soluționarea cererilor persoanelor vizate (DSAR)

| Drept | Articol | Mod de tratare |
|---|---|---|
| Acces | 15 | Export al datelor de cont/flotă asociate |
| Rectificare | 16 | Corectare în aplicație / la cerere |
| Ștergere | 17 | 「⚖️ procedură de implementat — endpoint dedicat neidentificat în cod」 |
| Restricționare | 18 | Suspendarea prelucrării |
| Portabilitate | 20 | Export structurat (ex. date factură/vehicul) |
| Opoziție | 21 | Oprire marketing/interes legitim |
| Retragere consimțământ | 7(3) | Dezabonare push; oprire benchmark (`benchmarkOptIn`) |

**Termen:** maximum **30 de zile** de la cerere (prelungibil cu 60 zile în cazuri complexe, cu informare).

## C. Fluxul intern

1. **Recepție** cerere → vallorsoft@gmail.com → înregistrare.
2. **Verificarea identității** solicitantului.
3. **Identificarea rolului:** dacă datele aparțin unui client-operator (documente/flotă), cererea se redirecționează către client; Valloreg acționează ca împuternicit.
4. **Colectarea datelor** din sistemele relevante (DB, R2, audit).
5. **Răspuns** în termen, documentat.

## D. Distincția operator / împuternicit

| Date | Cine răspunde la DSAR |
|---|---|
| Cont, audit, abonamente | Valloreg (operator) |
| Documente, facturi, flotă | Clientul (operator); Valloreg asistă (împuternicit) |

## E. Registre și evidențe

- ROPA (`01`), Registrul încălcărilor (`05`), Registrul subîmputerniciților (`20`), jurnale de audit.

## F. Revizuirea accesului și instruire

- Revizuire periodică a accesului (`16`); instruire angajați (`18`, `19`).

---

## Ipoteze și limitări

1. Lipsa unui endpoint automat de ștergere impune o procedură manuală documentată până la implementare.
2. Identificarea solicitantului trebuie făcută fără colectare excesivă de date suplimentare.

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
