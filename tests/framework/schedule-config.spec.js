// PHASE 5, B13 (scheduled regression readiness). Configuration validation only -- this
// framework does not create or register any real external schedule. Every entry ships
// `enabled: false`; turning one on for real is a deliberate, separate, out-of-scope action.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const CONFIG_PATH = path.join(__dirname, '..', '..', '.framework', 'config', 'schedule.example.json');
const CRON_PATTERN = /^(\*|[0-9,\-/]+)\s+(\*|[0-9,\-/]+)\s+(\*|[0-9,\-/]+)\s+(\*|[0-9,\-/]+)\s+(\*|[0-9,\-/]+)$/;

test('the schedule example config is valid JSON', () => {
  expect(() => JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'))).not.toThrow();
});

test('every schedule entry has a syntactically valid 5-field cron expression', () => {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  for (const [name, entry] of Object.entries(config)) {
    expect(entry.cronExpression, `entry "${name}"`).toMatch(CRON_PATTERN);
  }
});

test('every schedule entry ships disabled by default -- no real schedule is ever auto-registered', () => {
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  for (const [name, entry] of Object.entries(config)) {
    expect(entry.enabled, `entry "${name}"`).toBe(false);
  }
});

test('every schedule entry references a real, known execution profile', () => {
  const { loadProfiles } = require('../../.framework/lib/execution-profiles');
  const profiles = loadProfiles();
  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const validProfileNames = new Set([...Object.keys(profiles), 'full', 'regression']); // "full"/"regression" map to existing npm scripts, not the profiles.json resolver
  for (const [name, entry] of Object.entries(config)) {
    expect(validProfileNames.has(entry.profile), `entry "${name}" references unknown profile "${entry.profile}"`).toBe(true);
  }
});

test('the config contains no real URLs, hostnames, or secret-shaped values (consistent with B10/B9)', () => {
  const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
  expect(raw).not.toMatch(/https?:\/\//);
  expect(raw.toLowerCase()).not.toMatch(/password|token|secret|api[-_]?key/);
});
