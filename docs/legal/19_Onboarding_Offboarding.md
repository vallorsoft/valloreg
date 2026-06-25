# 19. Procedură de Onboarding / Offboarding

> **MARCAJ REVIZUIRE JURIDICĂ** — Procedură pentru acordarea și revocarea accesului la onboarding/offboarding (angajați/colaboratori și utilizatori-clienți). De adaptat la practica internă.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Onboarding — utilizatori-clienți (în platformă)

1. **Înregistrare** (OWNER) sau **invitație** (`Invitation` cu rol + token, expirare) trimisă pe e-mail.
2. Acceptarea invitației creează `Membership` cu rolul atribuit.
3. Acces acordat conform RBAC (`15`).

## B. Onboarding — angajați/colaboratori Valloreg

| Pas | Acțiune |
|---|---|
| 1 | Semnarea angajamentului de confidențialitate (`18`) |
| 2 | Acordarea accesului strict necesar (privilegiu minim) |
| 3 | Acces la secrete doar dacă rolul o impune (gestionat prin Render secret manager) |
| 4 | Instruire GDPR + literație AI (`12`) |
| 5 | Documentarea accesului acordat |

## C. Offboarding — la încetare

| Pas | Acțiune | Sursă tehnică |
|---|---|---|
| 1 | Revocarea sesiunilor active | `RefreshToken.revokedAt` |
| 2 | Eliminarea apartenenței / dezactivarea contului | `Membership`, `User` |
| 3 | Retragerea drepturilor de platformă | `isPlatformAdmin=false` |
| 4 | Revocarea acceselor de suport | `SupportAccess` → `REVOKED` |
| 5 | **Rotația secretelor** la care a avut acces | JWT, `INTEGRATION_ENC_KEY`, chei DB/R2/API |
| 6 | Reamintirea obligației de confidențialitate post-contractual | `18` |
| 7 | Documentarea offboarding-ului | Audit |

## D. Checklist offboarding (model)

- [ ] Sesiuni revocate
- [ ] Membership/cont dezactivat
- [ ] Drepturi platformă retrase
- [ ] Accese suport revocate
- [ ] Secrete rotite
- [ ] Acces e-mail/instrumente revocat
- [ ] Confidențialitate reamintită
- [ ] Documentat

「⚖️ DE REVIZUIT — termenele de revocare (recomandat: imediat la încetare) și responsabilul de proces.」

---

## Ipoteze și limitări

1. Unele acțiuni (rotație secrete, revocare acces la instrumente externe) sunt manuale și depind de proceduri operaționale.
2. Pentru utilizatorii-clienți, gestionarea membrilor revine companiei-client (OWNER/ADMIN).

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
