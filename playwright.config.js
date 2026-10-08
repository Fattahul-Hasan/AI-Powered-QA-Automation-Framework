// @ts-check
require('dotenv').config();
const { defineConfig, devices } = require('@playwright/test');

// ARCHITECTURE.md Section F (Playwright CLI Execution Model) + Section B (Authentication).
//
// BASE_URL is environment-based: set it in a local .env (see .env.example) or a real
// environment variable in CI. No real application URL is hardcoded here. Until a target
// application is approved (see ARCHITECTURE.md "Phase 1 Status"), this falls back to a public
// placeholder so the existing framework smoke test (tests/home.spec.js) keeps passing.
const BASE_URL = process.env.BASE_URL || 'https://playwright.dev';

module.exports = defineConfig({
  testDir: './tests',
  outputDir: 'test-results',
  // Enforces environment-safety (production execution blocked by default) before any test
  // runs. A no-op whenever BASE_URL is unset/placeholder -- see .framework/lib/global-setup.js.
  globalSetup: require.resolve('./.framework/lib/global-setup.js'),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // Retries: environment-based, with an optional explicit override (TEST_RETRIES) for local
  // debugging of flaky-looking failures without touching this file.
  retries:
    process.env.TEST_RETRIES !== undefined
      ? Number(process.env.TEST_RETRIES)
      : process.env.CI
        ? 2
        : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: BASE_URL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  // Configurable browser projects — select one via `npx playwright test --project=firefox`.
  // Framework validation tests (tests/framework/) are plain JS logic tests with no `page`
  // fixture use -- they run once, in their own project, rather than 3x per browser.
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] }, testIgnore: ['**/framework/**'] },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: ['**/framework/**'] },
    { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: ['**/framework/**'] },
    { name: 'framework', testDir: './tests/framework' },
  ],
});
