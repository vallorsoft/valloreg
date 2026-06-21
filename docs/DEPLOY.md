# Deploy – Render + Neon + Cloudflare R2

Ez a leírás végigvezet a Valloreg élesítésén, **kezdőként is**. A `render.yaml`
egy kattintással létrehozza a 3 szolgáltatást egy **új Render projektben**,
teljesen **külön** a meglévő dolgaidtól.

```
Neon (Postgres)        Cloudflare R2 (dokumentumok)
        \                     /
         \                   /
        ┌──────────────────────────────┐
        │  Render Project: Valloreg     │
        │   • valloreg-redis (Key Value)│
        │   • valloreg-api   (NestJS)   │
        │   • valloreg-web   (Next.js)  │
        └──────────────────────────────┘
```

---

## 0. Mire lesz szükséged (gyűjtsd egy jegyzetbe)

| Érték | Honnan | Hova kerül |
| --- | --- | --- |
| `DATABASE_URL` | Neon → **Pooled** connection string (`-pooler`, `?sslmode=require`) | Render env (api) |
| `DIRECT_URL` | Neon → **Direct** connection string (`?sslmode=require`) | Render env (api) |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` | Render env (api) |
| `S3_ACCESS_KEY` | R2 API token → Access Key ID | Render env (api) |
| `S3_SECRET_KEY` | R2 API token → Secret Access Key | Render env (api) |
| `GEMINI_API_KEY` | Google AI Studio (Fázis 2-höz) | Render env (api) – később |
| `BREVO_API_KEY`, `BREVO_SENDER` | Brevo (opcionális) | Render env (api) – később |

> A `JWT_*` és `INTEGRATION_ENC_KEY` titkokat a Render **automatikusan generálja**
> – azokkal nem kell foglalkoznod.

---

## 1. Neon – adatbázis

1. **console.neon.tech** → a `valloreg` projekt → **Connect**.
2. Másold ki a **Pooled** connection stringet → ez a `DATABASE_URL`.
3. Kapcsold ki a pooling-ot (vagy válaszd a **Direct** nézetet) → ez a `DIRECT_URL`.
4. Mindkettő végén legyen `?sslmode=require` (a Neon általában beleteszi).

> A migrációkat a Render a **buildkor** futtatja a `DIRECT_URL`-en (`prisma migrate
> deploy`), az app pedig a `DATABASE_URL` (pooled) -ön fut.

---

## 2. Cloudflare R2 – dokumentumtár

1. **dash.cloudflare.com** → **R2** → *Create bucket*: `valloreg-documents`.
2. Az R2 főoldalon másold ki az **Account ID**-t → `S3_ENDPOINT` =
   `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
3. **Manage R2 API Tokens** → *Create API Token* (**Object Read & Write**) →
   jegyezd fel az **Access Key ID** (`S3_ACCESS_KEY`) és **Secret Access Key**
   (`S3_SECRET_KEY`) értékeket (csak egyszer látszik!).

---

## 3. Render – Blueprint deploy

1. **dashboard.render.com** → bal felül **New +** → **Blueprint**.
2. Válaszd a **`vallorsoft/valloreg`** repót (ha még nincs összekötve: *Connect
   GitHub* és engedélyezd a repóra).
3. A Render beolvassa a `render.yaml`-t, és mutat **3 szolgáltatást**
   (`valloreg-redis`, `valloreg-api`, `valloreg-web`). Add meg a **Project**
   nevet: `Valloreg`.
4. Kattints **Apply** / **Create Resources**.

> A Render most létrehozza a 3 szolgáltatást. A **valloreg-api** első buildje
> el fog akadni, amíg be nem állítod a titkokat (4. lépés) – ez normális.

---

## 4. Titkok beállítása (env vars)

Nyisd meg a **valloreg-api** szolgáltatást → **Environment** fül. A `render.yaml`
már létrehozta a kulcsokat; töltsd ki azokat, amiknél „**Set value**" / üres áll:

**valloreg-api:**

| Key | Érték |
| --- | --- |
| `DATABASE_URL` | Neon **pooled** string |
| `DIRECT_URL` | Neon **direct** string |
| `S3_ENDPOINT` | `https://<ACCOUNT_ID>.r2.cloudflarestorage.com` |
| `S3_ACCESS_KEY` | R2 Access Key ID |
| `S3_SECRET_KEY` | R2 Secret Access Key |
| `GEMINI_API_KEY` | *(opcionális most; Fázis 2)* |
| `BREVO_API_KEY` / `BREVO_SENDER` / `MAIL_FROM` | *(opcionális; meghívókhoz)* |
| `VAPID_*` | *(opcionális; push)* |

A `JWT_*`, `INTEGRATION_ENC_KEY`, `REDIS_URL`, `S3_REGION`, `S3_BUCKET`,
`CORS_ORIGINS` már ki van töltve automatikusan.

**valloreg-web:** általában nem kell hozzányúlni. A `NEXT_PUBLIC_API_URL` alapból
`https://valloreg-api.onrender.com/api`. (Ha a Render más URL-t adott az API-nak –
mert a név foglalt volt –, írd át erre a tényleges URL-re, és a `CORS_ORIGINS`-t
is a tényleges web URL-re az api-nál.)

Mentés után indíts újra deploy-t: **Manual Deploy → Deploy latest commit** (api).

---

## 5. Ellenőrzés

1. **valloreg-api** → Logs: várd meg a `Valloreg API fut a ... porton` sort.
2. Nyisd meg: `https://valloreg-api.onrender.com/api/health` → `{"status":"ok",...}`.
3. Nyisd meg a webet: `https://valloreg-web.onrender.com` → betölt a landing.
4. **Regisztrálj egy céget** a `/register` oldalon → bejutsz a dashboardra.

---

## 6. (Opcionális) Demo adat betöltése

A Render **valloreg-api → Shell** fülön:

```bash
pnpm --filter @valloreg/api prisma:seed
```

Ez létrehoz egy demo céget. Belépés: `demo@valloreg.local` / `Demo1234!`.

---

## 7. Fázis 2: az AI bekapcsolása (később)

Amikor jön az OCR + AI motor:

1. **valloreg-api → Environment**: `EXTRACTION_PROVIDER` = `gemini`, és add meg a
   `GEMINI_API_KEY`-t (a régi projektedből újrahasználható).
2. Deploy. A feldolgozó a modell-láncon megy végig (429-nél vált a következő
   ingyenes modellre).

---

## Hibaelhárítás

- **„keyvalue" típus hiba a blueprintnél** → írd át a `render.yaml`-ban
  `type: keyvalue` → `type: redis`, commitold, és Apply újra.
- **Build out-of-memory (ingyenes csomag)** → válts a `valloreg-api`/`valloreg-web`
  szolgáltatáson `Starter` csomagra (több RAM, mindig elérhető, nincs hidegindítás).
- **CORS hiba a böngészőben** → a `valloreg-api` `CORS_ORIGINS`-ja pontosan a web
  URL legyen (séma + domain, perjel nélkül).
- **Migráció hiba** → ellenőrizd a `DIRECT_URL`-t (a direct, NEM a pooled string),
  és hogy `?sslmode=require` rajta van.
- **Ingyenes csomag „elalszik"** → 15 perc tétlenség után a free szolgáltatás
  leáll; az első kérés lassú (hidegindítás). Productionhöz `Starter`+.

---

## Adatizoláció (emlékeztető)

- A `valloreg` **külön Neon projekt** és **külön Render szolgáltatások** → nem
  keveredik a meglévő dolgaiddal.
- Plusz alkalmazás-szinten minden rekord `tenantId`-vel izolált (multi-tenant).
