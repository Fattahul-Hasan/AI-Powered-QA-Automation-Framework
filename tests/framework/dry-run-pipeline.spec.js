// End-to-end dry-run pipeline test (ARCHITECTURE.md Section 27). Runs the real orchestrator
// once (real Playwright execution for TC-DEMO-1-01, real discovery against the public demo
// target, synthetic fixtures for the failure/self-healing/independent-regression paths) and
// asserts every phase produced real, schema-valid artifacts, and that both the pass and fail
// branches were genuinely exercised.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const artifactStore = require('../../.framework/lib/artifact-store');
const { runDryRunPipeline } = require('../../.framework/agents/orchestrator');

test.describe.configure({ mode: 'serial' });

let pipelineResult;

test.beforeAll(async () => {
  test.setTimeout(120000);
  pipelineResult = await runDryRunPipeline({});
});

test.afterAll(() => {
  if (!pipelineResult) return;
  fs.rmSync(artifactStore.runDir(pipelineResult.runId), { recursive: true, force: true });
  const reportsDir = path.join(__dirname, '..', '..', 'reports', pipelineResult.runId);
  if (fs.existsSync(reportsDir)) fs.rmSync(reportsDir, { recursive: true, force: true });
});

test('produces requirement artifacts, including a flagged ambiguous requirement', () => {
  const requirements = artifactStore.listArtifacts(pipelineResult.runId, 'requirements');
  const ids = requirements.map((r) => r.id);
  expect(ids).toContain('REQ-DEMO-1');
  expect(ids).toContain('REQ-DEMO-2');
  expect(ids).toContain('REQ-DEMO-3');
  const ambiguous = requirements.find((r) => r.id === 'REQ-DEMO-3');
  expect(ambiguous.data.ambiguities.length).toBeGreaterThan(0);
});

test('produces a real discovery artifact from a live (public demo) Playwright pass', () => {
  const discovery = artifactStore.listArtifacts(pipelineResult.runId, 'discovery');
  expect(discovery.length).toBeGreaterThan(0);
  expect(discovery[0].data.environment).toBe('public-demo');
  expect(discovery[0].data.keyLocators.length).toBeGreaterThan(0);
});

test('designs test cases only for non-ambiguous requirements, skipping REQ-DEMO-3', () => {
  const testCases = artifactStore.listArtifacts(pipelineResult.runId, 'test-design');
  expect(testCases.some((tc) => tc.data.requirementId === 'REQ-DEMO-3')).toBe(false);
  expect(testCases.some((tc) => tc.data.requirementId === 'REQ-DEMO-1')).toBe(true);
});

test('links existing automation for TC-DEMO-1-01 and marks TC-DEMO-1-02 pending', () => {
  const automation = artifactStore.listArtifacts(pipelineResult.runId, 'automation');
  const linked = automation.find((a) => a.data.testCaseId === 'TC-DEMO-1-01');
  const pending = automation.find((a) => a.data.testCaseId === 'TC-DEMO-1-02');
  expect(linked.data.automationStatus).toBe('existing-linked');
  expect(linked.data.specFile).toBe('tests/home.spec.js');
  expect(pending.data.automationStatus).toBe('pending-automation');
});

test('really executes TC-DEMO-1-01 via Playwright CLI and it really passes', () => {
  const executions = artifactStore.listArtifacts(pipelineResult.runId, 'execution');
  const real = executions.find((e) => e.data.testCaseId === 'TC-DEMO-1-01');
  expect(real.data.source).toBe('real-playwright-run');
  expect(real.data.result).toBe('passed');
});

test('exercises the FAIL branch via the labeled synthetic fixture, correctly classified', () => {
  const analyses = artifactStore.listArtifacts(pipelineResult.runId, 'failure-analysis');
  const synthetic = analyses.find((a) => a.data.isSynthetic);
  expect(synthetic).toBeTruthy();
  expect(synthetic.data.category).toBe('selector-drift');
  expect(synthetic.data.recommendedNextAgent).toBe('self-healing');
});

test('self-healing produces a proposal that never touches an assertion and performs no real file write', () => {
  const proposals = artifactStore.listArtifacts(pipelineResult.runId, 'self-healing');
  expect(proposals.length).toBeGreaterThan(0);
  for (const p of proposals) {
    expect(p.data.assertionTouched).toBe(false);
    expect(p.data.realFileWritePerformed).toBe(false);
    expect(p.data.dryRun).toBe(true);
    for (const f of p.data.filesTouched) expect(f.startsWith('pages/')).toBe(true);
  }
});

test('every self-healing proposal preserves a real back-reference to the failure analysis that triggered it (PHASE 4, A6)', () => {
  const proposals = artifactStore.listArtifacts(pipelineResult.runId, 'self-healing');
  const analyses = artifactStore.listArtifacts(pipelineResult.runId, 'failure-analysis');
  const analysisIds = new Set(analyses.map((a) => a.id));
  expect(proposals.length).toBeGreaterThan(0);
  for (const p of proposals) {
    expect(p.data.sourceFailureAnalysisId).toBeTruthy();
    expect(analysisIds.has(p.data.sourceFailureAnalysisId)).toBe(true);
  }
});

