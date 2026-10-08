// PHASE 5, B9 (environment management): named environments via config, no real URLs, and the
// existing production-execution guard is never bypassed.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { loadEnvironmentConfig, loadEnvironmentConfigs } = require('../../.framework/lib/environment-config');
const { ProductionExecutionBlockedError } = require('../../.framework/lib/environment-safety');

test('the real committed example config resolves every named environment without error', () => {
  for (const name of ['local', 'qa', 'staging', 'ci']) {
    expect(() => loadEnvironmentConfig(name)).not.toThrow();
  }
});

test('an unknown environment name throws a clear error', () => {
  expect(() => loadEnvironmentConfig('not-a-real-environment')).toThrow(/Unknown environment/);
});

test('a missing config file throws a clear error', () => {
  expect(() => loadEnvironmentConfig('local', { configPath: '/no/such/file.json' })).toThrow(/not found/);
});

test('the example config contains no real hostnames -- placeholders only (consistent with B10)', () => {
  const configs = loadEnvironmentConfigs();
  for (const config of Object.values(configs)) {
    expect(config.baseURL).toBeNull();
  }
});

test('a config with a real-looking baseURL and no explicit non-production confirmation is still blocked -- this module cannot bypass the existing guard', () => {
  const configPath = path.join(os.tmpdir(), `env-config-${Date.now()}.json`);
  fs.writeFileSync(configPath, JSON.stringify({ risky: { baseURL: 'https://app.example.com', testEnvironment: undefined } }));
  try {
    expect(() => loadEnvironmentConfig('risky', { configPath })).toThrow(ProductionExecutionBlockedError);
  } finally {
    fs.rmSync(configPath, { force: true });
  }
});

test('a config with a real-looking baseURL and explicit non-production confirmation is allowed', () => {
  const configPath = path.join(os.tmpdir(), `env-config-ok-${Date.now()}.json`);
  fs.writeFileSync(configPath, JSON.stringify({ ok: { baseURL: 'https://staging.example.com', testEnvironment: 'non-production' } }));
  try {
    expect(() => loadEnvironmentConfig('ok', { configPath })).not.toThrow();
  } finally {
    fs.rmSync(configPath, { force: true });
  }
});
