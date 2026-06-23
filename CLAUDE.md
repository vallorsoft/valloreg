# Valloreg – projekt-konvenciók

## Deploy / Git workflow

- **A Render a `main` ágról deployol** (Blueprintből létrehozott `valloreg-api` +
  `valloreg-web` szolgáltatások; a Blueprint a `main` ághoz van kötve).
- **Minden PR a `main`-re megy, és oda kell merge-elni.** Fejlesztés feature
  ágon → PR a `main` ellen → squash/merge a `main`-be → a Render onnan deployol.
- A korábbi integrációs ágak (`claude/serene-ptolemy-3dd850` stb.) már nem a
  deploy-forrás; mindig a `main` a kanonikus ág.