test('all three self-healing confidence tiers are exercised with the correct decision each', () => {
  const proposals = artifactStore.listArtifacts(pipelineResult.runId, 'self-healing');
  const byConfidence = Object.fromEntries(proposals.map((p) => [p.data.confidence, p.data]));

  expect(byConfidence.high.decision).toBe('auto-applied-locally-pending-merge-review');
  expect(byConfidence.high.filesTouched.length).toBeGreaterThan(0);
  expect(byConfidence.high.proposedDiff).toContain('searchButton');

  expect(byConfidence.medium.decision).toBe('pending-approval');
  expect(byConfidence.medium.filesTouched.length).toBeGreaterThan(0);

  expect(byConfidence.low.decision).toBe('no-change-proposed');
  expect(byConfidence.low.filesTouched).toEqual([]);
  expect(byConfidence.low.proposedDiff).toContain('No diff generated');
});

test('gap analysis finds the deliberately uncovered requirement and the pending automation', () => {
  const gaps = artifactStore.listArtifacts(pipelineResult.runId, 'gap-analysis')[0];
  expect(gaps.data.requirementsWithoutTests).toContain('REQ-DEMO-2');
  expect(gaps.data.testCasesWithoutAutomation).toContain('TC-DEMO-1-02');
  expect(gaps.data.stalenessWindowDays).toBe(14);
});

test('regression is exercised via both the standard tail and the independent synthetic MR trigger', () => {
  const regressions = artifactStore.listArtifacts(pipelineResult.runId, 'regression');
  const triggers = regressions.map((r) => r.data.trigger);
  expect(triggers).toContain('standard-tail');
  expect(triggers).toContain('independent-mr-trigger');
  const mrTriggered = regressions.find((r) => r.data.trigger === 'independent-mr-trigger');
  expect(mrTriggered.data.impactedTestIds).toContain('TC-DEMO-1-01'); // real impact mapping via pages/HomePage.js
});

test('reporting produces a schema-valid summary and a traceability document on disk', () => {
  expect(pipelineResult.report.data.totals.requirements).toBeGreaterThanOrEqual(3);
  expect(fs.existsSync(path.join(pipelineResult.reportsDir, 'summary.json'))).toBe(true);
  expect(fs.existsSync(path.join(pipelineResult.reportsDir, 'traceability.md'))).toBe(true);
});

test('the orchestrator, and only the orchestrator, wrote the traceability manifest', () => {
  const { loadManifest } = require('../../.framework/lib/manifest');
  const manifest = loadManifest(pipelineResult.runId);
  expect(manifest.requirements['REQ-DEMO-1']).toBeTruthy();
  expect(manifest.requirements['REQ-DEMO-1'].automation['TC-DEMO-1-01']).toBe('tests/home.spec.js');
});

test('the manifest links a test case to its real failure-analysis/self-healing artifacts (PHASE 4, A11)', () => {
  const { loadManifest } = require('../../.framework/lib/manifest');
  const manifest = loadManifest(pipelineResult.runId);
  const execEntry = manifest.requirements['REQ-DEMO-1'].lastExecution['TC-DEMO-1-02'];
  expect(execEntry.failureAnalysisId).toBeTruthy();
  expect(execEntry.selfHealingId).toBeTruthy();

  const analyses = artifactStore.listArtifacts(pipelineResult.runId, 'failure-analysis');
  const healings = artifactStore.listArtifacts(pipelineResult.runId, 'self-healing');
  expect(analyses.some((a) => a.id === execEntry.failureAnalysisId)).toBe(true);
  expect(healings.some((h) => h.id === execEntry.selfHealingId)).toBe(true);
});

test('a passing test case (no failure) has no failureAnalysisId/selfHealingId in the manifest -- never fabricated', () => {
  const { loadManifest } = require('../../.framework/lib/manifest');
  const manifest = loadManifest(pipelineResult.runId);
  const execEntry = manifest.requirements['REQ-DEMO-1'].lastExecution['TC-DEMO-1-01'];
  expect(execEntry.status).toBe('passed');
  expect(execEntry.failureAnalysisId).toBeUndefined();
  expect(execEntry.selfHealingId).toBeUndefined();
});

test('the orchestrator really fires a pipeline-completed notification carrying the real report totals (PHASE 5, B11)', async () => {
  test.setTimeout(120000);
  const received = [];
  let secondRunId;
  try {
    const result = await runDryRunPipeline({
      notifyAdapter: (event, payload) => received.push({ event, payload }),
    });
    secondRunId = result.runId;
    expect(received.length).toBe(1);
    expect(received[0].event).toBe('pipeline-completed');
    expect(received[0].payload.runId).toBe(secondRunId);
    expect(received[0].payload.totals).toEqual(result.report.data.totals);
  } finally {
    if (secondRunId) {
      fs.rmSync(artifactStore.runDir(secondRunId), { recursive: true, force: true });
      const reportsDir = path.join(__dirname, '..', '..', 'reports', secondRunId);
      if (fs.existsSync(reportsDir)) fs.rmSync(reportsDir, { recursive: true, force: true });
    }
  }
});

test('a broken notification adapter never fails the pipeline -- the run result is unaffected (PHASE 5, B11)', async () => {
  test.setTimeout(120000);
  let thirdRunId;
  try {
    const result = await runDryRunPipeline({
      notifyAdapter: () => { throw new Error('simulated notification-delivery failure'); },
    });
    thirdRunId = result.runId;
    expect(result.report.data.totals.requirements).toBeGreaterThanOrEqual(3);
  } finally {
    if (thirdRunId) {
      fs.rmSync(artifactStore.runDir(thirdRunId), { recursive: true, force: true });
      const reportsDir = path.join(__dirname, '..', '..', 'reports', thirdRunId);
      if (fs.existsSync(reportsDir)) fs.rmSync(reportsDir, { recursive: true, force: true });
    }
  }
});
