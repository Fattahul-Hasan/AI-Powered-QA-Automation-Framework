const { test, expect } = require('@playwright/test');
const { computeStaleAutomation, DEFAULT_STALENESS_DAYS } = require('../../.framework/agents/gap-analysis');

test('default staleness window is 14 days (ARCHITECTURE.md Section 9, Decision 7)', () => {
  expect(DEFAULT_STALENESS_DAYS).toBe(14);
});

test('flags automation last executed beyond the staleness window', () => {
  const now = new Date('2026-08-25T00:00:00.000Z');
  const twentyDaysAgo = new Date('2026-08-05T00:00:00.000Z').toISOString();
  const automation = [{ data: { testCaseId: 'TC-1-01', automationStatus: 'existing-linked' } }];
  const executionByTestCaseId = new Map([['TC-1-01', { data: {}, timestamp: twentyDaysAgo }]]);

  const stale = computeStaleAutomation(automation, executionByTestCaseId, 14, now);
  expect(stale.length).toBe(1);
  expect(stale[0].testCaseId).toBe('TC-1-01');
  expect(stale[0].daysSinceExecution).toBeGreaterThan(14);
});

test('does not flag automation executed within the staleness window', () => {
  const now = new Date('2026-08-25T00:00:00.000Z');
  const twoDaysAgo = new Date('2026-08-23T00:00:00.000Z').toISOString();
  const automation = [{ data: { testCaseId: 'TC-1-01', automationStatus: 'existing-linked' } }];
  const executionByTestCaseId = new Map([['TC-1-01', { data: {}, timestamp: twoDaysAgo }]]);

  const stale = computeStaleAutomation(automation, executionByTestCaseId, 14, now);
  expect(stale.length).toBe(0);
});

test('the staleness window is configurable, not hardcoded', () => {
  const now = new Date('2026-08-25T00:00:00.000Z');
  const eightDaysAgo = new Date('2026-08-17T00:00:00.000Z').toISOString();
  const automation = [{ data: { testCaseId: 'TC-1-01', automationStatus: 'existing-linked' } }];
  const executionByTestCaseId = new Map([['TC-1-01', { data: {}, timestamp: eightDaysAgo }]]);

  expect(computeStaleAutomation(automation, executionByTestCaseId, 14, now).length).toBe(0);
  expect(computeStaleAutomation(automation, executionByTestCaseId, 7, now).length).toBe(1);
});

test('pending-automation test cases are never evaluated for staleness (nothing has run)', () => {
  const now = new Date();
  const automation = [{ data: { testCaseId: 'TC-1-02', automationStatus: 'pending-automation' } }];
  const stale = computeStaleAutomation(automation, new Map(), 14, now);
  expect(stale.length).toBe(0);
});
