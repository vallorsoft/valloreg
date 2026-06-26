import type { Config } from 'jest';

/**
 * Két jest „project":
 *  - `unit`        : gyors, DB nélkül. `*.spec.ts` (kivéve `*.int.spec.ts`).
 *                    Ez fut alapból (`pnpm test`) és a CI fő kapujában.
 *  - `integration` : `*.int.spec.ts`. Élő Postgres + generált Prisma kliens kell
 *                    (`prisma generate` + `migrate deploy`). A CI külön jobban futtatja.
 */
const tsTransform: Config['transform'] = {
  '^.+\\.ts$': [
    'ts-jest',
    {
      // A jest CommonJS-t vár; a NodeNext modul-beállítást felülírjuk.
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
        verbatimModuleSyntax: false,
        isolatedModules: true,
      },
    },
  ],
};

const config: Config = {
  rootDir: '.',
  projects: [
    {
      displayName: 'unit',
      testEnvironment: 'node',
      rootDir: '.',
      moduleFileExtensions: ['ts', 'js', 'json'],
      testMatch: ['<rootDir>/src/**/*.spec.ts', '<rootDir>/test/**/*.spec.ts'],
      testPathIgnorePatterns: ['/node_modules/', '\\.int\\.spec\\.ts$'],
      transform: tsTransform,
    },
    {
      displayName: 'integration',
      testEnvironment: 'node',
      rootDir: '.',
      moduleFileExtensions: ['ts', 'js', 'json'],
      testMatch: ['<rootDir>/test/**/*.int.spec.ts', '<rootDir>/src/**/*.int.spec.ts'],
      transform: tsTransform,
    },
  ],
};

export default config;
