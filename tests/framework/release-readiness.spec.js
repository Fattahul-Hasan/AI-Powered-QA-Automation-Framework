// PHASE 5, B8 (release readiness): exactly PASS/FAIL/BLOCKED/INSUFFICIENT EVIDENCE. Missing
// evidence must never resolve to PASS.

const { test, expect } = require('@playwright/test');
const { computeReleaseReadiness, STATUS } = require('../../.framework/lib/release-readiness');

test('PASS: all evidence present, gates passed, nothing pending, no critical gaps', () => {
  const result = computeReleaseReadiness({
    qualityGateResult: { passed: true, failedGates: [] },
    pendingHumanApprovals: 0,
    criticalRequirementGaps: 0,
  });
  expect(result.status).toBe(STATUS.PASS);
});

test('FAIL: evidence present but a quality gate failed', () => {
  const result = computeReleaseReadiness({
    qualityGateResult: { passed: false, failedGates: ['passRate'] },
    pendingHumanApprovals: 0,
    criticalRequirementGaps: 0,
  });
  expect(result.status).toBe(STATUS.FAIL);
  expect(result.reason).toContain('passRate');
});

test('BLOCKED: pending human approvals, even if quality gates would otherwise pass', () => {
  const result = computeReleaseReadiness({
    qualityGateResult: { passed: true, failedGates: [] },
    pendingHumanApprovals: 2,
    criticalRequirementGaps: 0,
  });
  expect(result.status).toBe(STATUS.BLOCKED);
});

test('BLOCKED: critical requirement gaps, even if quality gates would otherwise pass', () => {
  const result = computeReleaseReadiness({
    qualityGateResult: { passed: true, failedGates: [] },
    pendingHumanApprovals: 0,
    criticalRequirementGaps: 1,
  });
  expect(result.status).toBe(STATUS.BLOCKED);
});

test('INSUFFICIENT EVIDENCE: any single missing input, never resolved to PASS', () => {
  expect(computeReleaseReadiness({}).status).toBe(STATUS.INSUFFICIENT_EVIDENCE);
  expect(computeReleaseReadiness({ qualityGateResult: { passed: true, failedGates: [] } }).status).toBe(STATUS.INSUFFICIENT_EVIDENCE);
  expect(computeReleaseReadiness({
    qualityGateResult: { passed: true, failedGates: [] },
    pendingHumanApprovals: 0,
    // criticalRequirementGaps intentionally omitted
  }).status).toBe(STATUS.INSUFFICIENT_EVIDENCE);
});

test('BLOCKED takes precedence over FAIL when both conditions are true', () => {
  const result = computeReleaseReadiness({
    qualityGateResult: { passed: false, failedGates: ['passRate'] },
    pendingHumanApprovals: 1,
    criticalRequirementGaps: 0,
  });
  expect(result.status).toBe(STATUS.BLOCKED);
});

test('deterministic: identical input produces identical output', () => {
  const evidence = { qualityGateResult: { passed: true, failedGates: [] }, pendingHumanApprovals: 0, criticalRequirementGaps: 0 };
  expect(computeReleaseReadiness(evidence)).toEqual(computeReleaseReadiness(evidence));
});
