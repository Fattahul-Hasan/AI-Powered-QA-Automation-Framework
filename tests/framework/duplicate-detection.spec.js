const { test, expect } = require('@playwright/test');
const { detectDuplicates, findSimilarTestCases } = require('../../.framework/agents/test-design');

test('detects a true duplicate: same requirement and same scenario text', () => {
  const duplicates = detectDuplicates([
    { id: 'TC-1-01', requirementId: 'REQ-1', scenario: 'Verify the login button works' },
    { id: 'TC-1-02', requirementId: 'REQ-1', scenario: 'verify the login button works' }, // case-insensitive match
  ]);
  expect(duplicates.length).toBe(1);
  expect(duplicates[0].duplicate.id).toBe('TC-1-02');
});

test('does not flag two different scenarios under the same requirement', () => {
  const duplicates = detectDuplicates([
    { id: 'TC-1-01', requirementId: 'REQ-1', scenario: 'Verify the login button works' },
    { id: 'TC-1-02', requirementId: 'REQ-1', scenario: 'Verify the logout button works' },
  ]);
  expect(duplicates.length).toBe(0);
});

test('does not flag the same scenario text under two different requirements', () => {
  const duplicates = detectDuplicates([
    { id: 'TC-1-01', requirementId: 'REQ-1', scenario: 'Verify navigation works' },
    { id: 'TC-2-01', requirementId: 'REQ-2', scenario: 'Verify navigation works' },
  ]);
  expect(duplicates.length).toBe(0);
});

// --- PHASE 4, A8 (near-duplicate/similarity detection) ---

test('findSimilarTestCases flags near-duplicate wording above the threshold', () => {
  const similar = findSimilarTestCases([
    { id: 'TC-1-01', requirementId: 'REQ-1', scenario: 'Verify the login button navigates to the dashboard' },
    { id: 'TC-1-02', requirementId: 'REQ-1', scenario: 'Verify the login button navigates to the dashboards' },
  ], 0.9);
  expect(similar.length).toBe(1);
  expect(similar[0].testCaseIds).toEqual(['TC-1-01', 'TC-1-02']);
});

test('findSimilarTestCases does not flag genuinely distinct scenarios below the threshold', () => {
  const similar = findSimilarTestCases([
    { id: 'TC-1-01', requirementId: 'REQ-1', scenario: 'Verify the login button works' },
    { id: 'TC-1-02', requirementId: 'REQ-1', scenario: 'Verify the export-to-CSV feature' },
  ], 0.9);
  expect(similar).toEqual([]);
});

test('findSimilarTestCases still catches an exact duplicate too (it is a similarity score of 1)', () => {
  const similar = findSimilarTestCases([
    { id: 'TC-1-01', requirementId: 'REQ-1', scenario: 'Verify the login button works' },
    { id: 'TC-1-02', requirementId: 'REQ-1', scenario: 'Verify the login button works' },
  ], 0.9);
  expect(similar.length).toBe(1);
  expect(similar[0].similarityScore).toBe(1);
});

test('findSimilarTestCases never compares across different requirements, even if wording is identical', () => {
  const similar = findSimilarTestCases([
    { id: 'TC-1-01', requirementId: 'REQ-1', scenario: 'Verify navigation works' },
    { id: 'TC-2-01', requirementId: 'REQ-2', scenario: 'Verify navigation works' },
  ], 0.5);
  expect(similar).toEqual([]);
});

test('findSimilarTestCases on an empty or single-item list returns no pairs, never an error', () => {
  expect(findSimilarTestCases([], 0.8)).toEqual([]);
  expect(findSimilarTestCases([{ id: 'TC-1', requirementId: 'REQ-1', scenario: 'x' }], 0.8)).toEqual([]);
});

test('findSimilarTestCases requires an explicit threshold -- never assumes a default', () => {
  expect(() => findSimilarTestCases([], undefined)).toThrow(/explicit numeric threshold/);
});
