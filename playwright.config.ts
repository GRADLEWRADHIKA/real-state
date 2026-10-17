import { defineConfig, devices } from '@playwright/test';

/** Mobile-viewport end-to-end tests against a private demo server (see e2e/global-setup.ts). */
export default defineConfig({
  testDir: 'e2e',
  globalSetup: './e2e/global-setup.ts',
  // One demo database is shared by the run, so tests go one at a time.
  workers: 1,
  fullyParallel: false,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL,
    ...devices['Pixel 7'],
    timezoneId: 'Asia/Kolkata',
    locale: 'en-IN',
    permissions: ['geolocation'],
    geolocation: { latitude: 26.8467, longitude: 80.9462 },
    trace: 'retain-on-failure',
    // Use a preinstalled Chromium when the bundled one is not downloaded (e.g. offline CI images).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH } : {},
  },
  projects: [{ name: 'mobile-chromium', use: { browserName: 'chromium' } }],
});
