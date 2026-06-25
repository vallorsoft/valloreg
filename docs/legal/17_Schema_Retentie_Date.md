# 17. Schema de Retenție a Datelor

> **MARCAJ REVIZUIRE JURIDICĂ** — Schema reflectă structura reală de date (`schema.prisma`). **Atenție:** în cod **nu există** mecanisme automate de ștergere/TTL pentru majoritatea categoriilor; duratele propuse mai jos sunt **recomandări** ce necesită decizie juridică și implementare tehnică.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Principiu

Conform art. 5(1)(e) GDPR (limitarea stocării), datele se păstrează doar pe durata necesară scopului sau cât impun obligațiile legale.

## B. Tabel de retenție

| Categorie de date (model) | Durată propusă | Temei | Stare tehnică actuală |
|---|---|---|---|
| Cont utilizator (`User`) | Pe durata contului + 30 zile după închidere | Contract | 「⚖️ fără job de ștergere」 |
| Companie/abonament (`Tenant`, `Subscription`) | Pe durata relației + termen fiscal (ex. 5–10 ani pentru documente contabile) | Obligație legală fiscală | Persistă nedefinit |
| Token refresh (`RefreshToken`) | Până la expirare/revocare (`JWT_REFRESH_TTL` = 14 zile) | Securitate | ✅ expiră prin `expiresAt`; **fără purjare** a rândurilor revocate |
| Token resetare parolă (`PasswordResetToken`) | Scurt (TTL configurat) + invalidare la folosire | Securitate | ✅ single-use; **fără purjare** |
| Jurnale de audit (`AuditLog`, incl. IP) | **Recomandat 6–12 luni** (proporționalitate) | Interes legitim/securitate | ❌ **fără TTL — persistă nedefinit** |
| Abonamente push (`PushSubscription`) | Până la dezabonare | Consimțământ | ✅ ștergere la 404/410; **fără purjare a celor inactive** |
| Documente clienți (`Document`, `VehicleDocument` + R2) | Stabilită de **client-operator** | Contract de prelucrare | Ștergere la cerere; fără retenție automată |
| Date factură/vehicul (`Invoice`, `Vehicle`, `InvoiceItem`) | Conform deciziei clientului + obligații fiscale ale acestuia | Operatorul = clientul | Cascadă la ștergerea tenantului |
| Scanări vehicul (`VehicleScan`, draft AI) | **Recomandat: ștergere staging după confirmare** | Minimizare | ❌ fără purjare automată identificată |
| Verificări vehicul (`VehicleVerification`) | Până la reverificare | Funcțional | Suprascris la recheck |
| Benchmark (`FleetBenchmark`) | Recalculat săptămânal (înlocuire integrală) | Anonimizat | ✅ tranzacție delete+create |
| Acces suport (`SupportAccess`) | 1h / 24h / 7 zile (expirare) | Securitate | Expiră prin `expiresAt` |

## C. Ștergerea la cascadă

Schema definește `onDelete: Cascade` de la `Tenant` către majoritatea modelelor de business. La ștergerea unei companii, datele asociate sunt eliminate în cascadă. 「⚖️ DE REVIZUIT — a se confirma că ștergerea include și obiectele din Cloudflare R2 (storage), nu doar rândurile din DB.」

## D. Dreptul la ștergere (art. 17)

「⚖️ DE REVIZUIT — în cod **nu a fost identificat** un endpoint dedicat de „ștergere cont / dreptul de a fi uitat" pentru persoana vizată. A se implementa o procedură (manuală sau automată) și a se documenta termenul de 30 de zile.」

---

## Ipoteze și limitări

1. Duratele sunt recomandări de aliniat la obligațiile fiscale/contabile românești și la deciziile clienților-operatori.
2. Lipsa job-urilor de purjare este o constatare tehnică reală (vezi `99_Audit_Tehnic_Conformitate.md`).
3. Pentru date în calitate de împuternicit, retenția este dictată de client prin DPA.

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
