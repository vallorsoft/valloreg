# 7. Plan de Backup și Recuperare în caz de Dezastru (Backup & DR)

> **MARCAJ REVIZUIRE JURIDICĂ** — Plan bazat pe arhitectura reală (Neon, Cloudflare R2, Render, Redis). Capacitățile efective de backup depind de configurarea furnizorilor și trebuie **confirmate**.

**Operator:** VALLOR TEAM SRL · **Versiune:** 1.0 · **Data:** 2026-06-25

---

## A. Active și strategia de backup

| Activ | Furnizor | Mecanism de backup | Stare |
|---|---|---|---|
| Bază de date (PostgreSQL) | **Neon** | Backup/point-in-time restore al furnizorului | 「⚖️ de confirmat plan/retenție (planul `free` poate limita PITR)」 |
| Documente (obiecte) | **Cloudflare R2** | Durabilitate furnizor; versionare | 「⚖️ de activat versionarea/replicarea bucket-ului」 |
| Coadă/Redis | **Render Key Value** | `maxmemoryPolicy: noeviction`; date **tranzitorii** (job-uri) | Nu necesită backup (re-creabile) |
| Secrete/config | Render env vars | Gestionate de Render | A se păstra o copie securizată externă |
| Cod sursă | Git/GitHub | Repository | ✅ |

## B. Obiective (de stabilit)

| Indicator | Țintă propusă | Observație |
|---|---|---|
| **RPO** (pierdere max. de date) | ≤ 24h (de confirmat cu Neon) | Depinde de planul de backup |
| **RTO** (timp max. de restaurare) | ≤ 4–8h | Redeploy Render + restore DB |

「⚖️ DE REVIZUIT — RPO/RTO trebuie aliniate la așteptările contractuale față de clienți (vezi `08`).」

## C. Procedura de restaurare

1. Declanșare prin `04_Plan_Raspuns_Incidente.md` (severitate P1/P2).
2. **DB:** restore Neon (PITR/snapshot) către un endpoint nou; actualizare `DATABASE_URL`/`DIRECT_URL`.
3. **Migrații:** la pornire, `prisma migrate deploy` rulează idempotent (vezi `startCommand` în `render.yaml`).
4. **Storage:** restaurare obiecte R2 (din versionare/replicare).
5. **App:** redeploy `valloreg-api` și `valloreg-web` (Render Blueprint).
6. **Validare:** health check `/api/health`, verificări de integritate, test de autentificare.

## D. Testarea recuperării

「⚖️ DE OPERAȚIONALIZAT — testare periodică (recomandat semestrial) a restaurării; consemnarea rezultatelor. În cod nu există dovezi de testare automată a restaurării.」

## E. Considerații GDPR

- Backup-urile conțin date personale → aceleași măsuri de securitate (criptare, acces restricționat).
- Ștergerile (art. 17) trebuie reflectate și în backup-uri conform politicii de retenție a backup-urilor.

---

## Ipoteze și limitări

1. Capacitățile de backup ale Neon/R2 depind de planul comercial; planurile `free` din `render.yaml` pot impune limitări.
2. Redis conține doar date tranzitorii (job-uri BullMQ), considerate ne-critice pentru backup.

---
*Document generat pentru revizuire juridică. Revizuirea profesională finală este obligatorie.*
