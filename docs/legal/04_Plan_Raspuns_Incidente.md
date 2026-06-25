# 4. Plan de Răspuns la Incidente (Incident Response Plan)

> **MARCAJ REVIZUIRE JURIDICĂ** — Plan operațional aliniat la GDPR și la arhitectura reală. Rolurile, datele de contact și termenele trebuie completate și aprobate.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Scop și domeniu

Definește detectarea, clasificarea, tratarea și comunicarea incidentelor de securitate care afectează platforma Valloreg (API NestJS, Web Next.js, PostgreSQL/Neon, Redis, Cloudflare R2).

## B. Roluri (de completat)

| Rol | Responsabil | Contact |
|---|---|---|
| Coordonator incident | 「⚖️ DE COMPLETAT」 | |
| Responsabil tehnic | | |
| Persoană de contact protecția datelor / DPO | 「⚖️ DE COMPLETAT」 | |
| Comunicare/juridic | | |

## C. Clasificarea severității

| Nivel | Descriere | Exemple |
|---|---|---|
| **Critic (P1)** | Compromitere de date/serviciu major | Acces neautorizat la DB, scurgere documente, credențiale compromise |
| **Major (P2)** | Funcționalitate critică afectată | Indisponibilitate API, eșec autentificare |
| **Minor (P3)** | Impact limitat | Eroare izolată, degradare ne-critică |

## D. Fluxul de răspuns

1. **Detectare** — surse: jurnale de audit (`AuditLog`), logurile Render (runtime), health check `/api/health`, rapoarte de vulnerabilități (vezi `09`).
2. **Triere și clasificare** — coordonatorul atribuie severitatea (max. 1h de la detectare pentru P1).
3. **Izolare/Contenție** — revocare token-uri (`RefreshToken.revokedAt`), rotație secrete (JWT, `INTEGRATION_ENC_KEY`, chei R2/DB), restricționare acces.
4. **Eradicare** — eliminarea cauzei (patch, dezactivare provider, ex. trecere AI pe `stub`).
5. **Recuperare** — restaurare din backup (vezi `07`), validare integritate.
6. **Evaluarea unei încălcări de date** — declanșează `05_Procedura_Incalcare_Date.md`.
7. **Lecții învățate** — analiză post-incident, actualizarea măsurilor.

## E. Notificarea ANSPDCP

Dacă incidentul constituie o încălcare de date cu risc pentru persoanele vizate: notificare ANSPDCP în **maximum 72 de ore** (art. 33). Detalii în `05`.

## F. Punct critic — secrete și acces

- Secretele de producție sunt în variabile de mediu Render (`sync: false` / `generateValue`).
- 「⚖️ DE REVIZUIT — `.env.example` conține credențiale Neon reale (vezi audit `99`); la orice incident, **rotația acestor credențiale este obligatorie**.」

---

## Ipoteze și limitări

1. Detectarea se bazează pe jurnalizare aplicativă + loguri Render; nu există SIEM dedicat identificat în cod.
2. Datele de contact și SLA-urile interne de răspuns trebuie stabilite de management.

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
