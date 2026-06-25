# CLAUDE.md – Valloreg

Fuvarozói / flottakezelő SaaS (OCR + AI szervizszámla-feldolgozás).
Monorepo: `apps/api` (NestJS), `apps/web` (Next.js PWA), `packages/shared`.

> Áttekintés: [README.md](./README.md) · ütemterv: [ROADMAP.md](./ROADMAP.md) ·
> architektúra/biztonság: [docs/](./docs/).

## Fejlesztési alapok

- Node 20+, pnpm 10+. `pnpm dev` (API+web), `pnpm typecheck`, `pnpm build`.
- Multi-tenant: minden üzleti rekord `tenantId`; a Prisma tenant-scope kiterjesztés
  fail-closed. Auth: JWT (access+refresh) + RBAC; jelszó Argon2.
- **Deploy:** a Render az alapértelmezett (default) branchből deployol – jelenleg
  `claude/serene-ptolemy-3dd850`. Az API és a web KÜLÖN szolgáltatásként buildel.
  A Prisma kliens a Render buildben generálódik (helyben a letöltése blokkolt lehet).

---

## GDPR / Compliance – ÁLLAPOT és TEENDŐK

> Ez a szakasz a jogi/megfelelőségi csomag aktuális állapotát és a hátralévő
> feladatokat tartja egy helyen. **Minden jogi szöveg ügyvédi felülvizsgálatot
> igényel élesítés előtt** – a szövegekben `[DE COMPLETAT]` / `[DE VERIFICAT
> JURIDIC]` jelölések mutatják, mi dől el az ügyvéden vagy belső adaton.

### Hol található
- **Publikus jogi oldalak (RO):** a landing footerből és a fejléc „Legal" linkből →
  `/[locale]/legal` (hub) + `/[locale]/legal/[slug]`. Forrás: `apps/web/src/lib/legal/`
  (`content/public.ts`, `gdpr.ts`, `security.ts`, `ai.ts`, `hr.ts`; cégadatok: `company.ts`).
- **Consent banner:** `apps/web/src/components/legal/ConsentBanner.tsx` (a layoutból).
- **Belső elemzés – mi kötelező publikus vs. belső:** `docs/legal/CE_TREBUIE_PUBLIC_PE_LANDING.md`.

### Kész (kód)
- DSR self-service: `apps/api/src/dsr/` + UI `/account` (export JSON, fiók- és cégtörlés, S3-takarítás).
- Automatikus retenció: `apps/api/src/data-retention/` (napi BullMQ job; env-konfigurálható megőrzési idők).
- 2FA (TOTP, `apps/api/src/auth/totp.service.ts`) + login 2. lépés + `/account` ki/bekapcsolás.
- Consent → push: a push csak marketing-hozzájárulással indul (`apps/web/src/lib/consent.ts`).
- 23 jogi dokumentum románul a weben; consent banner (ePrivacy).

### TEENDŐ – ÜGYVÉD / CÉG (offline, nem kódfeladat)
- [ ] A 23 dokumentum **végső jogi felülvizsgálata** és jóváhagyása.
- [ ] **DPA-k (art. 28)** aláírása minden subprocesszorral; pontos jogi entitás,
      tárolási régió (kül. **Cloudflare R2**) és transzfer-eszköz (SCC / EU-US DPF) ellenőrzése.
- [ ] **DPO** szükségességének eldöntése.
- [ ] **Termeni** B2B kiegészítés (ár, felmondás, IP, irányadó jog). A felelősségi
      plafon (utolsó 12 hó díja) opozabilitásának megerősítése.
- [ ] **Incidens/breach sablonok** (ANSPDCP + érintettek) + belső incidens-nyilvántartás.
- [ ] **RPO/RTO** definíció + backup-visszaállítás teszt; **BIA** a BCP-hez.
- [ ] Sebezhetőség-jelentési **SLA** / `security@` csatorna.
- [ ] **Jelszó-szabályzat, NDA, onboarding/offboarding** checklist véglegesítése.
- [ ] **EU AI Act** végső besorolás megerősítése.

### TEENDŐ – KÓD (nyitott)
- [ ] 2FA **kötelezővé tétele** a privilegizált szerepekre (OWNER/ADMIN).
- [ ] Függőségi **sebezhetőség-kezelési** folyamat (audit/CI).
- [ ] Automatikus **cross-tenant izolációs tesztek**.
- [ ] Üzleti **dokumentum-retenció** döntése (jelenleg csak kézi/cégtörléses; szándékosan
      nincs auto-törlés, hogy ne vesszen el a szerviztörténet) – ha kell, konfigurálható politika.
- [ ] Audit log megőrzési idő (alap 365 nap) **jogi validálása**.

### Biztonsági megjegyzés (történeti)
- Egy korábban a `.env.example`-be commitolt Neon DB-jelszó **leforgatva** és eltávolítva
  az aktív branchekből (main/serene/gdpr). Maradék régi `claude/*` branchek törlése a
  felhasználóra vár (a környezet a branch-törlést tiltja). A jelszó már nem él.
