const { test, expect } = require('@playwright/test');
const { designTestCasesFor } = require('../../.framework/agents/test-design');

const requirementArtifact = {
  id: 'REQ-DEMO-1',
  data: { module: 'Documentation Site', feature: 'Homepage Navigation' },
};

test('designed test cases have unique IDs traceable to their requirement', () => {
  const testCases = designTestCasesFor(requirementArtifact);
  expect(testCases.length).toBeGreaterThan(0);
  const ids = testCases.map((tc) => tc.id);
  expect(new Set(ids).size).toBe(ids.length);
  for (const tc of testCases) {
    expect(tc.requirementId).toBe('REQ-DEMO-1');
    expect(tc.id.startsWith('TC-DEMO-1-')).toBe(true);
  }
});

test('every designed test case has the required fields populated', () => {
  const testCases = designTestCasesFor(requirementArtifact);
  for (const tc of testCases) {
    expect(tc.scenario).toBeTruthy();
    expect(tc.expectedResult).toBeTruthy();
    expect(tc.steps.length).toBeGreaterThan(0);
    expect(['P1', 'P2', 'P3', 'P4']).toContain(tc.priority);
    expect(typeof tc.automationCandidate).toBe('boolean');
    expect(typeof tc.regressionCandidate).toBe('boolean');
  }
});

test('an unrecognized requirement produces no test cases (never fabricated)', () => {
  const testCases = designTestCasesFor({ id: 'REQ-UNKNOWN', data: {} });
  expect(testCases).toEqual([]);
});
