# Valloreg – projekt-konvenciók

## Deploy / Git workflow

- **A Render a `main` ágról deployol** (Blueprintből létrehozott `valloreg-api` +
  `valloreg-web` szolgáltatások; a Blueprint a `main` ághoz van kötve).
- **Minden PR a `main`-re megy, és oda kell merge-elni.** Fejlesztés feature
  ágon → PR a `main` ellen → squash/merge a `main`-be → a Render onnan deployol.
- A korábbi integrációs ágak (`claude/serene-ptolemy-3dd850` stb.) már nem a
  deploy-forrás; mindig a `main` a kanonikus ág.
- **Minden squash-merge commit a PR-számmal KEZDŐDJÖN** a `main`-en, hogy könnyen
  visszakövethető legyen, pl. `#30 fix(gemini): …`. Gyakorlatban: a PR létrehozása
  után a kapott `#NN`-nel kezdődjön a merge commit címe (a squash-merge
  `commit_title`-jét eszerint kell beállítani). Így a `git log` minden sora egy
  konkrét PR-hez vezet.

## AI / Gemini (INGYENES szint)

- **Ingyenes Gemini API-t használunk** (Google AI Studio kulcs, `GEMINI_API_KEY`),
  **mind a dokumentum/számla-, mind a jármű-beolvasásnál** (OCR + extraction).
- **Csak ingyenes szinten elérhető modelleket** szabad a láncba tenni. Aktuális
  alaplánc (app-config `gemini.models`): `gemini-2.0-flash`, `gemini-2.0-flash-lite`,
  `gemini-2.5-flash`, `gemini-2.5-flash-lite`. Mindegyiknek **külön napi ingyenes
  kerete** van.
- **NE használj `gemini-1.5-*` modellt** – a Google kivezette a v1beta
  `generateContent`-ből (404).
- A providerek `404/429/500/503` esetén a **következő modellre váltanak**
  (kvóta-kimerülés vagy kivezetett modell ne bukatja el a feldolgozást).
- A providert a `render.yaml` `value: gemini`-vel kényszeríti (OCR + EXTRACTION) –
  **ne állítsd vissza `stub`-ra**, mert a Blueprint-sync felülírná a dashboardot.

## Web + API topológia (domének)

- **Két külön Render-szolgáltatás, KÜLÖN aldomainen:**
  - `valloreg-api` → `https://valloreg-api.onrender.com` (NestJS, prefix `/api`),
  - `valloreg-web` → `https://valloreg-web.onrender.com` (Next.js PWA).
- A web az API-t a `NEXT_PUBLIC_API_URL=https://valloreg-api.onrender.com/api`
  címen éri el; az API a `CORS_ORIGINS`/`WEB_APP_URL`-ben a web origint engedi,
  `credentials: true`-val.
- **FONTOS: a két aldomain CROSS-SITE egymáshoz képest.** Az `onrender.com` rajta
  van a Public Suffix List-en, így `valloreg-web.onrender.com` és
  `valloreg-api.onrender.com` KÜLÖN „site" – nem csak külön origin. Ez minden
  cookie-/CORS-/credentials-kérdést befolyásol.

## Auth / session – gondok és buktatók

- **Token-modell:** rövid életű access token (15 perc) a kliensben
  (`localStorage` ha „Remember me", különben `sessionStorage`), az `Authorization`
  fejléchez. A refresh token **httpOnly cookie**-ban (`valloreg_rt`,
  `Path=/api/auth`), JS-ből NEM elérhető. A kliens 401-re csendben frissít
  (single-flight), a refresh `credentials: 'include'`-dal megy.
- **„Remember me":** bepipálva tartós cookie (90 nap, gördülő) + `localStorage`;
  kipipálatlanul session cookie + `sessionStorage`. A `remember` a refresh token
  payloadjában utazik, hogy a rotációknál is megőrződjön.
- **⚠️ Cross-site cookie (a fő buktató):** mivel web és api külön „site", a refresh
  cookie csak `SameSite=None; Secure` attribútumokkal megy át. Ezt
  `NODE_ENV=production` esetén állítjuk be (dev: `Lax`, Secure nélkül, mert
  localhost azonos site). **Ha a cookie-folyamat elromlik, ELŐSZÖR ezt nézd:**
  - `NODE_ENV=production` legyen az API-n (különben `Lax`/nem-Secure → a böngésző
    nem küldi cross-site),
  - `CORS_ORIGINS` PONTOS web origin (nem `*`), `credentials: true` mellett,
  - a kliens auth-hívásai `credentials: 'include'`-dal menjenek.
- **⚠️ Harmadik-fél-cookie korlátozás:** mivel a cookie a web oldaláról nézve
  „third-party" (másik site), a böngészők szigorodó harmadik-fél-cookie szabályai
  (Safari ITP, Chrome) blokkolhatják. Jelenleg működik, de **a végleges, robusztus
  megoldás: a web és az api KÖZÖS domain alá** (pl. `app.valloreg.com` +
  `app.valloreg.com/api`, vagy `api.valloreg.com` ugyanazon regisztrált domainen),
  ekkor a cookie first-party `SameSite=Lax` lehet. Saját domain bevezetésekor ezt
  érdemes egyből így tervezni.
- **Hideg indítás (Render free):** az API ~15 perc tétlenség után leáll; az első
  kérés 502/503/504 vagy „Failed to fetch" lehet ~30–60 mp-ig. A web api-kliense
  ezt backoff-fal újrapróbálja (lásd `apps/web/src/lib/api.ts`), és egy
  keep-alive GitHub Action pingeli az API health-et.

