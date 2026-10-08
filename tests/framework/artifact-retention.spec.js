// PHASE 5, B5 (artifact management -- cleaned according to policy). Opt-in, dry-run by
// default, never destructive unless explicitly told to apply.

const fs = require('fs');
const { test, expect } = require('@playwright/test');
const artifactStore = require('../../.framework/lib/artifact-store');
const { pruneRunsOlderThan, pruneRunsKeepingLast, extractTimestampFromRunId } = require('../../.framework/lib/artifact-retention');

function fakeRunId(timestampMs, label) {
  return `run-${timestampMs}-${label}`;
}

test('extractTimestampFromRunId parses the embedded timestamp correctly', () => {
  expect(extractTimestampFromRunId('run-1700000000000-abc123')).toBe(1700000000000);
});

test('extractTimestampFromRunId returns null for a malformed run id, never guessed', () => {
  expect(extractTimestampFromRunId('not-a-real-run-id')).toBeNull();
});

test('pruneRunsOlderThan is a dry-run by default: reports candidates but deletes nothing', () => {
  const runId = fakeRunId(1, 'old'); // effectively year 1970 -- always "older than" any real window
  artifactStore.ensureRun(runId);
  try {
    const result = pruneRunsOlderThan(30, { runIds: [runId], now: new Date() });
    expect(result.dryRun).toBe(true);
    expect(result.prunedRunIds).toEqual([runId]);
    expect(fs.existsSync(artifactStore.runDir(runId))).toBe(true); // still exists -- dry run
  } finally {
    fs.rmSync(artifactStore.runDir(runId), { recursive: true, force: true });
  }
});

test('pruneRunsOlderThan with dryRun:false actually deletes qualifying runs', () => {
  const runId = fakeRunId(1, 'old-real-delete');
  artifactStore.ensureRun(runId);
  const result = pruneRunsOlderThan(30, { runIds: [runId], now: new Date(), dryRun: false });
  expect(result.prunedRunIds).toEqual([runId]);
  expect(fs.existsSync(artifactStore.runDir(runId))).toBe(false);
});

test('pruneRunsOlderThan never touches a run within the retention window', () => {
  const recentRunId = fakeRunId(Date.now(), 'recent');
  artifactStore.ensureRun(recentRunId);
  try {
    const result = pruneRunsOlderThan(30, { runIds: [recentRunId] });
    expect(result.prunedRunIds).toEqual([]);
  } finally {
    fs.rmSync(artifactStore.runDir(recentRunId), { recursive: true, force: true });
  }
});

test('pruneRunsKeepingLast keeps exactly the N most recent runs, dry-run by default', () => {
  const runIds = [fakeRunId(1, 'a'), fakeRunId(2, 'b'), fakeRunId(3, 'c')];
  const result = pruneRunsKeepingLast(2, { runIds });
  expect(result.prunedRunIds).toEqual([fakeRunId(1, 'a')]);
  expect(result.dryRun).toBe(true);
});

test('pruneRunsKeepingLast with fewer runs than N prunes nothing', () => {
  const runIds = [fakeRunId(1, 'a'), fakeRunId(2, 'b')];
  expect(pruneRunsKeepingLast(5, { runIds }).prunedRunIds).toEqual([]);
});

test('an empty run list never crashes, produces no candidates', () => {
  expect(pruneRunsOlderThan(30, { runIds: [] }).prunedRunIds).toEqual([]);
  expect(pruneRunsKeepingLast(5, { runIds: [] }).prunedRunIds).toEqual([]);
});
