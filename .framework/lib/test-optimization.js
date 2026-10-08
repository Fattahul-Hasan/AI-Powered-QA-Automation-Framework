// PHASE 4, A9 (test optimization). Recommendations only -- never auto-removes or auto-modifies
// a test. Built strictly from real, already-computed evidence elsewhere in the framework:
// `redundant` from test-design.js's detectDuplicates/findSimilarTestCases output, `expensive`
// from real execution durationMs values, `unstable` from gap-analysis.js's flaky-test ids.
//
// `overlappingCoverage` and `lowValue` (both explicitly mentioned in the Phase 4 ask) are
// deliberately NOT computed: this framework has no data model for test-execution-path overlap,
// and no defined evidence source for "low value". Fabricating either would violate "recommend
// only from actual evidence" -- they are reported as `notComputed` with the reason, not silently
// omitted.

function recommendOptimizations({
  duplicates = [],
  similarPairs = [],
  durations = {},
  expensiveDurationThresholdMs,
  flakyIds = [],
} = {}) {
  if (Object.keys(durations).length > 0 && typeof expensiveDurationThresholdMs !== 'number') {
    throw new Error('recommendOptimizations requires an explicit expensiveDurationThresholdMs when durations are supplied -- no default is assumed.');
  }

  const redundant = [
    ...duplicates.map((d) => ({ testCaseIds: [d.originalId, d.duplicate.id], reason: 'exact-duplicate' })),
    ...similarPairs.map((p) => ({ testCaseIds: p.testCaseIds, reason: `near-duplicate (similarity ${p.similarityScore})` })),
  ];

  const expensive = Object.entries(durations)
    .filter(([, ms]) => typeof ms === 'number' && ms >= expensiveDurationThresholdMs)
    .map(([testCaseId, durationMs]) => ({ testCaseId, durationMs }));

  const unstable = flakyIds.map((id) => ({ testCaseId: id, reason: 'recently-flaky' }));

  return {
    redundant,
    expensive,
    unstable,
    notComputed: [
      { category: 'overlappingCoverage', reason: 'No test-execution-path-overlap data model exists in this framework.' },
      { category: 'lowValue', reason: 'No defined evidence source for "low value" exists in this framework.' },
    ],
  };
}

module.exports = { recommendOptimizations };
