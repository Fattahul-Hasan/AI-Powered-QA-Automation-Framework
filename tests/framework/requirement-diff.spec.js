// PHASE 4, A1 (requirement change detection): validated against the real v1/v2 synthetic
// fixtures (.framework/fixtures/requirements.md, requirements-v2.md), parsed with the existing
// requirement-analysis.js parser -- no new/duplicate parsing logic, no invented business domain.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { diffRequirements, persistRequirementChange } = require('../../.framework/lib/requirement-diff');
const { parseRequirementsMarkdown } = require('../../.framework/agents/requirement-analysis');
const artifactStore = require('../../.framework/lib/artifact-store');
const { validate } = require('../../.framework/lib/schema-validator');

const FIXTURES_DIR = path.join(__dirname, '..', '..', '.framework', 'fixtures');

function loadFixture(name) {
  return parseRequirementsMarkdown(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8'));
}

test('happy path: real v1 -> v2 fixture diff classifies all four change types correctly', () => {
  const v1 = loadFixture('requirements.md');
  const v2 = loadFixture('requirements-v2.md');
  const diff = diffRequirements(v1, v2);

  expect(diff.added).toEqual(['REQ-DEMO-4']);
  expect(diff.removed).toEqual(['REQ-DEMO-3']);
  expect(diff.unchanged).toEqual(['REQ-DEMO-1']);
  expect(diff.modified.map((m) => m.id)).toEqual(['REQ-DEMO-2']);
  expect(diff.modified[0].changedFields).toContain('acceptanceCriteria');
});

test('empty old set: everything in the new set is added', () => {
  const diff = diffRequirements([], [{ id: 'REQ-X', title: 'New', acceptanceCriteria: [] }]);
  expect(diff.added).toEqual(['REQ-X']);
  expect(diff.removed).toEqual([]);
  expect(diff.modified).toEqual([]);
  expect(diff.unchanged).toEqual([]);
});

test('empty new set: everything in the old set is removed', () => {
  const diff = diffRequirements([{ id: 'REQ-X', title: 'Old', acceptanceCriteria: [] }], []);
  expect(diff.removed).toEqual(['REQ-X']);
  expect(diff.added).toEqual([]);
});

test('identical inputs: everything is unchanged', () => {
  const reqs = [{ id: 'REQ-X', title: 'Same', description: 'd', acceptanceCriteria: ['a'] }];
  const diff = diffRequirements(reqs, reqs);
  expect(diff.unchanged).toEqual(['REQ-X']);
  expect(diff.added).toEqual([]);
  expect(diff.removed).toEqual([]);
  expect(diff.modified).toEqual([]);
});

test('missing/malformed requirement (no id) is simply not matched -- never crashes, never guessed', () => {
  const diff = diffRequirements([{ id: 'REQ-X', title: 'A' }], [{ title: 'no id here' }]);
  expect(diff.removed).toEqual(['REQ-X']);
  // the id-less entry can't be tracked as added/modified/unchanged since it has no id to key on
  expect(diff.added).toEqual([undefined]);
});

test('deterministic: running the same diff twice produces identical output', () => {
  const v1 = loadFixture('requirements.md');
  const v2 = loadFixture('requirements-v2.md');
  expect(diffRequirements(v1, v2)).toEqual(diffRequirements(v1, v2));
});

test('persistRequirementChange writes a schema-valid artifact into the run store', () => {
  const runId = `run-test-reqdiff-${Date.now()}`;
  artifactStore.ensureRun(runId);
  try {
    const diff = diffRequirements(loadFixture('requirements.md'), loadFixture('requirements-v2.md'));
    const { artifact } = persistRequirementChange(runId, 'REQCHG-1', diff);
    const result = validate('requirement-change.schema.json', artifact);
    expect(result.valid).toBe(true);
  } finally {
    fs.rmSync(artifactStore.runDir(runId), { recursive: true, force: true });
  }
});
