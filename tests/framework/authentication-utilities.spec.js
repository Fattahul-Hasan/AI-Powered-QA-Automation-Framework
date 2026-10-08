const { test, expect } = require('@playwright/test');
const auth = require('../../utils/auth');
const { BaseLoginPage } = require('../../pages/authentication/BaseLoginPage');
const { acquireApiToken } = require('../../utils/auth-api-adapter');

test('getRoleCredentials throws loudly when env vars are unset (never a silent empty credential)', () => {
  delete process.env.DEMO_ROLE_USERNAME;
  delete process.env.DEMO_ROLE_PASSWORD;
  expect(() => auth.getRoleCredentials('demo_role')).toThrow(/Missing credentials for role/);
});

test('getRoleCredentials returns credentials once env vars are set', () => {
  process.env.DEMO_ROLE_USERNAME = 'demo-user';
  process.env.DEMO_ROLE_PASSWORD = 'demo-pass';
  const creds = auth.getRoleCredentials('demo_role');
  expect(creds).toEqual({ username: 'demo-user', password: 'demo-pass' });
  delete process.env.DEMO_ROLE_USERNAME;
  delete process.env.DEMO_ROLE_PASSWORD;
});

test('storageStatePath is namespaced per role under .auth/', () => {
  expect(auth.storageStatePath('admin')).toMatch(/\.auth[\\/]admin\.json$/);
  expect(auth.storageStatePath('standard-user')).toMatch(/\.auth[\\/]standard-user\.json$/);
});

test('BaseLoginPage requires the caller to supply selectors -- no hardcoded application selectors exist', () => {
  const fakePage = {
    goto: async () => {},
    locator: (selector) => ({ selector, fill: async () => {}, click: async () => {} }),
  };
  const loginPage = new BaseLoginPage(fakePage, {
    loginPath: '/login',
    usernameInput: '#user',
    passwordInput: '#pass',
    submitButton: '#submit',
  });
  expect(loginPage.usernameInput.selector).toBe('#user');
  expect(loginPage.loginPath).toBe('/login');
});

test('acquireApiToken throws a clear error when the response lacks the expected token field', async () => {
  await expect(
    acquireApiToken({
      baseURL: undefined,
      tokenEndpoint: '/auth/token',
      credentials: { username: 'x', password: 'y' },
      tokenField: 'access_token',
    }),
  ).rejects.toThrow();
});
