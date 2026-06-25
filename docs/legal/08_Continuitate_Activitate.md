# 8. Plan de Continuitate a Activității (Business Continuity Plan)

> **MARCAJ REVIZUIRE JURIDICĂ** — Plan de continuitate bazat pe arhitectura reală. Prioritizarea serviciilor și SLA-urile interne trebuie aprobate de management.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Scop

Asigurarea continuității serviciilor critice Valloreg în caz de întrerupere majoră și restaurarea prioritară a funcțiilor esențiale.

## B. Servicii și prioritizare

| Prioritate | Serviciu | Componente | Impact dacă indisponibil |
|---|---|---|---|
| **P1 – Critic** | Autentificare + API de bază | `valloreg-api`, Neon DB | Utilizatorii nu pot accesa platforma |
| **P1 – Critic** | Acces la documente | Cloudflare R2 | Documentele nu pot fi descărcate |
| **P2 – Important** | Procesare asincronă (OCR/scan) | Redis/BullMQ, workeri | Întârzieri la extragere; **degradare grațioasă** |
| **P3 – Auxiliar** | Notificări push, e-mail | web-push, Brevo | Funcționează fără; degradare grațioasă (Brevo: log dacă lipsește cheia) |
| **P3 – Auxiliar** | Verificare RO, benchmark, recall | provideri externi/`stub` | Implicit `stub`; fără impact pe funcțiile de bază |

## C. Reziliență prin design (verificată în cod)

- **Degradare grațioasă:** dacă `BREVO_API_KEY` lipsește → e-mailurile sunt **logate**, nu blochează; AI/verificare RO pe `stub` → funcționare fără provideri externi; push dezactivat dacă VAPID lipsește.
- **Migrații ne-fatale la pornire:** un eșec de migrație **nu** oprește pornirea API-ului (`render.yaml`), evitând „brick" la deploy.
- **Health check:** `/api/health` pentru monitorizare și auto-recovery Render.
- **Oprire curată:** `enableShutdownHooks`.

## D. Scenarii și răspuns

| Scenariu | Răspuns |
|---|---|
| Cădere DB (Neon) | Restaurare conform `07`; comutare endpoint |
| Cădere găzduire (Render regiune Frankfurt) | Redeploy; 「⚖️ evaluarea unei strategii multi-regiune/furnizor」 |
| Indisponibilitate provider AI | Comutare pe `stub`; procesare manuală |
| Pierdere secrete | Rotație (vezi `04`) |

## E. Comunicare

Notificarea clienților afectați conform contractelor de servicii. 「⚖️ DE REVIZUIT — canal și termene de comunicare către clienți.」

## F. Limitări cunoscute

- Planurile `free` Render au resurse limitate (posibil „cold start") — relevant pentru RTO.
- Arhitectură mono-regiune (Frankfurt); fără failover geografic automat identificat.

---

## Ipoteze și limitări

1. Prioritizarea serviciilor reflectă dependențele tehnice; clasificarea de business trebuie validată.
2. Continuitatea depinde de SLA-urile furnizorilor (Render, Neon, Cloudflare).

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
