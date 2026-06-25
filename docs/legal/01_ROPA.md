# 1. Registrul Activităților de Prelucrare (ROPA)

> **MARCAJ REVIZUIRE JURIDICĂ** — Registru întocmit conform **art. 30 GDPR**, pe baza schemei de date reale (`apps/api/prisma/schema.prisma`) și a fluxurilor implementate. Necesită revizuire și aprobare juridică înainte de utilizare oficială.

**Operator:** VALLOR TEAM SRL · CUI 47859317 · vallorsoft@gmail.com
**Responsabil cu protecția datelor (DPO):** 「⚖️ DE REVIZUIT — desemnare DPO neidentificată în cod; de stabilit dacă este obligatorie conform art. 37 GDPR. A se numi o persoană de contact pentru protecția datelor.」
**Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Rolul societății

| Context | Rol GDPR |
|---|---|
| Date de cont, facturare, audit, marketing tehnic | **Operator** (art. 4 pct. 7) |
| Documentele și datele de flotă încărcate de clienții B2B | **Persoană împuternicită** (art. 4 pct. 8) — clientul este operator |

Platforma este un **SaaS B2B** de administrare a flotelor. Pentru conținutul încărcat de clienți (facturi, certificate de înmatriculare, date despre vehicule), clientul rămâne operator, iar Valloreg prelucrează în numele său (a se vedea DPA și `20_Registru_Subimputerniciti.md`).

---

## B. Activități de prelucrare (în calitate de OPERATOR)

### AP-01 — Gestionarea conturilor și autentificarea

| Element | Detaliu (sursă: cod) |
|---|---|
| Scop | Crearea și administrarea conturilor, autentificare, resetare parolă |
| Temei juridic | Art. 6(1)(b) — executarea contractului |
| Categorii de persoane vizate | Utilizatori (angajați ai clienților B2B) |
| Categorii de date | E-mail, nume, parolă stocată ca **hash Argon2** (`User.passwordHash`), `isPlatformAdmin`, token-uri (hash) de refresh și de resetare parolă |
| Destinatari | Brevo (e-mail tranzacțional — resetare parolă) |
| Stocare | PostgreSQL (Neon, regiune Frankfurt EU) |
| Retenție | A se vedea `17_Schema_Retentie_Date.md` |
| Măsuri de securitate | Argon2, JWT cu rotație, token-uri stocate doar ca hash SHA-256, revocare la resetare |

### AP-02 — Administrarea companiilor (tenant) și a abonamentelor

| Element | Detaliu |
|---|---|
| Scop | Gestionarea organizațiilor client, planuri, perioade de trial, facturare prin transfer bancar |
| Temei juridic | Art. 6(1)(b); Art. 6(1)(c) pentru obligații contabile/fiscale |
| Date | `Tenant` (denumire, `taxNumber`/CUI, contact, e-mail, telefon), `Subscription` (plan, status, perioade) |
| Destinatari | — (date interne); notificare facturare către `BILLING_NOTIFY_EMAIL` |
| Stocare | PostgreSQL (Neon, EU) |

### AP-03 — Jurnalizarea de audit (securitate și răspundere)

| Element | Detaliu |
|---|---|
| Scop | Trasabilitatea acțiunilor sensibile, securitate, investigarea incidentelor |
| Temei juridic | Art. 6(1)(f) — interes legitim (securitate); Art. 6(1)(c) (răspundere GDPR) |
| Date | `AuditLog`: `userId`, `tenantId`, `action`, `resourceType`, `resourceId`, `metadata`, **`ip` (adresă IP)**, `createdAt` |
| Particularitate | Se înregistrează **adresa IP** și acțiunile HTTP de mutație (POST/PATCH/PUT/DELETE) |
| Retenție | 「⚖️ DE REVIZUIT — în cod **nu există** politică de ștergere/TTL; datele persistă nedefinit. A se stabili o durată proporțională.」 |

### AP-04 — Notificări push (web push)

| Element | Detaliu |
|---|---|
| Scop | Notificări de reamintire/expirare (ITP, RCA, întreținere) |
| Temei juridic | Art. 6(1)(a) — **consimțământ** (opt-in explicit din browser) |
| Date | `PushSubscription`: `endpoint`, chei `p256dh`/`auth`, `userAgent`, `userId`, `tenantId` |
| Destinatari | Serviciile de push ale browserului (Google FCM, Mozilla, Microsoft) — vezi TIA |
| Tehnologie | VAPID, librăria `web-push` |
| Retenție | Până la dezabonare; ștergere automată la răspuns 404/410 de la serviciul de push |

