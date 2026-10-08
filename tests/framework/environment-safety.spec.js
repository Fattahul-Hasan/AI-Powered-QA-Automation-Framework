const { test, expect } = require('@playwright/test');
const { assertNonProductionEnvironment, isRealTargetConfigured, ProductionExecutionBlockedError } = require('../../.framework/lib/environment-safety');

test('placeholder demo mode (no real BASE_URL) is never blocked', () => {
  expect(() => assertNonProductionEnvironment({ baseURL: undefined })).not.toThrow();
  expect(() => assertNonProductionEnvironment({ baseURL: 'https://playwright.dev' })).not.toThrow();
});

test('a real BASE_URL without TEST_ENVIRONMENT=non-production is blocked by default', () => {
  expect(() =>
    assertNonProductionEnvironment({ baseURL: 'https://app.example.com', testEnvironment: undefined }),
  ).toThrow(ProductionExecutionBlockedError);
});

test('a real BASE_URL with TEST_ENVIRONMENT=non-production is allowed', () => {
  const result = assertNonProductionEnvironment({ baseURL: 'https://staging.example.com', testEnvironment: 'non-production' });
  expect(result.blocked).toBe(false);
});

test('PRODUCTION_HOSTS denylist hard-blocks even when TEST_ENVIRONMENT is set', () => {
  expect(() =>
    assertNonProductionEnvironment({
      baseURL: 'https://prod.example.com',
      testEnvironment: 'non-production',
      productionHostsDenylist: 'prod.example.com,www.example.com',
    }),
  ).toThrow(/hard-blocked/);
});

test('isRealTargetConfigured distinguishes the placeholder from a real target', () => {
  expect(isRealTargetConfigured(undefined)).toBe(false);
  expect(isRealTargetConfigured('https://playwright.dev')).toBe(false);
  expect(isRealTargetConfigured('https://app.example.com')).toBe(true);
});

test('an invalid BASE_URL is blocked with a clear error rather than a cryptic crash', () => {
  expect(() => assertNonProductionEnvironment({ baseURL: 'not-a-url', testEnvironment: 'non-production' })).toThrow(
    ProductionExecutionBlockedError,
  );
});
