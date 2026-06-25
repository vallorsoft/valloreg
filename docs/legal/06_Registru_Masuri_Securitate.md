# 6. Registrul Măsurilor de Securitate (Technical & Organizational Measures)

> **MARCAJ REVIZUIRE JURIDICĂ** — Registru al măsurilor tehnice și organizatorice (art. 32 GDPR), bazat strict pe implementarea reală. Măsurile marcate „documentat dar neimplementat" sunt constatări reale (vezi audit `99`).

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Măsuri tehnice IMPLEMENTATE (verificate în cod)

| # | Măsură | Implementare (sursă) |
|---|---|---|
| M1 | Hashing parole | **Argon2** (`argon2.hash`/`verify` în `auth.service.ts`) |
| M2 | Token-uri JWT cu rotație | Access (900s) + Refresh (14 zile); refresh **rotit** și stocat doar ca hash SHA-256; revocare la logout/reset |
| M3 | Token-uri de resetare parolă | Stocate ca hash, single-use, expirare; revocarea tuturor sesiunilor la reset |
| M4 | Izolare multi-tenant | Extensie Prisma fail-closed; `tenantId` pe toate modelele de business; eroare dacă lipsește contextul |
| M5 | RBAC | Roluri `OWNER/FLEET_MANAGER/ADMIN/ACCOUNTANT/VIEWER` + platform `SUPER_ADMIN`; guards + `@Roles()` |
| M6 | TLS în tranzit | HTTPS (Render), `sslmode=require` (Neon) |
| M7 | Antete de securitate | `helmet()` global (`main.ts`) |
| M8 | CORS restricționat | Origini din `CORS_ORIGINS` (`enableCors`) |
| M9 | Validare input | `ValidationPipe` global (whitelist + transform), class-validator pe DTO-uri |
| M10 | Stocare obiecte izolată | Chei per-tenant `tenants/{id}/...`, URL presemnat **15 min**, validare MIME (PDF/JPG/PNG) + max 25 MB |
| M11 | Jurnalizare de audit | `AuditLog` (cine/ce/unde/când/IP) + interceptor pe mutații |
| M12 | Acces suport temporar | `SupportAccess` cu expirare (1h/24h/7z) și status |
| M13 | Separarea privilegiilor platformă | `SUPER_ADMIN` **nu** vede conținut de business implicit (doc. `SECURITY.md`) |
| M14 | Criptare chei de integrare | `INTEGRATION_ENC_KEY` (32 bytes) pentru secrete de integrare |
| M15 | Anonimizare benchmark | k-anonimitate 5 firme/20 vehicule, fără identificatori |
| M16 | Gestionarea secretelor | Variabile de mediu Render (`sync:false`/`generateValue`), nu în cod |
| M17 | Oprire curată | `enableShutdownHooks` (Prisma/BullMQ) |

## B. Măsuri organizatorice

| # | Măsură | Stare |
|---|---|---|
| O1 | Politici de acces (need-to-know) | Vezi `15` |
| O2 | Revizuire periodică a accesului | Vezi `16` 「⚖️ de operaționalizat」 |
| O3 | Onboarding/offboarding | Vezi `19` |
| O4 | Confidențialitatea angajaților | Vezi `18` |
| O5 | Răspuns la incidente | Vezi `04`/`05` |

## C. Măsuri DOCUMENTATE dar NEIMPLEMENTATE (constatări — a se remedia)

| # | Măsură | Stare reală |
|---|---|---|
| G1 | **Rate limiting** | `SECURITY.md` îl menționează; **nu există** cod (Throttler/middleware) — vezi audit `99` |
| G2 | **2FA / autentificare în doi pași** | Câmp `User.twoFactorSecret` în schemă, dar **fără logică** de verificare |
| G3 | **Criptare la nivel de aplicație în repaus** | Nu este configurată explicit (SSE la R2 nedefinit în cod); se bazează pe setările implicite ale furnizorului |
| G4 | **Retenție/purjare automată** | Fără TTL pentru `AuditLog`, abonamente push inactive etc. |
| G5 | **Endpoint de ștergere (art. 17)** | Neidentificat în cod |

## D. Evaluare

Măsurile implementate (M1–M17) oferă o bază solidă de securitate. Lacunele G1–G5 trebuie tratate prioritar înainte de producție și sunt detaliate în `99_Audit_Tehnic_Conformitate.md`.

---

## Ipoteze și limitări

1. Eficacitatea M6/M10 privind criptarea în repaus depinde de configurarea furnizorilor (Neon, R2).
2. Registrul reflectă codul la 2026-06-25; orice cod nou trebuie reflectat aici.

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
