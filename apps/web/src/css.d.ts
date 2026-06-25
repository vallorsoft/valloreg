// CSS side-effect importok (pl. `import '../globals.css'`) ambient deklarációja.
// E nélkül a nyers `tsc --noEmit` typecheck (CI) elbukik (TS2882), mert a
// next-env.d.ts-t csak a `next build`/`next dev` generálja le – a typecheck
// viszont előbb fut. Külön, modul-import nélküli (script) .d.ts kell hozzá,
// hogy a `declare module` globális ambient legyen.
declare module '*.css';
