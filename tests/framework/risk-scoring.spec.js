// PHASE 4, A4 (risk-based test selection): every factor is either real evidence or explicitly
// `null` -- never guessed. See .framework/lib/risk-scoring.js for the evidence sources.

const { test, expect } = require('@playwright/test');
const { computeRiskScore } = require('../../.framework/lib/risk-scoring');

function testCase({ priority = 'P2', highRiskCategory = null } = {}) {
  return { data: { priority, highRiskCategory } };
}

test('happy path: all evidence present produces a real, deterministic score', () => {
  const history = [{ result: 'passed' }, { result: 'failed' }, { result: 'passed' }];
  const result = computeRiskScore(testCase({ priority: 'P1' }), {
    history,
    recentChangeDetected: true,
    regressionImpacted: true,
  });
  expect(result.score).not.toBeNull();
  expect(result.unknownFactors).toEqual(['defectHistory']); // only truly unmodeled factor
  expect(result.factors.criticality).toBe(1);
});

test('a high-risk category forces maximum criticality regardless of priority', () => {
  const result = computeRiskScore(testCase({ priority: 'P4', highRiskCategory: 'Payments' }));
  expect(result.factors.criticality).toBe(1);
});

test('empty/no history leaves historicalFailureRate and flaky as unknown, not zero', () => {
  const result = computeRiskScore(testCase());
  expect(result.factors.historicalFailureRate).toBeNull();
  expect(result.factors.flaky).toBeNull();
  expect(result.unknownFactors).toContain('historicalFailureRate');
  expect(result.unknownFactors).toContain('flaky');
});

test('a single history data point is never enough to call flaky known (boundary)', () => {
  const result = computeRiskScore(testCase(), { history: [{ result: 'passed' }] });
  expect(result.factors.flaky).toBeNull();
  expect(result.factors.historicalFailureRate).toBe(0); // failure RATE is knowable from 1 point; flakiness is not
});

test('missing/malformed priority is treated as unknown, never guessed to a default score', () => {
  const result = computeRiskScore(testCase({ priority: 'NOT-A-REAL-PRIORITY' }));
  expect(result.factors.criticality).toBeNull();
});

test('when every factor is unknown, the overall score is null, never a fabricated number', () => {
  const result = computeRiskScore({ data: { priority: undefined, highRiskCategory: null } });
  expect(result.score).toBeNull();
  expect(result.unknownFactors.length).toBe(6);
});

test('defectHistory is always unknown -- honestly documented as not modeled by this framework', () => {
  const result = computeRiskScore(testCase(), { history: [{ result: 'passed' }, { result: 'failed' }] });
  expect(result.factors.defectHistory).toBeNull();
});

test('deterministic: identical input produces identical output on repeated calls', () => {
  const history = [{ result: 'passed' }, { result: 'failed' }];
  const a = computeRiskScore(testCase({ priority: 'P1' }), { history, recentChangeDetected: true });
  const b = computeRiskScore(testCase({ priority: 'P1' }), { history, recentChangeDetected: true });
  expect(a).toEqual(b);
});
