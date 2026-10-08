// PHASE 5, B2 (test execution profiles): config-driven resolution, never hardcoded product
// behavior.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { resolveProfile, loadProfiles } = require('../../.framework/lib/execution-profiles');

test('each named profile resolves to the expected Playwright CLI args', () => {
  expect(resolveProfile('smoke')).toEqual(['--grep', '@smoke', '--project=chromium']);
  expect(resolveProfile('api')).toEqual(['--grep', '@api', '--project=chromium']);
});

test('a testDir-based profile resolves the path as a positional arg', () => {
  const configPath = path.join(os.tmpdir(), `profiles-${Date.now()}.json`);
  fs.writeFileSync(configPath, JSON.stringify({ custom: { testDir: 'tests/custom', project: 'chromium' } }));
  try {
    expect(resolveProfile('custom', { configPath })).toEqual(['tests/custom', '--project=chromium']);
  } finally {
    fs.rmSync(configPath, { force: true });
  }
});

test('an unknown profile name throws a clear error, never a silent fallback', () => {
  expect(() => resolveProfile('not-a-real-profile')).toThrow(/Unknown execution profile/);
});

test('a missing config file throws a clear error', () => {
  expect(() => resolveProfile('smoke', { configPath: '/no/such/file.json' })).toThrow(/not found/);
});

test('a malformed (non-JSON) config file throws a clear error, never a partial/guessed result', () => {
  const configPath = path.join(os.tmpdir(), `bad-profiles-${Date.now()}.json`);
  fs.writeFileSync(configPath, '{ this is not valid json');
  try {
    expect(() => resolveProfile('smoke', { configPath })).toThrow(/not valid JSON/);
  } finally {
    fs.rmSync(configPath, { force: true });
  }
});

test('loadProfiles exposes every configured profile name', () => {
  const profiles = loadProfiles();
  expect(Object.keys(profiles)).toEqual(expect.arrayContaining(['smoke', 'sanity', 'api', 'ui', 'changed']));
});

test('the real committed execution-profiles.json is used by default and resolves without error', () => {
  for (const name of ['smoke', 'sanity', 'api', 'ui', 'changed']) {
    expect(() => resolveProfile(name)).not.toThrow();
  }
});
