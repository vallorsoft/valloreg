# Audit findings (fejlesztés-lezárás)

> Mélységi kód-audit (backend, frontend, build/deploy) eredménye a fejlesztés
> lezárásakor. A **Javítva** szekció ebben az iterációban elkészült; a **Nyitott
> backlog** prioritás szerint rendezett, későbbi munkára.

## Javítva (ebben az iterációban)

### Build / CI / konfiguráció
- **TS build-törés (P0):** a `^5.7.2` pin a TypeScript **5.9.3**-at húzta be, ahol a
  `moduleResolution: "Node"` (node10) hard error (TS5107) → `pnpm build`/`typecheck`
  és a Render deploy is elbukott. Javítva: `packages/shared` és `apps/api` tsconfig
  `module/moduleResolution: "Node16"`. (Biztonságos: sehol nincs `"type":"module"`,
  így minden fájl CommonJS-módú, az extension nélküli relatív importok érvényesek.)
- **CI workflow:** új `.github/workflows/ci.yml` – install → shared build → typecheck →
  build → lint, minden push/PR-en. (Ez fogta volna meg a fenti TS-törést.)
- **Web typecheck törés:** a `tsc --noEmit` elbukott a `globals.css` side-effect
  importon (TS2882), mert a `next-env.d.ts`-t csak a `next build` generálja. Javítva:
  `apps/web/src/css.d.ts` ambient `declare module '*.css'`.
- **Friss-klón `pnpm dev` race:** a root `dev` script most előbb buildeli a
  `@valloreg/shared`-et (a `dist` gitignored, különben az api/web nem oldja fel).
- **render.yaml:** OCR/EXTRACTION provider `stub` → `gemini` (a `GEMINI_API_KEY`
  továbbra is `sync:false`, kulcs nélkül stubra esik vissza).

### Biztonság / backend
- **Push leiratkozás IDOR (HIGH):** `POST /notifications/unsubscribe` bárki endpointját
  törölte (csak `endpoint` szűrő). Javítva: a törlés a bejelentkezett `userId`-re
  szűkítve (`notifications.service.ts` + controller).
- **Jogosultság-eszkaláció (HIGH):** ADMIN OWNER-ré tehetett bárkit (magát is), és
  meghívhatott/módosíthatott/törölhetett magasabb rangú tagot. Javítva: rang-alapú
  ellenőrzés (`TENANT_ROLE_RANK`) az `invite` / `changeMemberRole` / `removeMember`
  metódusokban – OWNER-t csak OWNER kezelhet, és nem adható a sajátnál magasabb rang.
- **Kimenő HTTP timeout hiánya (HIGH):** a Gemini OCR/extraction (4 provider) és a
  mailer `fetch` hívásaihoz `AbortSignal.timeout` (30s / 10s), hogy egy lassú upstream
  ne blokkolja a queue/scheduler konkurenciát.
- **Gemini API-kulcs a query-stringben (MED):** `?key=...` → `x-goog-api-key` header
  (nem szivárog access/proxy logba).
- **Mailer PII-logolás (MED):** kulcs nélküli (dev/CI) ágon a teljes levéltörzset
  (jelszó-reset tokent) logolta. Javítva: csak címzett + tárgy.

## Nyitott backlog (prioritás szerint)

### Backend – biztonság / megbízhatóság
- **MED – Több-instance scheduler duplikáció:** a reminder / report / verification /
  benchmark BullMQ worker minden instance-on lefut, elosztott lock nélkül → duplikált
  e-mail/push több instance esetén. Render free (1 instance) mellett nem akut. Javaslat:
  Redis-alapú leader-lock vagy dedikált worker-process.
- **MED – FAILED/QUEUED dokumentum újra-sorolás no-op:** stabil `jobId` miatt a BullMQ
  `add` no-op, így a recovery nem fut újra. Javaslat: `queue.remove(jobId)` az újra-add
  előtt (a DB terminál-státusz továbbra is őrzi az idempotenciát).
- **MED – SSRF az operátor-konfigurált külső URL-eknél:** `RO_VERIFY_API_URL` /
  `RECALL_API_URL` séma/host-allowlist nélkül. Javaslat: boot-időben https-only +
  privát/link-local IP tiltás.
- **MED – Külső JSON validáció nélkül:** `ro-verification` / `external-recall` válasz
  cast-olva, dátum egyenesen `new Date()`-be. Javaslat: zod-validáció (mint a Gemini
  providereknél).
- **MED – Refresh-token reuse nem detektált:** visszavont token replaykor nincs
  token-family revoke. Javaslat: kompromittáltság-kezelés (összes aktív token revoke).
- **MED – User-enumeration timing:** a login/forgot-password ág futásideje elárulja, hogy
  létezik-e az email. Javaslat: dummy argon2 verify + aszinkron mail-dispatch.
- **LOW – Meghívó-token plaintext** tárolás (a reset/refresh hashelt). Javaslat: sha256.
- **LOW – Beragadt scan/`vehicle-scan.processor`** recovery + idempotens audit-írás.
- **LOW – `OCR_PROVIDER=mistral|google`** csendben stubra esik (csak `gemini` van bekötve).
  Javaslat: enum szűkítés vagy hangos warn.

### Frontend
- **MED – Token refresh / 401 kezelés hiánya** (`lib/api.ts`): a refresh token tárolva,
  de soha nem használt; access-token lejártakor a munkamenet némán megszakad. Javaslat:
  401-en egyszeri refresh + retry, kudarc esetén `clearTokens()` + redirect.
- **LOW – Modal hibaüzenetek i18n-bypass:** több modal a backend nyers `err.message`-ét
  mutatja (auth űrlapok már `resolveErrorKey`-t használnak). Javaslat: `errors.*` kulcs-map.
- **LOW – PWA manifest `start_url: "/"`** mindig redirektel (`localePrefix: 'always'`);
  notification ikon SVG (egyes platformok PNG-t várnak).

### Build / minőség
- **MED – `lint`/`test` repo-szerte no-op:** csak a `typecheck`+`build` valódi kapu.
  Javaslat: ESLint (Nest/Next) + smoke tesztek bekötése.
- **LOW – Prettier drift:** a repó nincs teljesen formázva (`format:check` ~159 fájlon
  bukik), ezért NEM CI-kapu. Egyszeri `pnpm format` után bekapcsolható.
- **LOW – `.env.example` hiányos** néhány (alapértelmezett) env-kulcsra a schema/render-hez
  képest; `@types/node` eltérés (api `^22` vs web `^20`); TS/Prisma verzió-pin float.
