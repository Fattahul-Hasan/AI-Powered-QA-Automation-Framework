// PHASE 2 — Generic Framework Completion & End-to-End Validation.
//
// Proves the authentication foundation (utils/auth.js) and the API-testing foundation
// (utils/auth-api-adapter.js, utils/api-client.js) actually work end-to-end, for the first
// time -- previously they were only tested against error paths (see
// tests/framework/authentication-utilities.spec.js). Uses a generic, local, ephemeral mock
// server (.framework/mock/generic-server.js) -- never a real application.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect, chromium } = require('@playwright/test');
const { startMockServer, MOCK_USERNAME, MOCK_PASSWORD } = require('../../.framework/mock/generic-server');
const { loginWithCredentials } = require('../../utils/auth');
const { createApiContext } = require('../../utils/api-client');
const { acquireApiToken } = require('../../utils/auth-api-adapter');

test.describe('generic authentication foundation, proven end-to-end', () => {
  let mock;

  test.beforeAll(async () => {
    mock = await startMockServer();
  });

  test.afterAll(async () => {
    await mock.stop();
  });

  test('browser-based login + storageState save + reuse round-trips for real', async () => {
    const statePath = path.join(os.tmpdir(), `pw-state-${Date.now()}.json`);
    const browser = await chromium.launch();
    try {
      // Real login using the generic BasePage-adjacent auth helper, against the mock server.
      const context = await browser.newContext();
      const page = await context.newPage();
      await loginWithCredentials(page, {
        loginPath: `${mock.url}/login`,
        selectors: { usernameInput: '#username', passwordInput: '#password', submitButton: '#submit' },
        username: MOCK_USERNAME,
        password: MOCK_PASSWORD,
      });
      await page.waitForURL(/\/dashboard$/);
      await expect(page.locator('#welcome')).toHaveText('Welcome');

      await context.storageState({ path: statePath });
      await context.close();

      // Reuse the saved session in a brand-new context -- no credentials entered this time.
      const reusedContext = await browser.newContext({ storageState: statePath });
      const reusedPage = await reusedContext.newPage();
      await reusedPage.goto(`${mock.url}/dashboard`);
      await expect(reusedPage.locator('#welcome')).toHaveText('Welcome');
      await reusedContext.close();
    } finally {
      await browser.close();
      fs.rmSync(statePath, { force: true });
    }
  });

  test('reusing a session without ever logging in fails, proving the reuse above was genuine', async () => {
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage();
      await page.goto(`${mock.url}/dashboard`);
      await expect(page).toHaveURL(/\/login$/);
    } finally {
      await browser.close();
    }
  });

  test('API-based auth adapter successfully acquires a real token from the mock server', async () => {
    const token = await acquireApiToken({
      baseURL: mock.url,
      tokenEndpoint: '/api/token',
      credentials: { username: MOCK_USERNAME, password: MOCK_PASSWORD },
      tokenField: 'access_token',
    });
    expect(token).toMatch(/^mock-token-/);
  });

  test('API-based auth adapter correctly rejects wrong credentials against a real server', async () => {
    await expect(
      acquireApiToken({
        baseURL: mock.url,
        tokenEndpoint: '/api/token',
        credentials: { username: MOCK_USERNAME, password: 'wrong' },
        tokenField: 'access_token',
      }),
    ).rejects.toThrow(/Token acquisition failed/);
  });

  test('generic API request context factory works against a real server', async () => {
    const context = await createApiContext({ baseURL: mock.url });
    try {
      const response = await context.post('/api/token', {
        data: { username: MOCK_USERNAME, password: MOCK_PASSWORD },
      });
      expect(response.ok()).toBe(true);
      const body = await response.json();
      expect(body.access_token).toMatch(/^mock-token-/);
    } finally {
      await context.dispose();
    }
  });
});
