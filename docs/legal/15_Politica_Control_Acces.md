# 15. Politică de Control al Accesului (Access Control Policy)

> **MARCAJ REVIZUIRE JURIDICĂ** — Politică bazată pe modelul RBAC real (`packages/shared/src/roles.ts`) și pe guards-urile implementate.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Principii

- **Need-to-know** și **privilegiu minim**.
- **Separarea atribuțiilor** între roluri de companie și rol de platformă.
- **Izolare multi-tenant** aplicată automat (fail-closed).

## B. Roluri și drepturi (RBAC real)

### Roluri de companie (tenant) — ierarhie pe rang

| Rol | Rang | Drepturi (rezumat) |
|---|---|---|
| `VIEWER` | 1 | Doar citire |
| `ACCOUNTANT` | 2 | Costuri, rapoarte, export (financiar) |
| `FLEET_MANAGER` | 3 | Vehicule, facturi, întreținere |
| `ADMIN` | 4 | Utilizatori, setări, acces suport |
| `OWNER` | 5 | Acces complet la compania sa, facturare, utilizatori |

Verificarea ierarhiei: `hasAtLeastRole(role, required)` (rang crescător = mai multe drepturi).

### Rol de platformă

| Rol | Drepturi |
|---|---|
| `SUPER_ADMIN` (`isPlatformAdmin`) | Companii, abonamente, feature flags, statistici, audit. **NU** vede conținutul de business (documente/costuri) implicit. |

## C. Mecanisme de control (verificate în cod)

| Mecanism | Implementare |
|---|---|
| Autentificare | JWT (`JwtAuthGuard`), Argon2 |
| Autorizare rol | `@Roles()` + `RolesGuard` |
| Izolare tenant | `TenantGuard` + extensie Prisma fail-closed |
| Acces platformă | `PlatformAdminGuard` |
| Feature gating | `FeatureGuard` + `@RequireFeature()` (respins și pe backend) |
| Acces suport temporar | `SupportAccess` (1h/24h/7z), expirare + log |

## D. Gestionarea conturilor

- Crearea de cont = înregistrare (OWNER al unei companii noi) + invitație pe e-mail pentru ceilalți (`Invitation`, cu rol și token, expirare).
- Schimbarea rolului: prin `change-role` (controlat de roluri superioare).
- Revocarea: ștergere membership / dezactivare.

## E. Lacune cunoscute (a se remedia)

- **2FA neimplementat** (câmp prezent, fără logică) — vezi `99`.
- **Rate limiting neimplementat** pe endpoint-urile de autentificare — vezi `99`.

「⚖️ DE REVIZUIT — politica de parole (lungime/complexitate) și eventuala impunere a 2FA pentru roluri privilegiate.」

---

## Ipoteze și limitări

1. Matricea de drepturi per endpoint este distribuită în controllere (`@Roles()`); rezumatul de mai sus reflectă rolurile din `roles.ts`.
2. Eficacitatea izolării multi-tenant depinde de testele care verifică expres scenariile cross-tenant.

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
