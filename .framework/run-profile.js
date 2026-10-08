#!/usr/bin/env node
// PHASE 5, B2. Thin CLI wrapper: resolves a named execution profile and runs Playwright with
// the resulting arguments. Usage: node .framework/run-profile.js <profileName>

const path = require('path');
const { spawnSync } = require('child_process');
const { resolveProfile } = require('./lib/execution-profiles');

const REPO_ROOT = path.join(__dirname, '..');
const PLAYWRIGHT_PKG_DIR = path.dirname(require.resolve('@playwright/test/package.json'));
const PLAYWRIGHT_CLI = path.join(PLAYWRIGHT_PKG_DIR, require('@playwright/test/package.json').bin.playwright);

function main() {
  const profileName = process.argv[2];
  if (!profileName) {
    console.error('Usage: node .framework/run-profile.js <profileName>');
    process.exitCode = 1;
    return;
  }

  let args;
  try {
    args = resolveProfile(profileName);
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  const result = spawnSync(process.execPath, [PLAYWRIGHT_CLI, 'test', ...args], {
    cwd: REPO_ROOT,
    stdio: 'inherit',
  });
  process.exitCode = result.status ?? 1;
}

main();
