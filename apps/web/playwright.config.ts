import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E a webhez. A böngészőt a Playwright a szokásos módon oldja fel
 * (a sandboxban PLAYWRIGHT_BROWSERS_PATH mutat az előtelepített Chromiumra; a
 * CI-ban a `playwright install chromium` tölti le – nincs hardcode-olt útvonal).
 *
 * A `webServer` a tényleges Next.js appot indítja: helyben `next dev` (és reuse,
 * ha már fut), CI-ban a buildelt `next start` (gyorsabb, megbízhatóbb).
 */
const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const isCI = !!process.env.CI;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? 'line' : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    navigationTimeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: isCI ? `next start -p ${PORT}` : `next dev -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: !isCI,
    timeout: 120_000,
    env: { NEXT_PUBLIC_API_URL: 'http://localhost:4000/api' },
  },
});
