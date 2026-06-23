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
