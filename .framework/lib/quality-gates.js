// PHASE 5, B7 (quality gates). Thresholds are ALWAYS caller-supplied -- this module never
// bakes in an organization-specific "real" number. A metric that's missing is treated as a
// failing/unknown gate, never silently treated as passing.

function evaluateGate(metricValue, threshold, comparator) {
  if (typeof metricValue !== 'number') {
    return { passed: false, reason: 'metric value missing or not a number -- treated as failing, never assumed passing' };
  }
  const passed = comparator(metricValue, threshold);
  return { passed, reason: passed ? null : `metric ${metricValue} did not satisfy threshold ${threshold}` };
}

// `metrics` and `thresholds` are both required, and each threshold key must have a
// corresponding comparator in GATE_COMPARATORS -- an unrecognized gate name is an explicit
// error, not silently skipped.
const GATE_COMPARATORS = {
  passRate: (value, threshold) => value >= threshold,
  criticalFailures: (value, threshold) => value <= threshold,
  regressionPassRate: (value, threshold) => value >= threshold,
  coveragePercent: (value, threshold) => value >= threshold,
  flakyCount: (value, threshold) => value <= threshold,
  automationHealthPercent: (value, threshold) => value >= threshold,
};

function evaluateGates(metrics, thresholds) {
  if (!thresholds || Object.keys(thresholds).length === 0) {
    throw new Error('evaluateGates requires an explicit, non-empty thresholds object -- no default thresholds are assumed.');
  }

  const gateResults = {};
  for (const [gateName, threshold] of Object.entries(thresholds)) {
    const comparator = GATE_COMPARATORS[gateName];
    if (!comparator) {
      throw new Error(`Unknown quality gate "${gateName}". Known gates: ${Object.keys(GATE_COMPARATORS).join(', ')}`);
    }
    gateResults[gateName] = evaluateGate(metrics ? metrics[gateName] : undefined, threshold, comparator);
  }

  const failedGates = Object.entries(gateResults).filter(([, r]) => !r.passed).map(([name]) => name);
  return { passed: failedGates.length === 0, gateResults, failedGates };
}

module.exports = { evaluateGates, GATE_COMPARATORS };
