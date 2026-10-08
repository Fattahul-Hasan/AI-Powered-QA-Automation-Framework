// PHASE 4, A3 (intelligent test selection): every selected test must have an explicit reason;
// no hidden or random selection.

const { test, expect } = require('@playwright/test');
const { selectTests, DEFAULT_RISK_THRESHOLD } = require('../../.framework/lib/test-selection');

test('happy path: all signal types present, each contributes its own reason', () => {
  const result = selectTests({
    impactedTestIds: ['TC-1'],
    smokeBaselineIds: ['TC-2'],
    riskScores: { 'TC-3': 0.9 },
    flakyIds: ['TC-4'],
    tags: { 'TC-5': ['api'] },
    includeTags: ['api'],
  });
  expect(result.selectedTestIds).toEqual(['TC-1', 'TC-2', 'TC-3', 'TC-4', 'TC-5']);
  expect(result.reasons['TC-1']).toContain('impacted-by-change');
  expect(result.reasons['TC-2']).toContain('smoke-baseline');
  expect(result.reasons['TC-3'][0]).toMatch(/^high-risk-score:/);
  expect(result.reasons['TC-4']).toContain('recently-flaky-stability-check');
  expect(result.reasons['TC-5'][0]).toMatch(/^matched-tag:/);
});

test('only one signal type present: still selects correctly with only that reason', () => {
  const result = selectTests({ impactedTestIds: ['TC-1'] });
  expect(result.selectedTestIds).toEqual(['TC-1']);
  expect(result.reasons['TC-1']).toEqual(['impacted-by-change']);
});

test('zero signals produces an empty selection, no error', () => {
  const result = selectTests();
  expect(result.selectedTestIds).toEqual([]);
  expect(result.reasons).toEqual({});
});

test('every selected test id has a non-empty reasons array (structural guarantee)', () => {
  const result = selectTests({ impactedTestIds: ['TC-1'], smokeBaselineIds: ['TC-2'] });
  for (const id of result.selectedTestIds) {
    expect(result.reasons[id].length).toBeGreaterThan(0);
  }
});

test('a test can be selected for more than one reason -- both are recorded, not deduplicated to one', () => {
  const result = selectTests({ impactedTestIds: ['TC-1'], smokeBaselineIds: ['TC-1'] });
  expect(result.reasons['TC-1']).toEqual(['impacted-by-change', 'smoke-baseline']);
});

test('risk score below threshold is never selected on risk alone', () => {
  const result = selectTests({ riskScores: { 'TC-1': 0.5 } });
  expect(result.selectedTestIds).toEqual([]);
});

test('risk threshold is configurable, not hardcoded', () => {
  const result = selectTests({ riskScores: { 'TC-1': 0.5 }, riskThreshold: 0.4 });
  expect(result.selectedTestIds).toEqual(['TC-1']);
  expect(DEFAULT_RISK_THRESHOLD).toBeGreaterThan(0);
});

test('a null/unknown risk score is never treated as high-risk', () => {
  const result = selectTests({ riskScores: { 'TC-1': null } });
  expect(result.selectedTestIds).toEqual([]);
});

test('deterministic: identical input produces identical, sorted output on repeated calls', () => {
  const signals = { impactedTestIds: ['TC-3', 'TC-1'], smokeBaselineIds: ['TC-2'] };
  const a = selectTests(signals);
  const b = selectTests(signals);
  expect(a).toEqual(b);
  expect(a.selectedTestIds).toEqual(['TC-1', 'TC-2', 'TC-3']); // sorted, not insertion order
});
