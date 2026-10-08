const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const artifactStore = require('../../.framework/lib/artifact-store');
const { upsertRequirement, loadManifest } = require('../../.framework/lib/manifest');

function freshRunId() {
  return `run-test-traceability-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// Each test cleans up only the exact run directory it created (see regression-agent.spec.js for
// why a shared glob-by-prefix afterEach is avoided: it races across parallel workers).
function cleanupRun(runId) {
  fs.rmSync(path.join(artifactStore.RUNS_DIR, runId), { recursive: true, force: true });
}

test('the Requirement -> Test Case -> Automation -> Execution -> Report chain resolves via the manifest', () => {
  const runId = freshRunId();
  try {
    upsertRequirement(runId, 'REQ-1', { testCaseIds: ['TC-1-01'] }, 'orchestrator');
    upsertRequirement(runId, 'REQ-1', {
      testCaseIds: ['TC-1-01'],
      automation: { 'TC-1-01': 'tests/home.spec.js' },
      lastExecution: { 'TC-1-01': { runId, status: 'passed' } },
      reportRef: `reports/${runId}/traceability.md#REQ-1`,
    }, 'orchestrator');

    const manifest = loadManifest(runId);
    const entry = manifest.requirements['REQ-1'];
    expect(entry.testCaseIds).toContain('TC-1-01');
    expect(entry.automation['TC-1-01']).toBe('tests/home.spec.js');
    expect(entry.lastExecution['TC-1-01'].status).toBe('passed');
    expect(entry.reportRef).toContain('REQ-1');
  } finally {
    cleanupRun(runId);
  }
});

// --- PHASE 4, A11 (traceability extends to failure-analysis/self-healing references) ---

test('the manifest schema accepts optional failureAnalysisId/selfHealingId leaf fields', () => {
  const runId = freshRunId();
  try {
    upsertRequirement(runId, 'REQ-1', {
      testCaseIds: ['TC-1-01'],
      lastExecution: { 'TC-1-01': { runId, status: 'failed', failureAnalysisId: 'FA-1-01', selfHealingId: 'SH-1-01' } },
    }, 'orchestrator');

    const manifest = loadManifest(runId);
    const execEntry = manifest.requirements['REQ-1'].lastExecution['TC-1-01'];
    expect(execEntry.failureAnalysisId).toBe('FA-1-01');
    expect(execEntry.selfHealingId).toBe('SH-1-01');
  } finally {
    cleanupRun(runId);
  }
});

test('an entry with no failureAnalysisId/selfHealingId (the common case: a passing test) still validates', () => {
  const runId = freshRunId();
  try {
    upsertRequirement(runId, 'REQ-1', {
      testCaseIds: ['TC-1-01'],
      lastExecution: { 'TC-1-01': { runId, status: 'passed' } },
    }, 'orchestrator');
    const manifest = loadManifest(runId);
    expect(manifest.requirements['REQ-1'].lastExecution['TC-1-01'].failureAnalysisId).toBeUndefined();
  } finally {
    cleanupRun(runId);
  }
});

test('every artifact carries a stable id usable as a traceability key', () => {
  const runId = freshRunId();
  try {
    const { artifact } = artifactStore.writeArtifact(runId, 'requirements', 'REQ-STABLE', {
      title: 'Stable', acceptanceCriteria: ['x'], sourceRef: 's', sourceType: 'synthetic', ambiguities: [], missingInformation: [],
    });
    expect(artifact.id).toBe('REQ-STABLE');
    const reread = artifactStore.readArtifact(runId, 'requirements', 'REQ-STABLE');
    expect(reread.id).toBe(artifact.id);
  } finally {
    cleanupRun(runId);
  }
});
