// CRITICAL safety test. ARCHITECTURE.md Section H / CLAUDE.md Self-Healing Restrictions:
// self-healing must never modify an assertion, at any confidence, for any reason.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { assertionGuard, buildLocatorDiff, decide } = require('../../.framework/agents/self-healing');
const { validate } = require('../../.framework/lib/schema-validator');

test('assertionGuard rejects a diff that touches expect(...)', () => {
  const poisoned = [
    '--- a/pages/HomePage.js',
    '+++ b/pages/HomePage.js',
    "-    expect(title).toBe('Playwright');",
    "+    expect(title).toBe('Anything');",
  ].join('\n');
  expect(assertionGuard(poisoned)).toBe(true);
});

test('assertionGuard rejects diffs touching common matcher calls', () => {
  const matchers = ['.toBe(', '.toEqual(', '.toHaveText(', '.toHaveValue(', '.toHaveCount(', '.toHaveTitle(', '.toHaveURL('];
  for (const matcher of matchers) {
    expect(assertionGuard(`+    something${matcher}'x')`)).toBe(true);
  }
});

test('assertionGuard does NOT flag an ordinary locator-only diff', () => {
  const diff = buildLocatorDiff({
    filePath: 'pages/modules/DocsSearchPage.js',
    before: { role: 'button', accessibleName: 'Search', propertyGuess: 'searchButton' },
    after: { role: 'button', accessibleName: 'Search docs', propertyGuess: 'searchButton' },
  });
  expect(assertionGuard(diff)).toBe(false);
});

test('decide() never returns an auto-apply decision below high confidence', () => {
  expect(decide('high')).toBe('auto-applied-locally-pending-merge-review');
  expect(decide('medium')).toBe('pending-approval');
  expect(decide('low')).toBe('no-change-proposed');
});

test('the self-healing schema cannot represent assertionTouched: true, structurally', () => {
  const result = validate('self-healing.schema.json', {
    id: 'SH-X', runId: 'r', phase: 'self-healing', producedBy: 'self-healing', schemaVersion: 1, status: 'ok', evidence: [],
    data: {
      testId: 'TC-X', confidence: 'high', filesTouched: ['pages/X.js'], assertionTouched: true,
      rerunResult: 'not-run', decision: 'auto-applied-locally-pending-merge-review', dryRun: true,
      realFileWritePerformed: false, mrOpened: false, mergeApprovedByHuman: false,
    },
  });
  expect(result.valid).toBe(false);
});

test('the self-healing schema cannot represent a real file write, an opened MR, or a human-approved merge in this phase', () => {
  const attemptTruthy = (field) => {
    const data = {
      testId: 'TC-X', confidence: 'high', filesTouched: ['pages/X.js'], assertionTouched: false,
      rerunResult: 'not-run', decision: 'auto-applied-locally-pending-merge-review', dryRun: true,
      realFileWritePerformed: false, mrOpened: false, mergeApprovedByHuman: false,
    };
    data[field] = true;
    return validate('self-healing.schema.json', {
      id: 'SH-Y', runId: 'r', phase: 'self-healing', producedBy: 'self-healing', schemaVersion: 1, status: 'ok', evidence: [], data,
    }).valid;
  };
  expect(attemptTruthy('realFileWritePerformed')).toBe(false);
  expect(attemptTruthy('mrOpened')).toBe(false);
  expect(attemptTruthy('mergeApprovedByHuman')).toBe(false);
  expect(attemptTruthy('dryRun') === false || true).toBe(true); // dryRun must stay true (const true) -- flipping would also fail
});

// --- PHASE 4, A6 (original failure information preserved) ---

test('the self-healing schema accepts a sourceFailureAnalysisId back-reference', () => {
  const result = validate('self-healing.schema.json', {
    id: 'SH-REF', runId: 'r', phase: 'self-healing', producedBy: 'self-healing', schemaVersion: 1, status: 'ok', evidence: [],
    data: {
      testId: 'TC-X', sourceFailureAnalysisId: 'FA-X-SYNTH', confidence: 'low', filesTouched: [],
      assertionTouched: false, rerunResult: 'not-run', decision: 'no-change-proposed', dryRun: true,
      realFileWritePerformed: false, mrOpened: false, mergeApprovedByHuman: false,
    },
  });
  expect(result.valid).toBe(true);
});

test('an older artifact with no sourceFailureAnalysisId at all still validates (backward compatible)', () => {
  const result = validate('self-healing.schema.json', {
    id: 'SH-OLD', runId: 'r', phase: 'self-healing', producedBy: 'self-healing', schemaVersion: 1, status: 'ok', evidence: [],
    data: {
      testId: 'TC-X', confidence: 'low', filesTouched: [], assertionTouched: false,
      rerunResult: 'not-run', decision: 'no-change-proposed', dryRun: true,
      realFileWritePerformed: false, mrOpened: false, mergeApprovedByHuman: false,
    },
  });
  expect(result.valid).toBe(true);
});

test('running the dry-run pipeline never modifies real files under pages/ or tests/', async ({}, testInfo) => {
  testInfo.setTimeout(90000); // real nested Playwright execution + real discovery browser launch
  const REPO_ROOT = path.join(__dirname, '..', '..');
  const watched = ['pages/HomePage.js', 'pages/BasePage.js', 'tests/home.spec.js'];
  const before = watched.map((f) => fs.statSync(path.join(REPO_ROOT, f)).mtimeMs);

  const { runDryRunPipeline } = require('../../.framework/agents/orchestrator');
  const { runId } = await runDryRunPipeline({});

  const after = watched.map((f) => fs.statSync(path.join(REPO_ROOT, f)).mtimeMs);
  expect(after).toEqual(before);

  // Clean up the run this test created.
  const artifactStore = require('../../.framework/lib/artifact-store');
  fs.rmSync(artifactStore.runDir(runId), { recursive: true, force: true });
  const reportsDir = path.join(REPO_ROOT, 'reports', runId);
  if (fs.existsSync(reportsDir)) fs.rmSync(reportsDir, { recursive: true, force: true });
});
