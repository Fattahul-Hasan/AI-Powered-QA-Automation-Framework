// PHASE 5, B10 (secret safety). Injects a synthetic, clearly-fake secret value through a real
// pipeline run and asserts it never surfaces in console output, any artifact file, the audit
// log, or the generated reports. Uses a synthetic value only -- never a real credential.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const artifactStore = require('../../.framework/lib/artifact-store');
const { runDryRunPipeline } = require('../../.framework/agents/orchestrator');

const SYNTHETIC_SECRET = 'SYNTHETIC-SECRET-VALUE-DO-NOT-LEAK-9f8e7d6c';

function walkFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walkFiles(fullPath) : [fullPath];
  });
}

test('a synthetic secret injected via env vars never appears in console output, artifacts, audit log, or reports', async ({}, testInfo) => {
  testInfo.setTimeout(120000);

  process.env.GITLAB_PERSONAL_ACCESS_TOKEN = SYNTHETIC_SECRET;
  process.env.SYNTHETIC_TEST_PASSWORD = SYNTHETIC_SECRET;

  const capturedLines = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args) => { capturedLines.push(args.map(String).join(' ')); originalLog(...args); };
  console.error = (...args) => { capturedLines.push(args.map(String).join(' ')); originalError(...args); };

  let result;
  try {
    result = await runDryRunPipeline({});
  } finally {
    console.log = originalLog;
    console.error = originalError;
    delete process.env.GITLAB_PERSONAL_ACCESS_TOKEN;
    delete process.env.SYNTHETIC_TEST_PASSWORD;
  }

  try {
    // 1. Console output never contains the secret.
    const leakedInLogs = capturedLines.filter((line) => line.includes(SYNTHETIC_SECRET));
    expect(leakedInLogs).toEqual([]);

    // 2. No artifact file under the run directory contains the secret.
    const runFiles = walkFiles(artifactStore.runDir(result.runId));
    expect(runFiles.length).toBeGreaterThan(0);
    for (const file of runFiles) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content.includes(SYNTHETIC_SECRET)).toBe(false);
    }

    // 3. No generated report file contains the secret.
    const reportFiles = walkFiles(result.reportsDir);
    expect(reportFiles.length).toBeGreaterThan(0);
    for (const file of reportFiles) {
      const content = fs.readFileSync(file, 'utf8');
      expect(content.includes(SYNTHETIC_SECRET)).toBe(false);
    }
  } finally {
    fs.rmSync(artifactStore.runDir(result.runId), { recursive: true, force: true });
    if (fs.existsSync(result.reportsDir)) fs.rmSync(result.reportsDir, { recursive: true, force: true });
  }
});

test('the logger redaction pattern matches the env var names used in this test (regression guard on the existing redact())', () => {
  const { redact } = require('../../.framework/lib/logger');
  const redacted = redact({ GITLAB_PERSONAL_ACCESS_TOKEN: SYNTHETIC_SECRET, SYNTHETIC_TEST_PASSWORD: SYNTHETIC_SECRET });
  expect(redacted.GITLAB_PERSONAL_ACCESS_TOKEN).toBe('[redacted]');
  expect(redacted.SYNTHETIC_TEST_PASSWORD).toBe('[redacted]');
});
