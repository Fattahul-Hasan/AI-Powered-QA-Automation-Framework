// PHASE 4, A12 (AI decision auditability). No new production code -- this validates that every
// decision-bearing capability already built (Failure Analysis, Self-Healing, Regression's
// selection reasons, Requirement Analysis's ambiguity flagging) genuinely exposes input
// evidence, decision, reason/confidence where applicable, output, and a run identifier, by
// running the real pipeline and inspecting its real artifacts and audit log -- never assumed
// from documentation.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const artifactStore = require('../../.framework/lib/artifact-store');
const { readAuditLog } = require('../../.framework/lib/audit');
const { runDryRunPipeline } = require('../../.framework/agents/orchestrator');

let pipelineResult;

test.beforeAll(async () => {
  test.setTimeout(120000);
  pipelineResult = await runDryRunPipeline({});
});

test.afterAll(() => {
  fs.rmSync(artifactStore.runDir(pipelineResult.runId), { recursive: true, force: true });
  const reportsDir = path.join(__dirname, '..', '..', 'reports', pipelineResult.runId);
  if (fs.existsSync(reportsDir)) fs.rmSync(reportsDir, { recursive: true, force: true });
});

test('every audit log record has a timestamp and an agent identity -- no opaque, unattributed entries', () => {
  const records = readAuditLog(pipelineResult.runId);
  expect(records.length).toBeGreaterThan(0);
  for (const record of records) {
    expect(record.timestamp).toBeTruthy();
    expect(record.agent).toBeTruthy();
  }
});

test('self-healing artifacts expose input evidence, decision, confidence, and output -- never opaque', () => {
  const proposals = artifactStore.listArtifacts(pipelineResult.runId, 'self-healing');
  expect(proposals.length).toBeGreaterThan(0);
  for (const p of proposals) {
    expect(p.runId).toBe(pipelineResult.runId); // run identifier
    expect(p.data.sourceFailureAnalysisId).toBeTruthy(); // input evidence (PHASE 4, A6/A11)
    expect(p.data.decision).toBeTruthy(); // decision
    expect(p.data.confidence).toBeTruthy(); // confidence
    expect(typeof p.data.proposedDiff).toBe('string'); // output
  }
});

test('failure-analysis artifacts expose input, decision (category), reason, and confidence', () => {
  const analyses = artifactStore.listArtifacts(pipelineResult.runId, 'failure-analysis');
  expect(analyses.length).toBeGreaterThan(0);
  for (const a of analyses) {
    expect(a.runId).toBe(pipelineResult.runId);
    expect(a.data.category).toBeTruthy(); // decision
    expect(a.data.confidence).toBeTruthy(); // confidence
    expect(a.data.suspectedRootCause).toBeTruthy(); // reason
  }
});

test('regression selection artifacts expose a reason for every selected test, not a bare id list', () => {
  const regressions = artifactStore.listArtifacts(pipelineResult.runId, 'regression');
  expect(regressions.length).toBeGreaterThan(0);
  for (const r of regressions) {
    for (const testId of r.data.selectedForExecution) {
      expect(r.data.selectionReasons[testId]).toBeTruthy();
      expect(r.data.selectionReasons[testId].length).toBeGreaterThan(0);
    }
  }
});

test('an ambiguous requirement exposes why it was flagged, not just that it was', () => {
  const requirements = artifactStore.listArtifacts(pipelineResult.runId, 'requirements');
  const ambiguous = requirements.find((r) => r.data.ambiguities.length > 0);
  expect(ambiguous).toBeTruthy();
  expect(ambiguous.data.ambiguities.every((a) => a.length > 0)).toBe(true);
});

test('self-healing audit records correlate with real self-healing artifacts (no orphaned or fabricated log entries)', () => {
  const records = readAuditLog(pipelineResult.runId).filter((r) => r.agent === 'self-healing');
  const proposals = artifactStore.listArtifacts(pipelineResult.runId, 'self-healing');
  expect(records.length).toBe(proposals.length);
  const proposalTestIds = new Set(proposals.map((p) => p.data.testId));
  for (const record of records) {
    expect(proposalTestIds.has(record.testId)).toBe(true);
  }
});
