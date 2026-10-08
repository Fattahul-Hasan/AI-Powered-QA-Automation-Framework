// PHASE 5, B4 (retry strategy) -- bug-fix exception: execution.schema.json already required a
// real `retryCount`, but execution.js only ever read the first attempt and hardcoded 0. Fixed
// in .framework/agents/execution.js's parsePlaywrightJsonReport(). Retries must never hide a
// real failure, and a retry-then-pass must never be reported identically to a stable first-try
// pass.

const { test, expect } = require('@playwright/test');
const { parsePlaywrightJsonReport, runPlaywrightSpec } = require('../../.framework/agents/execution');

function reportWith(results, ok) {
  return { suites: [{ specs: [{ ok, tests: [{ results }] }] }] };
}

test('happy path: a single passing attempt has retryCount 0 and matching first/final result', () => {
  const report = reportWith([{ status: 'passed', duration: 500 }], true);
  const outcome = parsePlaywrightJsonReport(report);
  expect(outcome).toEqual({
    passed: true, durationMs: 500, errorMessage: null,
    retryCount: 0, firstAttemptResult: 'passed', finalResult: 'passed', attachments: [],
  });
});

test('a test that fails once then passes on retry is never reported identically to a stable pass', () => {
  const report = reportWith([
    { status: 'failed', duration: 300, error: { message: 'locator not found' } },
    { status: 'passed', duration: 320 },
  ], true);
  const outcome = parsePlaywrightJsonReport(report);
  expect(outcome.passed).toBe(true);
  expect(outcome.retryCount).toBe(1);
  expect(outcome.firstAttemptResult).toBe('failed'); // the real first-attempt failure is preserved
  expect(outcome.finalResult).toBe('passed');
});

test('a test that fails through all retries is reported as a genuine final failure, not hidden', () => {
  const report = reportWith([
    { status: 'failed', duration: 100, error: { message: 'e1' } },
    { status: 'failed', duration: 100, error: { message: 'e2' } },
    { status: 'failed', duration: 100, error: { message: 'e3' } },
  ], false);
  const outcome = parsePlaywrightJsonReport(report);
  expect(outcome.passed).toBe(false);
  expect(outcome.retryCount).toBe(2);
  expect(outcome.firstAttemptResult).toBe('failed');
  expect(outcome.finalResult).toBe('failed');
  expect(outcome.errorMessage).toBe('e3'); // the final attempt's error, not the first
});

test('zero retries configured (the existing, pre-fix default behavior) is unaffected', () => {
  const report = reportWith([{ status: 'passed', duration: 200 }], true);
  const outcome = parsePlaywrightJsonReport(report);
  expect(outcome.retryCount).toBe(0);
});

test('an empty/malformed report never crashes and never fabricates a result', () => {
  const outcome = parsePlaywrightJsonReport({ suites: [] });
  expect(outcome).toEqual({
    passed: false, durationMs: null, errorMessage: null,
    retryCount: 0, firstAttemptResult: null, finalResult: null, attachments: [],
  });
});

test('real attachments (trace/screenshot/video) are captured when Playwright records them, never guessed', () => {
  const report = reportWith([{ status: 'failed', duration: 100, attachments: [{ name: 'trace', path: '/tmp/trace.zip' }] }], false);
  const outcome = parsePlaywrightJsonReport(report);
  expect(outcome.attachments).toEqual([{ name: 'trace', path: '/tmp/trace.zip' }]);
});

test('no attachments recorded (e.g. a passing test, nothing retained) is an honest empty array', () => {
  const report = reportWith([{ status: 'passed', duration: 100 }], true);
  expect(parsePlaywrightJsonReport(report).attachments).toEqual([]);
});

test('real end-to-end: the preserved smoke test, run through the real Execution Agent path with retries explicitly configured, still reports zero retries (it passes first try)', ({}, testInfo) => {
  testInfo.setTimeout(30000);
  const outcome = runPlaywrightSpec('tests/home.spec.js', { retries: 2 });
  expect(outcome.passed).toBe(true);
  expect(outcome.retryCount).toBe(0);
  expect(outcome.firstAttemptResult).toBe('passed');
  expect(outcome.finalResult).toBe('passed');
});
