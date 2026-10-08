// PHASE 4, A4 (risk-based test selection). Combines only real, available evidence into a
// 0-1 risk score. Any factor with no real evidence source stays `null` in both the score
// average and the `unknownFactors` list -- it is never guessed or defaulted to a value that
// would silently bias the score. If every factor is unknown, the overall score is `null`
// (cannot be computed), not zero.
//
// Evidence sources reused from elsewhere in the framework:
//  - criticality: the test case's own `priority`/`highRiskCategory` (test-case.schema.json)
//  - historicalFailureRate: real cross-run history via
//    `.framework/agents/gap-analysis.js`'s `getExecutionHistoryForTestCase`
//  - flaky: the same history, requires at least 2 data points to be knowable at all
//  - recentChangeDetected / regressionImpacted: optional caller-supplied booleans (e.g. from
//    A2 impact-analysis or regression.js) -- `null` when the caller has no such evidence yet
//  - defectHistory: not modeled anywhere in this framework (no defect-tracking data source
//    exists) -- always `null`, documented rather than fabricated

function criticalityFactor(testCase) {
  if (testCase.data.highRiskCategory) return 1;
  const priorityScore = { P1: 1, P2: 0.66, P3: 0.33, P4: 0 };
  return priorityScore[testCase.data.priority] ?? null;
}

function historicalFailureRateFactor(history) {
  if (!history || history.length === 0) return null;
  const failures = history.filter((h) => h.result === 'failed').length;
  return Number((failures / history.length).toFixed(2));
}

function flakyFactor(history) {
  if (!history || history.length < 2) return null; // never guessed from fewer than 2 data points
  const distinct = new Set(history.map((h) => h.result));
  return distinct.size > 1 ? 1 : 0;
}

function boolToFactor(value) {
  return typeof value === 'boolean' ? (value ? 1 : 0) : null;
}

function computeRiskScore(testCase, {
  history = null,
  recentChangeDetected = null,
  regressionImpacted = null,
} = {}) {
  const factors = {
    criticality: criticalityFactor(testCase),
    historicalFailureRate: historicalFailureRateFactor(history),
    flaky: flakyFactor(history),
    recentChangeDetected: boolToFactor(recentChangeDetected),
    regressionImpacted: boolToFactor(regressionImpacted),
    defectHistory: null, // not modeled in this framework -- always unknown, never fabricated
  };

  const known = Object.entries(factors).filter(([, v]) => v !== null);
  const unknownFactors = Object.entries(factors).filter(([, v]) => v === null).map(([k]) => k);
  const score = known.length > 0
    ? Number((known.reduce((sum, [, v]) => sum + v, 0) / known.length).toFixed(2))
    : null;

  return { score, factors, unknownFactors };
}

module.exports = { computeRiskScore, criticalityFactor, historicalFailureRateFactor, flakyFactor };
