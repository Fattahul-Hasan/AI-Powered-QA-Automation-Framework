// PHASE 5, B7/B8 -- real evidence wiring. Closes the gap between "a tested model exists" and
// "the model is actually usable against a real run": extracts real metrics from a run's actual
// artifacts (Reporting, Gap Analysis, Self-Healing, Requirements) into exactly the shape
// `evaluateGates()`/`computeReleaseReadiness()` expect. Never invents a metric -- a value with
// no real source in the run's artifacts is simply absent, letting the downstream "missing
// evidence never resolves to PASS" rule handle it honestly. Quality thresholds are still always
// caller-supplied (never invented here either); omitting them yields INSUFFICIENT EVIDENCE by
// design, consistent with B7's "no organization-specific number baked in."

const { listArtifacts } = require('./artifact-store');
const { evaluateGates } = require('./quality-gates');
const { computeReleaseReadiness } = require('./release-readiness');

const HIGH_RISK_CATEGORIES = new Set([
  'Payments', 'PII / Sensitive Data', 'User Account Deletion', 'Financial Transactions', 'Authentication / Authorization',
]);

// Metrics on the same scales evaluateGates' comparators already assume: passRate as a 0-1
// ratio; coveragePercent/automationHealthPercent as 0-100 (matching reporting.js's own scale);
// criticalFailures/flakyCount as raw counts.
function extractMetrics(runId) {
  const report = listArtifacts(runId, 'reporting')[0];
  const gapAnalysis = listArtifacts(runId, 'gap-analysis')[0];
  const metrics = {};

  if (report) {
    const { totals, automationCoveragePercent } = report.data;
    if (totals.executed > 0) {
      metrics.passRate = Number((totals.passed / totals.executed).toFixed(2));
      metrics.criticalFailures = totals.failed;
    }
    metrics.coveragePercent = automationCoveragePercent;
    metrics.automationHealthPercent = automationCoveragePercent;
  }
  if (gapAnalysis) {
    metrics.flakyCount = gapAnalysis.data.flakyTests.length;
  }
  return metrics;
}

// Real, countable "awaiting a human" evidence: ambiguous requirements (Section Q gate #1) and
// self-healing proposals still pending approval (gate #6). Never guesses at unconfirmed state.
function extractPendingApprovals(runId) {
  const ambiguousRequirements = listArtifacts(runId, 'requirements').filter((r) => r.data.ambiguities.length > 0).length;
  const pendingHealing = listArtifacts(runId, 'self-healing').filter((h) => h.data.decision === 'pending-approval').length;
  return ambiguousRequirements + pendingHealing;
}

// Real count of high-risk-category requirements Gap Analysis already found uncovered -- reuses
// the same highRiskCategory classification Test Design already enforces (ARCHITECTURE.md
// Section 9, Decision 6), not a new/duplicate risk taxonomy.
function extractCriticalRequirementGaps(runId) {
  const gapAnalysis = listArtifacts(runId, 'gap-analysis')[0];
  if (!gapAnalysis) return null; // no gap analysis has run yet -- genuinely unknown, not zero
  const highRiskRequirementIds = new Set(
    listArtifacts(runId, 'requirements')
      .filter((r) => HIGH_RISK_CATEGORIES.has(r.data.highRiskCategory))
      .map((r) => r.id),
  );
  return gapAnalysis.data.requirementsWithoutTests.filter((id) => highRiskRequirementIds.has(id)).length;
}

// `qualityThresholds` is optional and intentionally so: without it, `qualityGateResult` stays
// `undefined`, which `computeReleaseReadiness` correctly resolves to INSUFFICIENT EVIDENCE --
// this module never substitutes a default threshold set to force a PASS/FAIL verdict.
function evaluateReleaseReadinessForRun(runId, qualityThresholds) {
  const metrics = extractMetrics(runId);
  const qualityGateResult = qualityThresholds ? evaluateGates(metrics, qualityThresholds) : undefined;
  const pendingHumanApprovals = extractPendingApprovals(runId);
  const criticalRequirementGaps = extractCriticalRequirementGaps(runId);

  const readiness = computeReleaseReadiness({ qualityGateResult, pendingHumanApprovals, criticalRequirementGaps });
  return { runId, metrics, qualityGateResult, pendingHumanApprovals, criticalRequirementGaps, readiness };
}

module.exports = { extractMetrics, extractPendingApprovals, extractCriticalRequirementGaps, evaluateReleaseReadinessForRun };
