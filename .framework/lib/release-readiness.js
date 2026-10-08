// PHASE 5, B8 (release readiness). Exactly four possible statuses. Missing evidence is checked
// FIRST and unconditionally returns INSUFFICIENT EVIDENCE -- there is no code path where an
// absent input can fall through to PASS.

const STATUS = Object.freeze({
  PASS: 'PASS',
  FAIL: 'FAIL',
  BLOCKED: 'BLOCKED',
  INSUFFICIENT_EVIDENCE: 'INSUFFICIENT EVIDENCE',
});

function computeReleaseReadiness({
  qualityGateResult,
  pendingHumanApprovals,
  criticalRequirementGaps,
} = {}) {
  if (
    qualityGateResult === undefined || qualityGateResult === null
    || pendingHumanApprovals === undefined || pendingHumanApprovals === null
    || criticalRequirementGaps === undefined || criticalRequirementGaps === null
  ) {
    return { status: STATUS.INSUFFICIENT_EVIDENCE, reason: 'One or more required evidence inputs (qualityGateResult, pendingHumanApprovals, criticalRequirementGaps) are missing.' };
  }

  if (pendingHumanApprovals > 0) {
    return { status: STATUS.BLOCKED, reason: `${pendingHumanApprovals} item(s) awaiting human approval.` };
  }
  if (criticalRequirementGaps > 0) {
    return { status: STATUS.BLOCKED, reason: `${criticalRequirementGaps} critical requirement(s) have coverage gaps.` };
  }
  if (!qualityGateResult.passed) {
    return { status: STATUS.FAIL, reason: `Quality gates failed: ${(qualityGateResult.failedGates || []).join(', ')}` };
  }
  return { status: STATUS.PASS, reason: 'All quality gates passed; no blocking approvals or critical gaps.' };
}

module.exports = { computeReleaseReadiness, STATUS };
