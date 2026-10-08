// PHASE 4, A5 (advanced failure analysis): validates the TEST FAILURE vs
// ENVIRONMENT/INFRASTRUCTURE FAILURE grouping added on top of the existing 10-category
// classifier -- never falsely bucketing an unrecognized or ambiguous category.

const { test, expect } = require('@playwright/test');
const { classifyFailureGroup } = require('../../.framework/agents/failure-analysis');

const EXPECTED_GROUPS = {
  'selector-drift': 'test-failure',
  'assertion-failure': 'test-failure',
  'test-data-failure': 'test-failure',
  'flaky-test': 'test-failure',
  timeout: 'environment-infrastructure',
  'navigation-failure': 'environment-infrastructure',
  'authentication-failure': 'environment-infrastructure',
  'environment-failure': 'environment-infrastructure',
  'infrastructure-failure': 'environment-infrastructure',
  'application-defect': 'unknown',
};

for (const [category, expectedGroup] of Object.entries(EXPECTED_GROUPS)) {
  test(`classifies "${category}" as "${expectedGroup}"`, () => {
    expect(classifyFailureGroup(category)).toBe(expectedGroup);
  });
}

test('application-defect is never grouped as test-failure (would repeat the exact mistake this agent guards against)', () => {
  expect(classifyFailureGroup('application-defect')).not.toBe('test-failure');
});

test('an unrecognized category falls back to unknown, never guessed into a confident bucket', () => {
  expect(classifyFailureGroup('some-made-up-category')).toBe('unknown');
  expect(classifyFailureGroup(undefined)).toBe('unknown');
});

test('every category in the schema enum has an explicit mapping (no silent gaps)', () => {
  const schemaCategories = [
    'selector-drift', 'timeout', 'navigation-failure', 'authentication-failure',
    'test-data-failure', 'environment-failure', 'application-defect', 'assertion-failure',
    'infrastructure-failure', 'flaky-test',
  ];
  for (const category of schemaCategories) {
    expect(EXPECTED_GROUPS).toHaveProperty(category);
  }
});
