// PHASE 4, A10 (coverage intelligence): "partially covered" is derived strictly from real
// test-design + automation data already computed by the Gap Analysis Agent -- never fabricated.

const { test, expect } = require('@playwright/test');
const { computePartiallyCoveredRequirements } = require('../../.framework/agents/gap-analysis');

function tc(id) {
  return { id };
}
function auto(testCaseId, automationStatus) {
  return { data: { testCaseId, automationStatus } };
}

test('flags a requirement with some, but not all, test cases automated', () => {
  const byReq = new Map([['REQ-1', [tc('TC-1-01'), tc('TC-1-02')]]]);
  const autoMap = new Map([
    ['TC-1-01', auto('TC-1-01', 'existing-linked')],
    ['TC-1-02', auto('TC-1-02', 'pending-automation')],
  ]);
  const partial = computePartiallyCoveredRequirements(byReq, autoMap);
  expect(partial).toEqual([{ requirementId: 'REQ-1', automatedCount: 1, totalTestCases: 2 }]);
});

test('does not flag a fully automated requirement', () => {
  const byReq = new Map([['REQ-1', [tc('TC-1-01'), tc('TC-1-02')]]]);
  const autoMap = new Map([
    ['TC-1-01', auto('TC-1-01', 'existing-linked')],
    ['TC-1-02', auto('TC-1-02', 'existing-linked')],
  ]);
  expect(computePartiallyCoveredRequirements(byReq, autoMap)).toEqual([]);
});

test('does not flag a fully unautomated requirement (that is "uncovered", a different gap type)', () => {
  const byReq = new Map([['REQ-1', [tc('TC-1-01')]]]);
  const autoMap = new Map([['TC-1-01', auto('TC-1-01', 'pending-automation')]]);
  expect(computePartiallyCoveredRequirements(byReq, autoMap)).toEqual([]);
});

test('a requirement with zero test cases is never flagged partial (it is "without tests", not "partial")', () => {
  const byReq = new Map([['REQ-EMPTY', []]]);
  expect(computePartiallyCoveredRequirements(byReq, new Map())).toEqual([]);
});

test('a test case with no automation artifact at all is treated as not automated, never guessed', () => {
  const byReq = new Map([['REQ-1', [tc('TC-1-01'), tc('TC-1-02')]]]);
  const autoMap = new Map([['TC-1-01', auto('TC-1-01', 'existing-linked')]]); // TC-1-02 has no entry
  const partial = computePartiallyCoveredRequirements(byReq, autoMap);
  expect(partial).toEqual([{ requirementId: 'REQ-1', automatedCount: 1, totalTestCases: 2 }]);
});