### AP-05 — Benchmark de flotă anonimizat („Tendințe europene")

| Element | Detaliu |
|---|---|
| Scop | Comparație de costuri de piață, agregată și anonimizată |
| Temei juridic | Art. 6(1)(f) — interes legitim; date **anonimizate** la publicare (în afara sferei GDPR pentru rezultat) |
| Date sursă | `InvoiceItem` (preț, vehicul) ale companiilor cu `benchmarkOptIn=true` |
| Anonimizare | Prag de **k-anonimitate: minim 5 companii ȘI 20 vehicule** per celulă; tabelul `FleetBenchmark` **nu** conține `tenantId` ori identificatori |
| Opt-out | `Tenant.benchmarkOptIn=false` exclude compania din agregat |

### AP-06 — Comunicări comerciale / newsletter

| Element | Detaliu |
|---|---|
| Scop | Comunicări de marketing |
| Temei juridic | Art. 6(1)(a) — consimțământ explicit |
| Stare în cod | 「⚖️ DE REVIZUIT — **nu a fost identificat** un mecanism de newsletter în cod. Dacă nu se folosește, această activitate se elimină; dacă se introduce, necesită flux de consimțământ și dezabonare.」 |

---

## C. Activități de prelucrare (în calitate de PERSOANĂ ÎMPUTERNICITĂ)

### AP-07 — Stocarea și procesarea documentelor clienților

| Element | Detaliu |
|---|---|
| Operator | Clientul B2B |
| Scop | Stocare, clasificare, extragere de date din documente (facturi, certificate de înmatriculare) |
| Categorii de date | Conținut de documente care **poate include date personale ale terților** (nume furnizori, `ownerName` din certificate de înmatriculare, date din facturi) |
| Stocare | Cloudflare R2 (S3-compatibil), chei prefixate pe tenant `tenants/{tenantId}/documents/...`, URL-uri presemnate cu valabilitate **15 minute** |
| Limite | max. 25 MB/fișier; tipuri permise PDF/JPG/PNG |
| Subîmputerniciți | Cloudflare R2 (stocare), Google Gemini (OCR/AI — **doar dacă activat**) |

### AP-08 — Extragerea de date prin AI/OCR (Google Gemini)

| Element | Detaliu |
|---|---|
| Operator | Clientul B2B |
| Stare implicită | **Dezactivat** (`EXTRACTION_PROVIDER=stub`, `OCR_PROVIDER=stub` în `render.yaml`) |
| La activare | Conținut de document (imagine base64 + text OCR) trimis către `generativelanguage.googleapis.com` (Google, **transfer SUA** — vezi TIA) |
| Câmpuri extrase | Tip document, furnizor/dată/număr factură, valută, km, totaluri; date vehicul (`plate`, `vin`, `ownerName` etc.); termene ITP/RCA/rovinietă |
| Decizii automate | **Nu** există decizii cu efect juridic complet automatizate; rezultatul este validat de utilizator (vezi `12_Procedura_Supraveghere_Umana.md`) |

### AP-09 — Verificarea conformității vehiculelor (RO)

| Element | Detaliu |
|---|---|
| Stare implicită | **Stub** (`VEHICLE_VERIFY_PROVIDER=stub`) — date simulate, fără apel extern |
| La activare (`ro`) | `plate` + `vin` + `country=RO` trimise către API extern configurat (`RO_VERIFY_API_URL`) |
| Rezultat | Termene ITP, RCA, rovinietă |

---

## D. Transferuri internaționale

A se vedea `03_TIA.md` și `20_Registru_Subimputerniciti.md`. Pe scurt:
- **UE (Frankfurt):** Neon (PostgreSQL), Render (găzduire), Redis.
- **Transfer extra-UE posibil:** Google Gemini (SUA, doar dacă AI activat), Cloudflare R2 (`region=auto`), serviciile de push ale browserului, Brevo.

---

## Ipoteze și limitări

1. Registrul reflectă codul la data 2026-06-25; activitățile dezactivate (AI, verificare RO, newsletter) sunt marcate ca atare.
2. S-a presupus că persoanele vizate principale sunt angajați ai clienților B2B; datele terților apar incidental în documentele încărcate.
3. Duratele de retenție și desemnarea DPO necesită decizie juridică (marcate 「⚖️ DE REVIZUIT」).
4. Categoriile speciale de date (art. 9) nu au fost identificate ca prelucrate intenționat; pot apărea incidental în documente încărcate — de evaluat.

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
