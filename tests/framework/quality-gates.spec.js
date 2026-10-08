// PHASE 5, B7 (quality gates): thresholds always caller-supplied, missing metrics never pass.

const { test, expect } = require('@playwright/test');
const { evaluateGates } = require('../../.framework/lib/quality-gates');

test('happy path: all metrics satisfy their thresholds -> overall pass', () => {
  const result = evaluateGates(
    { passRate: 0.95, criticalFailures: 0 },
    { passRate: 0.9, criticalFailures: 0 },
  );
  expect(result.passed).toBe(true);
  expect(result.failedGates).toEqual([]);
});

test('the same metrics with a stricter threshold set produce a different (failing) outcome -- proves no hardcoded number', () => {
  const metrics = { passRate: 0.85 };
  const lenient = evaluateGates(metrics, { passRate: 0.8 });
  const strict = evaluateGates(metrics, { passRate: 0.9 });
  expect(lenient.passed).toBe(true);
  expect(strict.passed).toBe(false);
});

test('a missing metric is treated as failing, never silently passing', () => {
  const result = evaluateGates({}, { passRate: 0.5 });
  expect(result.passed).toBe(false);
  expect(result.gateResults.passRate.passed).toBe(false);
});

test('an empty thresholds object throws rather than silently evaluating nothing', () => {
  expect(() => evaluateGates({ passRate: 1 }, {})).toThrow(/explicit, non-empty thresholds/);
});

test('an unrecognized gate name throws, never silently ignored', () => {
  expect(() => evaluateGates({}, { notARealGate: 5 })).toThrow(/Unknown quality gate/);
});

test('a metric exactly at the threshold boundary passes for a >= gate', () => {
  const result = evaluateGates({ passRate: 0.9 }, { passRate: 0.9 });
  expect(result.gateResults.passRate.passed).toBe(true);
});

test('criticalFailures uses a <= comparator: zero passes, one fails a zero-tolerance threshold', () => {
  expect(evaluateGates({ criticalFailures: 0 }, { criticalFailures: 0 }).passed).toBe(true);
  expect(evaluateGates({ criticalFailures: 1 }, { criticalFailures: 0 }).passed).toBe(false);
});

test('deterministic: identical input produces identical output', () => {
  const metrics = { passRate: 0.8, flakyCount: 2 };
  const thresholds = { passRate: 0.7, flakyCount: 5 };
  expect(evaluateGates(metrics, thresholds)).toEqual(evaluateGates(metrics, thresholds));
});
