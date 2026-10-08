// PHASE 2 — Generic Framework Completion & End-to-End Validation.
//
// Broader robustness checks beyond the single-run dry-run-pipeline.spec.js: real multi-run
// history (not hand-crafted fixtures), real concurrent runs, and artifact-store scale. No real
// application involved -- still entirely the synthetic demo dataset from Phase 1, run multiple
// times and in parallel to prove the plumbing (not the demo content) holds up.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const artifactStore = require('../../.framework/lib/artifact-store');
const { runDryRunPipeline } = require('../../.framework/agents/orchestrator');
const { computeFlakyTests } = require('../../.framework/agents/gap-analysis');

const createdRuns = [];
const createdReportDirs = [];

async function runPipelineTracked() {
  const result = await runDryRunPipeline({});
  createdRuns.push(result.runId);
  createdReportDirs.push(result.reportsDir);
  return result;
}

test.afterAll(() => {
  for (const runId of createdRuns) fs.rmSync(artifactStore.runDir(runId), { recursive: true, force: true });
  for (const dir of createdReportDirs) if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
});

test('two real, sequential pipeline runs both succeed and are not flagged flaky (consistent real results)', async ({}, testInfo) => {
  testInfo.setTimeout(120000);
  const first = await runPipelineTracked();
  const second = await runPipelineTracked();

  expect(first.runId).not.toBe(second.runId);

  const flaky = computeFlakyTests(['TC-DEMO-1-01'], { runIds: [first.runId, second.runId] });
  expect(flaky).toEqual([]); // both real runs passed -- consistent, not flaky
});

test('two real pipeline runs executed concurrently do not cross-contaminate each other\'s artifacts', async ({}, testInfo) => {
  testInfo.setTimeout(120000);
  const [runA, runB] = await Promise.all([runPipelineTracked(), runPipelineTracked()]);

  expect(runA.runId).not.toBe(runB.runId);

  const execA = artifactStore.listArtifacts(runA.runId, 'execution');
  const execB = artifactStore.listArtifacts(runB.runId, 'execution');
  for (const artifact of execA) expect(artifact.runId).toBe(runA.runId);
  for (const artifact of execB) expect(artifact.runId).toBe(runB.runId);

  // Each run's own manifest only knows about its own run id.
  const { loadManifest } = require('../../.framework/lib/manifest');
  const manifestA = loadManifest(runA.runId);
  const manifestB = loadManifest(runB.runId);
  expect(manifestA.runId).toBe(runA.runId);
  expect(manifestB.runId).toBe(runB.runId);
});

test('artifact store handles a high volume of artifacts in a single run without error', () => {
  const runId = `run-test-stress-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  artifactStore.ensureRun(runId);
  try {
    const COUNT = 200;
    for (let i = 0; i < COUNT; i += 1) {
      artifactStore.writeArtifact(runId, 'test-data', `TD-STRESS-${i}`, {
        testCaseId: `TC-STRESS-${i}`,
        generationMethod: 'synthetic',
        seed: null,
        payload: { index: i },
        setup: [],
        teardown: ['no-op'],
        environmentTarget: 'non-production',
      });
    }
    const all = artifactStore.listArtifacts(runId, 'test-data');
    expect(all.length).toBe(COUNT);
    expect(new Set(all.map((a) => a.id)).size).toBe(COUNT); // all unique, none clobbered
  } finally {
    fs.rmSync(artifactStore.runDir(runId), { recursive: true, force: true });
  }
});
