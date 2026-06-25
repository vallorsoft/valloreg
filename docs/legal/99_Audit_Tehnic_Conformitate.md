# 99. Audit Tehnic de Conformitate — Constatări și Remedieri

> **DOCUMENT INTERN — NU se publică.** Raport de neconformități tehnice identificate prin analiza codului, destinat remedierii interne și informării avocatului. Sursele sunt citate cu `fișier:linie`.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## Rezumat al severităților

| Sev. | Nr. | Constatări |
|---|---|---|
| 🔴 Critic | 1 | F1 |
| 🟠 Ridicat | 3 | F2, F3, F4 |
| 🟡 Mediu | 4 | F5, F6, F7, F8 |
| 🔵 Informativ | 2 | F9, F10 |

---

## 🔴 F1 — Credențiale reale de bază de date expuse în repository

- **Evidență:** `.env.example:23-24` conține un string de conexiune Neon cu utilizator și parolă reale (`neondb_owner:npg_...@ep-gentle-mode-...neon.tech`). Fișierul este **urmărit intenționat** de git (`.gitignore:19` → `!.env.example`) și prezent în istoric.
- **Impact:** Oricine are acces la repo (sau la istoric) poate obține acces direct la baza de date de producție → compromitere totală a datelor personale.
- **Remediere (obligatorie):**
  1. **Rotația imediată** a credențialelor Neon (parolă/endpoint) — credențialul trebuie considerat compromis (este în istoricul git).
  2. Înlocuirea valorilor reale cu **placeholder-e** în `.env.example`.
  3. Opțional: curățarea istoricului git (filter-repo/BFG) — necesită forțarea rescrierii istoricului.
- **Status fix pregătit:** redactare `.env.example` pregătită local (a se vedea modificările din working tree). **Rotația rămâne obligatorie și nu poate fi făcută din cod.**

## 🟠 F2 — Rate limiting documentat dar neimplementat

- **Evidență:** `docs/SECURITY.md:54` afirmă „Rate limiting și input-validáció … minden végponton"; **niciun** cod de throttling nu există (fără `@nestjs/throttler`, fără middleware de rate limit în `main.ts` sau guards).
- **Impact:** Endpoint-urile de autentificare (`/auth/login`, `/auth/forgot-password`) sunt expuse la brute-force / enumerare.
- **Remediere:** Implementarea `@nestjs/throttler` (sau echivalent) cel puțin pe rutele de autentificare; aliniere a documentației la realitate.

## 🟠 F3 — 2FA prezent în schemă, neimplementat

- **Evidență:** `schema.prisma:123` `twoFactorSecret String?`; `SECURITY.md:18` menționează „2FA (Fázis 4)". Nicio logică de generare/verificare TOTP în cod (fără `otplib`/`speakeasy`, fără verificare la login în `auth.service.ts`).
- **Impact:** Așteptare de securitate nesatisfăcută; rolurile privilegiate nu pot folosi 2FA.
- **Remediere:** Implementarea efectivă a 2FA sau marcarea clară ca „roadmap" și eliminarea pretenției din documentație.

## 🟠 F4 — Lipsa criptării la nivel de aplicație în repaus

- **Evidență:** `storage.service.ts` — `PutObjectCommand` **fără** `ServerSideEncryption`/`SSEKMSKeyId`. Criptarea în repaus depinde de setările implicite ale Cloudflare R2 / Neon, neconfirmate în cod.
- **Impact:** Documente cu posibile date personale; criptarea în repaus nu este controlată/atestată de aplicație.
- **Remediere:** Activarea/atestarea SSE la R2; confirmarea criptării în repaus la Neon; documentarea în `06`.

## 🟡 F5 — Fără retenție/purjare automată (audit, push, scanări)

- **Evidență:** Niciun job de TTL/cleanup pentru `AuditLog` (stochează **IP**, `audit.service.ts`), `RefreshToken`/`PasswordResetToken` revocate, `PushSubscription` inactive, `VehicleScan` staging.
- **Impact:** Încălcarea principiului limitării stocării (art. 5(1)(e)); acumulare de date (inclusiv IP).
- **Remediere:** Job-uri programate de purjare conform `17_Schema_Retentie_Date.md`.

## 🟡 F6 — Lipsa unui mecanism de ștergere (dreptul de a fi uitat)

- **Evidență:** Nu a fost identificat un endpoint de ștergere a contului/datelor persoanei vizate (art. 17). Există cascadă la ștergerea `Tenant`, dar fără flux DSAR de ștergere și fără ștergere atestată în R2.
- **Impact:** Dificultatea onorării cererilor art. 17 în 30 de zile.
- **Remediere:** Implementarea unui flux de ștergere (DB + obiecte R2) + procedură (`14`).

## 🟡 F7 — `SupportAccess` modelat dar fără API

- **Evidență:** Modelul `SupportAccess` există (`schema.prisma:409`) și e referit în `prisma.service.ts` (scope), dar **nu** există controller/service care să acorde/revoce/expire accesul. `SECURITY.md` îl descrie ca funcție activă.
- **Impact:** Funcția de „acces suport temporar, jurnalizat" descrisă în documentație nu este operațională.
- **Remediere:** Implementarea endpoint-urilor (acordare cu durată 1h/24h/7z, expirare efectivă, audit) sau ajustarea documentației.

## 🟡 F8 — Transfer de date către SUA la activarea AI

- **Evidență:** `gemini-extraction.provider.ts` apelează `generativelanguage.googleapis.com` fără regiune (rutare SUA). Implicit dezactivat (`render.yaml`: `EXTRACTION_PROVIDER=stub`).
- **Impact:** La activare, transfer de date personale (din documente) către SUA — necesită SCC + măsuri (vezi `03_TIA.md`).
- **Remediere:** Încadrare contractuală (SCC Google, interdicție antrenare), minimizare, eventual endpoint UE (Vertex AI), informarea clientului-operator.

