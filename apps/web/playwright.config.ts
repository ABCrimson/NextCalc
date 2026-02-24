import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E Test Configuration for NextCalc Pro
 */
const config: Parameters<typeof defineConfig>[0] = {
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 2 : 0,
  reporter: 'html',

  use: {
    baseURL: 'http://localhost:3005',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    },
  ],

  webServer: {
    command: 'pnpm dev --port 3005',
    url: 'http://localhost:3005',
    reuseExistingServer: !process.env['CI'],
    timeout: 120000,
  },
};

if (process.env['CI']) {
  config.workers = 1;
}

export default defineConfig(config);
