// PHASE 4, A3 (intelligent test selection). Deterministic, evidence-based selection with an
// explicit reason recorded for every selected test -- no hidden or random selection. Every
// signal is optional and defaults to empty/absent; a test is selected only when at least one
// real piece of evidence says so.

const DEFAULT_RISK_THRESHOLD = 0.7;

function selectTests({
  impactedTestIds = [],
  smokeBaselineIds = [],
  riskScores = {}, // testId -> number (0-1) | null
  riskThreshold = DEFAULT_RISK_THRESHOLD,
  flakyIds = [],
  tags = {}, // testId -> string[]
  includeTags = [],
} = {}) {
  const reasons = {};
  const addReason = (testId, reason) => {
    if (testId === undefined || testId === null) return;
    if (!reasons[testId]) reasons[testId] = [];
    reasons[testId].push(reason);
  };

  for (const id of impactedTestIds) addReason(id, 'impacted-by-change');
  for (const id of smokeBaselineIds) addReason(id, 'smoke-baseline');
  for (const [id, score] of Object.entries(riskScores)) {
    if (typeof score === 'number' && score >= riskThreshold) addReason(id, `high-risk-score:${score}`);
  }
  for (const id of flakyIds) addReason(id, 'recently-flaky-stability-check');
  for (const [id, testTags] of Object.entries(tags)) {
    const matched = (testTags || []).filter((t) => includeTags.includes(t));
    if (matched.length > 0) addReason(id, `matched-tag:${matched.join(',')}`);
  }

  return { selectedTestIds: Object.keys(reasons).sort(), reasons };
}

module.exports = { selectTests, DEFAULT_RISK_THRESHOLD };
