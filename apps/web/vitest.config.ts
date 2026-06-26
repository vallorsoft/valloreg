import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * Vitest a webhez (Next.js 15 / React 19). jsdom környezet a komponens-tesztekhez,
 * RTL + jest-dom matcherek a setupban. A `@/*` alias a tsconfig-ot tükrözi.
 *
 * A teszt-fájlok a `pnpm typecheck` (tsc) hatókörén KÍVÜL vannak (lásd tsconfig
 * `exclude`), így a Vitest/RTL típusok nem törik a typecheck-kaput; a futtatás
 * esbuild-transpile, nem teljes típusellenőrzés.
 */
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    css: false,
  },
});
