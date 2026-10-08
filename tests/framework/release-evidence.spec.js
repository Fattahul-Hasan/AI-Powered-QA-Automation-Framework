// PHASE 5, B7/B8 real-evidence wiring: extracts metrics from real run artifacts, never invents
// one, and never substitutes a default threshold set.

const fs = require('fs');
const { test, expect } = require('@playwright/test');
const artifactStore = require('../../.framework/lib/artifact-store');
const {
  extractMetrics, extractPendingApprovals, extractCriticalRequirementGaps, evaluateReleaseReadinessForRun,
} = require('../../.framework/lib/release-evidence');
const { STATUS } = require('../../.framework/lib/release-readiness');

function freshRunId(label) {
  return `run-test-release-evidence-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test('extractMetrics is honestly empty when no reporting/gap-analysis artifact exists yet', () => {
  const runId = freshRunId('empty');
  artifactStore.ensureRun(runId);
  try {
    expect(extractMetrics(runId)).toEqual({});
  } finally {
    fs.rmSync(artifactStore.runDir(runId), { recursive: true, force: true });
  }
});

test('extractMetrics computes real passRate/criticalFailures/coverage from a real reporting artifact', () => {
  const runId = freshRunId('metrics');
  artifactStore.ensureRun(runId);
  try {
    artifactStore.writeArtifact(runId, 'reporting', 'RPT-1', {
      generatedAt: new Date().toISOString(),
      totals: { requirements: 1, testCases: 2, automated: 1, executed: 2, passed: 1, failed: 1, skipped: 0 },
      automationCoveragePercent: 50,
      gapAnalysisRef: 'none',
      auditLogRef: '/tmp/audit.jsonl',
    });
    const metrics = extractMetrics(runId);
    expect(metrics.passRate).toBe(0.5);
    expect(metrics.criticalFailures).toBe(1);
    expect(metrics.coveragePercent).toBe(50);
    expect(metrics.automationHealthPercent).toBe(50);
  } finally {
    fs.rmSync(artifactStore.runDir(runId), { recursive: true, force: true });
  }
});

test('extractPendingApprovals counts real ambiguous requirements and pending self-healing proposals', () => {
  const runId = freshRunId('pending');
  artifactStore.ensureRun(runId);
  try {
    artifactStore.writeArtifact(runId, 'requirements', 'REQ-AMBIG', {
      title: 'x', acceptanceCriteria: [], sourceRef: 's', sourceType: 'synthetic',
      ambiguities: ['unclear'], missingInformation: [],
    });
    artifactStore.writeArtifact(runId, 'self-healing', 'SH-1', {
      testId: 'TC-1', proposedDiff: 'd', confidence: 'medium', filesTouched: ['pages/X.js'],
      assertionTouched: false, changeScope: 'locator-level', rerunResult: 'not-run',
      decision: 'pending-approval', dryRun: true, realFileWritePerformed: false, mrOpened: false, mergeApprovedByHuman: false,
    });
    expect(extractPendingApprovals(runId)).toBe(2);
  } finally {
    fs.rmSync(artifactStore.runDir(runId), { recursive: true, force: true });
  }
});

test('extractCriticalRequirementGaps is null (genuinely unknown) when gap analysis has not run yet', () => {
  const runId = freshRunId('no-gap');
  artifactStore.ensureRun(runId);
  try {
    expect(extractCriticalRequirementGaps(runId)).toBeNull();
  } finally {
    fs.rmSync(artifactStore.runDir(runId), { recursive: true, force: true });
  }
});

test('evaluateReleaseReadinessForRun without thresholds yields INSUFFICIENT EVIDENCE -- never a default-threshold PASS', () => {
  const runId = freshRunId('no-thresholds');
  artifactStore.ensureRun(runId);
  try {
    artifactStore.writeArtifact(runId, 'gap-analysis', 'GAP-1', {
      requirementsWithoutTests: [], testCasesWithoutAutomation: [], staleAutomation: [], stalenessWindowDays: 14, flakyTests: [],
    });
    const result = evaluateReleaseReadinessForRun(runId);
    expect(result.readiness.status).toBe(STATUS.INSUFFICIENT_EVIDENCE);
  } finally {
    fs.rmSync(artifactStore.runDir(runId), { recursive: true, force: true });
  }
});

test('evaluateReleaseReadinessForRun with real thresholds and clean evidence yields PASS', () => {
  const runId = freshRunId('pass');
  artifactStore.ensureRun(runId);
  try {
    artifactStore.writeArtifact(runId, 'reporting', 'RPT-1', {
      generatedAt: new Date().toISOString(),
      totals: { requirements: 1, testCases: 1, automated: 1, executed: 1, passed: 1, failed: 0, skipped: 0 },
      automationCoveragePercent: 100,
      gapAnalysisRef: 'GAP-1',
      auditLogRef: '/tmp/audit.jsonl',
    });
    artifactStore.writeArtifact(runId, 'gap-analysis', 'GAP-1', {
      requirementsWithoutTests: [], testCasesWithoutAutomation: [], staleAutomation: [], stalenessWindowDays: 14, flakyTests: [],
    });
    const result = evaluateReleaseReadinessForRun(runId, { passRate: 0.9 });
    expect(result.readiness.status).toBe(STATUS.PASS);
  } finally {
    fs.rmSync(artifactStore.runDir(runId), { recursive: true, force: true });
  }
});
