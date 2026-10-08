const fs = require('fs');
const { test, expect } = require('@playwright/test');
const artifactStore = require('../../.framework/lib/artifact-store');
const { computeSmokeBaseline, computeImpactedTestIds, runStandardTail } = require('../../.framework/agents/regression');

function freshRunId() {
  return `run-test-regression-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Each test cleans up only the exact run directory it created, rather than glob-deleting by
// prefix in a shared afterEach -- the previous shared-prefix approach raced across parallel
// workers (one test's cleanup could try to delete a directory another concurrently-running test
// was still writing to, causing an intermittent Windows EPERM). This is a test-infrastructure
// fix, not a change to any production code.
function cleanupRun(runId) {
  fs.rmSync(artifactStore.runDir(runId), { recursive: true, force: true });
}

test('computeSmokeBaseline selects only P1 test cases', () => {
  const testCases = [
    { id: 'TC-1', data: { priority: 'P1' } },
    { id: 'TC-2', data: { priority: 'P2' } },
    { id: 'TC-3', data: { priority: 'P1' } },
  ];
  expect(computeSmokeBaseline(testCases).sort()).toEqual(['TC-1', 'TC-3']);
});

test('computeSmokeBaseline is honestly empty when no P1 test cases exist -- not an error', () => {
  const testCases = [{ id: 'TC-1', data: { priority: 'P2' } }];
  expect(computeSmokeBaseline(testCases)).toEqual([]);
});

test('computeImpactedTestIds maps changed files to test cases via recorded pageObjectsTouched only', () => {
  const automation = [
    { data: { testCaseId: 'TC-1', pageObjectsTouched: ['pages/HomePage.js'] } },
    { data: { testCaseId: 'TC-2', pageObjectsTouched: ['pages/OtherPage.js'] } },
  ];
  expect(computeImpactedTestIds(automation, ['pages/HomePage.js'])).toEqual(['TC-1']);
});

test('computeImpactedTestIds never guesses -- an unrelated file change impacts nothing', () => {
  const automation = [{ data: { testCaseId: 'TC-1', pageObjectsTouched: ['pages/HomePage.js'] } }];
  expect(computeImpactedTestIds(automation, ['pages/Unrelated.js'])).toEqual([]);
});

test('runStandardTail on a run with zero P1 test cases produces a valid artifact, not a crash', async () => {
  const runId = freshRunId();
  artifactStore.ensureRun(runId);
  try {
    artifactStore.writeArtifact(runId, 'test-design', 'TC-P2-ONLY', {
      requirementId: 'REQ-X', scenario: 'A P2 scenario', testType: 'functional', priority: 'P2',
      severity: 'low', risk: 'low', steps: ['x'], expectedResult: 'y',
      automationCandidate: true, regressionCandidate: true, humanReviewRequired: false,
    });

    const artifact = await runStandardTail({ runId });
    expect(artifact.data.smokeBaselineIds).toEqual([]);
    expect(artifact.data.trigger).toBe('standard-tail');
  } finally {
    cleanupRun(runId);
  }
});

// --- PHASE 4, A3 (intelligent test selection) -- additive selectionReasons field ---

test('runStandardTail attaches a selectionReasons entry for every selected test, explaining why', async () => {
  const runId = freshRunId();
  artifactStore.ensureRun(runId);
  try {
    artifactStore.writeArtifact(runId, 'test-design', 'TC-P1-REASON', {
      requirementId: 'REQ-X', scenario: 'A P1 scenario', testType: 'functional', priority: 'P1',
      severity: 'high', risk: 'low', steps: ['x'], expectedResult: 'y',
      automationCandidate: true, regressionCandidate: true, humanReviewRequired: false,
    });

    const artifact = await runStandardTail({ runId });
    expect(artifact.data.selectionReasons['TC-P1-REASON']).toContain('smoke-baseline');
  } finally {
    cleanupRun(runId);
  }
});

test('existing smokeBaselineIds/impactedTestIds/selectedForExecution computation is unaffected by the new selectionReasons field', async () => {
  const runId = freshRunId();
  artifactStore.ensureRun(runId);
  try {
    artifactStore.writeArtifact(runId, 'test-design', 'TC-P1-UNAFFECTED', {
      requirementId: 'REQ-X', scenario: 'Unaffected check', testType: 'functional', priority: 'P1',
      severity: 'high', risk: 'low', steps: ['x'], expectedResult: 'y',
      automationCandidate: true, regressionCandidate: true, humanReviewRequired: false,
    });

    const artifact = await runStandardTail({ runId });
    expect(artifact.data.smokeBaselineIds).toEqual(['TC-P1-UNAFFECTED']);
    expect(artifact.data.selectedForExecution).toEqual(['TC-P1-UNAFFECTED']);
  } finally {
    cleanupRun(runId);
  }
});
