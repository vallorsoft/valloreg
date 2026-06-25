# 2. Evaluarea Impactului asupra Protecției Datelor (DPIA)

> **MARCAJ REVIZUIRE JURIDICĂ** — DPIA întocmit conform **art. 35 GDPR** și ghidului WP248, axat pe componentele AI/OCR și pe prelucrarea documentelor. Necesită validare juridică și a DPO.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Necesitatea DPIA

DPIA este oportună pentru: (i) **prelucrarea sistematică prin AI/OCR** a documentelor; (ii) volumul de documente de business care pot conține date personale; (iii) jurnalizarea adreselor IP. Prelucrarea **nu** implică decizii automatizate cu efect juridic (art. 22) — validare umană obligatorie.

## B. Descrierea sistematică a prelucrării

- **Fluxuri:** încărcare document → stocare R2 (chei per-tenant) → (opțional) OCR+AI Gemini → extragere câmpuri → **validare de către utilizator** → persistare structurată.
- **Date:** documente (facturi, certificate de înmatriculare), date de cont, date de flotă, IP de audit, abonamente push.
- **Tehnologii:** NestJS, PostgreSQL (Neon EU), Cloudflare R2, BullMQ/Redis, Google Gemini (opțional), web-push.

## C. Necesitate și proporționalitate

| Aspect | Evaluare |
|---|---|
| Minimizare | Câmpuri extrase limitate la nevoile funcționale; AI implicit `stub` |
| Temei | Contract (cont), interes legitim (audit/securitate), consimțământ (push) |
| Limitarea scopului | Datele de business nu sunt folosite pentru profilare a persoanelor |
| Transparență | Notificare AI (`13`), politici de confidențialitate/cookie publicate |

## D. Evaluarea riscurilor și măsuri

| # | Risc | Probabil. | Impact | Măsuri existente (cod) | Risc rezidual |
|---|---|---|---|---|---|
| R1 | Acces neautorizat cross-tenant | Scăzut | Ridicat | Izolare multi-tenant fail-closed (extensie Prisma), RBAC, JWT | Scăzut |
| R2 | Expunere documente la stocare | Scăzut | Ridicat | Chei per-tenant, URL presemnat 15 min, TLS | Scăzut–Mediu (criptare app-level neconfigurată) |
| R3 | Transfer date la AI (SUA) | Mediu (dacă activat) | Mediu | `stub` implicit, TLS, fără decizii automate | Mediu — vezi TIA |
| R4 | Extragere AI eronată | Mediu | Mediu | Validare umană obligatorie, scor `confidence`, audit | Scăzut |
| R5 | Reidentificare în benchmark | Foarte scăzut | Mediu | k-anonimitate (5 firme/20 vehicule), fără `tenantId`, opt-out | Foarte scăzut |
| R6 | Persistență IP în audit | Mediu | Scăzut–Mediu | — | Mediu (fără retenție/TTL — vezi `17`) |
| R7 | Credențiale expuse în repo | — | Ridicat | — | **Ridicat** (vezi audit `99`) |
| R8 | Lipsă rate limiting / 2FA | Mediu | Mediu | Documentate dar **neimplementate** | Mediu (vezi audit) |

## E. Măsuri de reducere recomandate

1. Stabilirea retenției și purjarea automată a jurnalelor de audit (R6).
2. Activarea criptării la nivel de aplicație / confirmarea SSE la R2 (R2).
3. Remedierea constatărilor din auditul tehnic `99` (R7, R8).
4. Menținerea AI pe `stub` până la încadrarea contractuală a transferului (R3).

## F. Concluzie

Riscul global este **gestionabil** cu măsurile existente plus remedierile recomandate. Riscurile ridicate (R7) și medii (R6, R8) necesită acțiune înainte de producție. 「⚖️ DE REVIZUIT — consultarea ANSPDCP (art. 36) nu pare necesară dacă riscurile reziduale sunt reduse; de confirmat juridic.」

---

## Ipoteze și limitări

1. DPIA presupune validarea umană a rezultatelor AI conform `12_Procedura_Supraveghere_Umana.md`.
2. Evaluarea R2/R3 depinde de configurarea efectivă a furnizorilor (SSE, regiune).
3. Categoriile speciale (art. 9) nu sunt prelucrate intenționat; apariția incidentală în documente trebuie monitorizată.

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
