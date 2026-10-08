const fs = require('fs');
const { test, expect } = require('@playwright/test');
const artifactStore = require('../../.framework/lib/artifact-store');
const {
  computeFlakyTests,
  getExecutionHistoryForTestCase,
  DEFAULT_FLAKY_HISTORY_LIMIT,
  DEFAULT_QUARANTINE_FREQUENCY_THRESHOLD,
} = require('../../.framework/agents/gap-analysis');

function fakeRunId(label) {
  return `run-test-flaky-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function writeExecution(runId, testCaseId, result) {
  artifactStore.writeArtifact(runId, 'execution', `EXEC-${testCaseId.replace(/^TC-/, '')}`, {
    testCaseId, specFile: null, result, durationMs: null, browserProject: null,
    errorMessage: null, stackTrace: null, source: 'real-playwright-run', retryCount: 0,
  });
}

function cleanup(runIds) {
  for (const runId of runIds) fs.rmSync(artifactStore.runDir(runId), { recursive: true, force: true });
}

test('flags a test whose result differs across recent runs', () => {
  const runs = [fakeRunId('a'), fakeRunId('b'), fakeRunId('c')];
  writeExecution(runs[0], 'TC-FLAKY-01', 'passed');
  writeExecution(runs[1], 'TC-FLAKY-01', 'failed');
  writeExecution(runs[2], 'TC-FLAKY-01', 'passed');

  const flaky = computeFlakyTests(['TC-FLAKY-01'], { runIds: runs });
  expect(flaky.length).toBe(1);
  expect(flaky[0].testCaseId).toBe('TC-FLAKY-01');
  expect(flaky[0].history.map((h) => h.result)).toEqual(['passed', 'failed', 'passed']);

  cleanup(runs);
});

test('does not flag a test with a consistent result across runs', () => {
  const runs = [fakeRunId('d'), fakeRunId('e')];
  writeExecution(runs[0], 'TC-STABLE-01', 'passed');
  writeExecution(runs[1], 'TC-STABLE-01', 'passed');

  const flaky = computeFlakyTests(['TC-STABLE-01'], { runIds: runs });
  expect(flaky.length).toBe(0);

  cleanup(runs);
});

test('a single data point is never enough to call a test flaky', () => {
  const runs = [fakeRunId('single')];
  writeExecution(runs[0], 'TC-ONE-RUN-01', 'failed');

  const flaky = computeFlakyTests(['TC-ONE-RUN-01'], { runIds: runs });
  expect(flaky.length).toBe(0);

  cleanup(runs);
});

test('only considers the most recent historyLimit runs, not the full history', () => {
  const runs = [fakeRunId('f1'), fakeRunId('f2'), fakeRunId('f3')];
  writeExecution(runs[0], 'TC-OLD-DRIFT-01', 'failed'); // outside the window once limit=2
  writeExecution(runs[1], 'TC-OLD-DRIFT-01', 'passed');
  writeExecution(runs[2], 'TC-OLD-DRIFT-01', 'passed');

  const flakyFullHistory = computeFlakyTests(['TC-OLD-DRIFT-01'], { runIds: runs, historyLimit: 3 });
  const flakyLimited = computeFlakyTests(['TC-OLD-DRIFT-01'], { runIds: runs, historyLimit: 2 });
  expect(flakyFullHistory.length).toBe(1); // failed + passed + passed -> differs
  expect(flakyLimited.length).toBe(0); // only the last 2 runs, both passed

  cleanup(runs);
});

test('a test with no execution history at all is never flagged', () => {
  const flaky = computeFlakyTests(['TC-NEVER-RUN-01'], { runIds: [] });
  expect(flaky).toEqual([]);
});

test('default history limit is a sane, documented constant', () => {
  expect(DEFAULT_FLAKY_HISTORY_LIMIT).toBeGreaterThan(1);
});

// --- PHASE 4, A7 (flaky-test intelligence) + PHASE 5, B6 (historical execution data) ---

test('getExecutionHistoryForTestCase returns the same data computeFlakyTests uses internally (characterization)', () => {
  const runs = [fakeRunId('char1'), fakeRunId('char2'), fakeRunId('char3')];
  writeExecution(runs[0], 'TC-CHARACTERIZE-01', 'passed');
  writeExecution(runs[1], 'TC-CHARACTERIZE-01', 'failed');
  writeExecution(runs[2], 'TC-CHARACTERIZE-01', 'passed');

  const history = getExecutionHistoryForTestCase('TC-CHARACTERIZE-01', { runIds: runs });
  const flaky = computeFlakyTests(['TC-CHARACTERIZE-01'], { runIds: runs });

  expect(history).toEqual(flaky[0].history);
  cleanup(runs);
});

test('flakyFrequency reflects how often the result actually flips, not just that it flipped once', () => {
  const runs = [fakeRunId('freq1'), fakeRunId('freq2'), fakeRunId('freq3'), fakeRunId('freq4'), fakeRunId('freq5')];
  writeExecution(runs[0], 'TC-FREQ-01', 'passed');
  writeExecution(runs[1], 'TC-FREQ-01', 'passed');
  writeExecution(runs[2], 'TC-FREQ-01', 'passed');
  writeExecution(runs[3], 'TC-FREQ-01', 'failed'); // exactly one flip across 4 pairs
  writeExecution(runs[4], 'TC-FREQ-01', 'failed');

  const flaky = computeFlakyTests(['TC-FREQ-01'], { runIds: runs });
  expect(flaky.length).toBe(1);
  expect(flaky[0].flakyFrequency).toBe(0.25); // 1 transition / 4 pairs

  cleanup(runs);
});

test('quarantineRecommended is only true at or above the frequency threshold, and the threshold is configurable', () => {
  const runs = [fakeRunId('q1'), fakeRunId('q2'), fakeRunId('q3'), fakeRunId('q4'), fakeRunId('q5')];
  writeExecution(runs[0], 'TC-QUARANTINE-01', 'passed');
  writeExecution(runs[1], 'TC-QUARANTINE-01', 'passed');
  writeExecution(runs[2], 'TC-QUARANTINE-01', 'passed');
  writeExecution(runs[3], 'TC-QUARANTINE-01', 'failed'); // frequency 0.25, below default 0.5
  writeExecution(runs[4], 'TC-QUARANTINE-01', 'failed');

  const defaultThreshold = computeFlakyTests(['TC-QUARANTINE-01'], { runIds: runs });
  expect(defaultThreshold[0].quarantineRecommended).toBe(false);

  const lowerThreshold = computeFlakyTests(['TC-QUARANTINE-01'], { runIds: runs, quarantineFrequencyThreshold: 0.2 });
  expect(lowerThreshold[0].quarantineRecommended).toBe(true);

  cleanup(runs);
});

test('DEFAULT_QUARANTINE_FREQUENCY_THRESHOLD is a documented, non-zero constant, not silently invented at call time', () => {
  expect(DEFAULT_QUARANTINE_FREQUENCY_THRESHOLD).toBeGreaterThan(0);
  expect(DEFAULT_QUARANTINE_FREQUENCY_THRESHOLD).toBeLessThanOrEqual(1);
});

test('getExecutionHistoryForTestCase returns an empty array for a test case with no history, never guessed data', () => {
  expect(getExecutionHistoryForTestCase('TC-NEVER-SEEN-01', { runIds: [] })).toEqual([]);
});