## 🔵 F9 — `BENCHMARK_MIN_*` și opt-in — bune practici confirmate

- **Evidență:** k-anonimitate (5 firme / 20 vehicule), fără `tenantId` în `FleetBenchmark`, opt-out `benchmarkOptIn`. **Conform** — fără acțiune; de menținut.

## 🔵 F10 — Degradare grațioasă bine proiectată

- **Evidență:** E-mail (Brevo) și push (VAPID) degradează grațios dacă cheile lipsesc; migrații ne-fatale la pornire. **Pozitiv** — de păstrat.

---

## Plan de remediere recomandat (prioritizat)

| Prioritate | Acțiune | Tip |
|---|---|---|
| 1 (acum) | Rotație credențiale Neon + redactare `.env.example` (F1) | Securitate critică |
| 2 | Rate limiting pe auth (F2) | Cod |
| 3 | Confirmare/activare criptare în repaus (F4) | Config |
| 4 | Job-uri de retenție/purjare (F5) | Cod |
| 5 | Flux de ștergere DSAR (F6) | Cod + proces |
| 6 | Decizie 2FA (F3) și SupportAccess (F7) | Roadmap/cod |
| 7 | Încadrare transfer AI înainte de activare (F8) | Juridic |

---

## TOCTOU / Race conditions (verificate în cod și remediate)

Audit de concurență „check-then-act" / time-of-check-to-time-of-use:

| ID | Locație | Problemă | Severitate | Stare |
|---|---|---|---|---|
| TC1 | `auth.service.ts` `refresh` | Double-spend refresh token (revocare necondiționată după check) | 🔴 Critic | ✅ Reparat — `updateMany(revokedAt:null)` + check `count` |
| TC2 | `auth.service.ts` `resetPassword` | Reutilizare token de resetare | 🔴 Critic | ✅ Reparat — consum condiționat în tranzacție |
| TC3 | `auth.service.ts` `register` | P2002 negestionat la email duplicat concurent → 500 | 🟠 Ridicat | ✅ Reparat — catch P2002 → `emailTaken` |
| TC4 | `documents.service.ts` `upload` | P2002 pe `(tenantId,sha256)` la upload concurent → 500 | 🟠 Ridicat | ✅ Reparat — catch P2002 → întoarce existentul |
| TC5 | `users.service.ts` `acceptInvite` | Dublă acceptare invitație → 500 | 🟡 Mediu | ✅ Reparat — `updateMany(acceptedAt:null)` + catch P2002 |
| TC6 | `invoices.service.ts` mapping furnizor-vehicul | P2002 la învățare concurentă | 🟡 Mediu | ✅ Reparat — catch P2002 → increment |
| TC7 | `matching.service.ts` supplier dedup | Furnizori duplicați (lipsă unique constraint) | 🟡 Mediu | ✅ Reparat — migrare cu dedup + `@@unique([tenantId,normalizedName])` + catch P2002 |
| TC8 | `invoices.service.ts` mapping categorie tétel | Mapping-uri duplicate (lipsă unique constraint) | 🔵 Scăzut | ✅ Reparat — migrare cu dedup + `@@unique(...)` + catch P2002 (excepție: supplierId NULL, vezi nota) |

> **Migrarea** `20260625130000_supplier_itemcat_dedup_unique` deduplică datele
> existente (reorientează FK-urile către furnizorul canonic, însumează ponderile
> mapping-urilor de învățare) ÎNAINTE de a adăuga constrângerile unice. Testată pe
> PostgreSQL 16 real: dedup corect + constrângerile resping duplicatele noi.
> **Notă (TC8):** pentru `supplierId NULL`, PostgreSQL tratează NULL-urile ca
> distincte, deci constrângerea unică nu acoperă rândurile fără furnizor; calea
> `findFirst`+increment din service gestionează acel caz (race rezidual rar, ponderi).

---

## Stadiu remediere (actualizat 2026-06-25)

| ID | Stare |
|---|---|
| F1 | ✅ `.env.example` redactat. ⚠️ **Rotația credențialelor Neon rămâne obligatorie** (sunt în istoricul git). |
| F2 | ✅ Reparat — `RateLimitGuard` + `@RateLimit` pe endpoint-urile de auth (login/register/refresh/forgot/reset). |
| F3 | ✅ Documentație corectată (2FA marcat roadmap). Implementarea TOTP rămâne decizie de produs. |
| F4 | ✅ `ServerSideEncryption: 'AES256'` adăugat explicit la upload (R2 oricum criptează implicit). |
| F5 | ✅ Reparat — `CleanupService` + scheduler zilnic (audit/token/scan staging), praguri env. |
| F6 | ✅ Reparat — `DELETE /tenants/current` (OWNER) cu ștergere obiecte R2 (`deleteByPrefix`) + cascadă DB. |
| F7 | ✅ Documentație corectată (SupportAccess marcat „modelat, API neimplementat"). Implementarea rămâne roadmap. |
| F8 | ℹ️ Rămâne decizie juridică/contractuală (transfer AI activat doar la configurare). |

> **Notă de verificare:** în mediul de generare, `prisma generate` și instalarea completă
> a dependențelor nu au putut rula (restricție de rețea la descărcarea engine-urilor Prisma),
> deci typecheck-ul complet al API-ului nu a fost executat aici. Modificările respectă
> pattern-urile existente; a se rula `pnpm --filter @valloreg/api build` într-un mediu cu rețea.

---
*Raport intern de audit tehnic. A se corela cu pachetul de conformitate juridică.*
