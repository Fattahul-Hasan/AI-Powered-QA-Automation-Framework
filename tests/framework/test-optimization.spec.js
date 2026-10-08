// PHASE 4, A9 (test optimization): recommendations only, backed strictly by real evidence.

const { test, expect } = require('@playwright/test');
const { recommendOptimizations } = require('../../.framework/lib/test-optimization');

test('happy path: redundant (exact + near), expensive, and unstable are all populated from real evidence', () => {
  const result = recommendOptimizations({
    duplicates: [{ originalId: 'TC-1', duplicate: { id: 'TC-2' } }],
    similarPairs: [{ testCaseIds: ['TC-3', 'TC-4'], similarityScore: 0.95 }],
    durations: { 'TC-5': 9000, 'TC-6': 100 },
    expensiveDurationThresholdMs: 5000,
    flakyIds: ['TC-7'],
  });
  expect(result.redundant.length).toBe(2);
  expect(result.expensive).toEqual([{ testCaseId: 'TC-5', durationMs: 9000 }]);
  expect(result.unstable).toEqual([{ testCaseId: 'TC-7', reason: 'recently-flaky' }]);
});

test('empty evidence produces empty recommendations, never fabricated ones', () => {
  const result = recommendOptimizations();
  expect(result.redundant).toEqual([]);
  expect(result.expensive).toEqual([]);
  expect(result.unstable).toEqual([]);
});

test('overlappingCoverage and lowValue are always reported as not computed, with a reason, never fabricated', () => {
  const result = recommendOptimizations();
  const categories = result.notComputed.map((n) => n.category);
  expect(categories).toEqual(['overlappingCoverage', 'lowValue']);
  for (const entry of result.notComputed) {
    expect(entry.reason.length).toBeGreaterThan(0);
  }
});

test('a duration exactly at the threshold is flagged (boundary), one below is not', () => {
  const result = recommendOptimizations({
    durations: { 'TC-AT': 5000, 'TC-BELOW': 4999 },
    expensiveDurationThresholdMs: 5000,
  });
  expect(result.expensive.map((e) => e.testCaseId)).toEqual(['TC-AT']);
});

test('durations supplied without an explicit threshold throws rather than silently defaulting', () => {
  expect(() => recommendOptimizations({ durations: { 'TC-1': 100 } })).toThrow(/explicit expensiveDurationThresholdMs/);
});

test('durations omitted entirely does not require a threshold', () => {
  expect(() => recommendOptimizations({ flakyIds: ['TC-1'] })).not.toThrow();
});

test('deterministic: identical input produces identical output', () => {
  const input = { flakyIds: ['TC-1', 'TC-2'], durations: { 'TC-3': 100 }, expensiveDurationThresholdMs: 50 };
  expect(recommendOptimizations(input)).toEqual(recommendOptimizations(input));
});
