import { defineConfig, devices } from '@playwright/test';

/**
 * Runs against the real API (see specs/web-spa's own testing philosophy,
 * matching apps/api's e2e tests) - requires `docker compose up -d` and
 * `npm run dev --workspace=apps/api` running first. This config only
 * starts the SPA's own dev server if one isn't already up.
 */
export default defineConfig({
  testDir: './test/e2e',
  globalSetup: './test/e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
