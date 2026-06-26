/**
 * Két jest „project":
 *  - `unit`        : gyors, DB nélkül. `*.spec.ts` (kivéve `*.int.spec.ts`).
 *                    Ez fut alapból (`pnpm test`) és a CI fő kapujában.
 *  - `integration` : `*.int.spec.ts`. Élő Postgres + generált Prisma kliens kell
 *                    (`prisma generate` + `migrate deploy`). A CI külön jobban futtatja.
 *
 * Plain CommonJS (NEM .ts) – így a Jest nem ts-node-dal tölti be a configot, és
 * független a projekt `tsconfig` module/moduleResolution beállításától. A teszt-
 * fájlok fordítását a ts-jest inline `module: commonjs` override intézi.
 *
 * @type {import('jest').Config}
 */
const tsTransform = {
  '^.+\\.ts$': [
    'ts-jest',
    {
      tsconfig: {
        module: 'commonjs',
        moduleResolution: 'node',
        verbatimModuleSyntax: false,
        isolatedModules: true,
      },
    },
  ],
};

module.exports = {
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
