// PHASE 4, A2 (requirement impact analysis): uses only real manifest mappings, never invents a
// requirement-to-test-case relationship.

const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { computeChangeImpact, persistImpactAnalysis } = require('../../.framework/lib/impact-analysis');
const artifactStore = require('../../.framework/lib/artifact-store');
const { validate } = require('../../.framework/lib/schema-validator');

const SAMPLE_MANIFEST = {
  requirements: {
    'REQ-1': { testCaseIds: ['TC-1-01', 'TC-1-02'], automation: { 'TC-1-01': 'tests/a.spec.js' } },
    'REQ-2': { testCaseIds: ['TC-2-01'], automation: { 'TC-2-01': 'tests/b.spec.js' } },
  },
};

test('happy path: modified + added + removed requirements map to real, known test cases only', () => {
  const diff = { added: [], removed: [], modified: [{ id: 'REQ-1', changedFields: ['description'] }], unchanged: ['REQ-2'] };
  const impact = computeChangeImpact(diff, SAMPLE_MANIFEST);
  expect(impact.affectedRequirementIds).toEqual(['REQ-1']);
  expect(impact.affectedTestCaseIds.sort()).toEqual(['TC-1-01', 'TC-1-02']);
  expect(impact.affectedAutomationFiles).toEqual(['tests/a.spec.js']);
  expect(impact.regressionScopeTestCaseIds.sort()).toEqual(['TC-1-01', 'TC-1-02']);
});

test('unchanged requirements are never included in the impact, even if they exist in the manifest', () => {
  const diff = { added: [], removed: [], modified: [], unchanged: ['REQ-1', 'REQ-2'] };
  const impact = computeChangeImpact(diff, SAMPLE_MANIFEST);
  expect(impact.affectedRequirementIds).toEqual([]);
  expect(impact.affectedTestCaseIds).toEqual([]);
});

test('a newly added requirement with no manifest entry yet produces an honestly empty test-case list, not fabricated', () => {
  const diff = { added: ['REQ-BRAND-NEW'], removed: [], modified: [], unchanged: [] };
  const impact = computeChangeImpact(diff, SAMPLE_MANIFEST);
  expect(impact.affectedRequirementIds).toEqual(['REQ-BRAND-NEW']);
  expect(impact.affectedTestCaseIds).toEqual([]);
});

test('missing/empty manifest never crashes -- everything resolves to empty, not an error', () => {
  const diff = { added: ['REQ-1'], removed: [], modified: [], unchanged: [] };
  expect(() => computeChangeImpact(diff, null)).not.toThrow();
  expect(computeChangeImpact(diff, null).affectedTestCaseIds).toEqual([]);
  expect(computeChangeImpact(diff, {}).affectedTestCaseIds).toEqual([]);
});

test('a removed requirement still resolves its (now-obsolete) affected test cases from the manifest, for regression awareness', () => {
  const diff = { added: [], removed: ['REQ-2'], modified: [], unchanged: [] };
  const impact = computeChangeImpact(diff, SAMPLE_MANIFEST);
  expect(impact.affectedTestCaseIds).toEqual(['TC-2-01']);
});

test('deterministic: identical inputs produce identical output', () => {
  const diff = { added: [], removed: [], modified: [{ id: 'REQ-1', changedFields: ['title'] }], unchanged: [] };
  expect(computeChangeImpact(diff, SAMPLE_MANIFEST)).toEqual(computeChangeImpact(diff, SAMPLE_MANIFEST));
});

test('persistImpactAnalysis writes a schema-valid artifact', () => {
  const runId = `run-test-impact-${Date.now()}`;
  artifactStore.ensureRun(runId);
  try {
    const diff = { added: ['REQ-1'], removed: [], modified: [], unchanged: [] };
    const { artifact } = persistImpactAnalysis(runId, 'IMPACT-1', computeChangeImpact(diff, SAMPLE_MANIFEST));
    expect(validate('impact-analysis.schema.json', artifact).valid).toBe(true);
  } finally {
    fs.rmSync(artifactStore.runDir(runId), { recursive: true, force: true });
  }
});
