const { test, expect } = require('@playwright/test');
const { validate, listSchemaFiles } = require('../../.framework/lib/schema-validator');

test('every schema file compiles as valid JSON Schema', () => {
  const files = listSchemaFiles();
  expect(files.length).toBeGreaterThanOrEqual(12);
  for (const file of files) {
    expect(() => validate(file, {})).not.toThrow();
  }
});

test('a minimal valid requirement artifact passes validation', () => {
  const result = validate('requirement.schema.json', {
    id: 'REQ-TEST-1',
    runId: 'run-test',
    phase: 'requirements',
    producedBy: 'requirement-analysis',
    schemaVersion: 1,
    status: 'ok',
    evidence: [],
    data: {
      title: 'Sample',
      acceptanceCriteria: ['works'],
      sourceRef: 'test',
      sourceType: 'synthetic',
      ambiguities: [],
      missingInformation: [],
    },
  });
  expect(result.valid).toBe(true);
});

test('an invalid requirement artifact (missing required field) fails validation', () => {
  const result = validate('requirement.schema.json', {
    id: 'REQ-TEST-2',
    runId: 'run-test',
    phase: 'requirements',
    producedBy: 'requirement-analysis',
    schemaVersion: 1,
    status: 'ok',
    evidence: [],
    data: { title: 'Missing required fields' },
  });
  expect(result.valid).toBe(false);
  expect(result.errors.length).toBeGreaterThan(0);
});

test('self-healing schema rejects assertionTouched: true', () => {
  const base = {
    id: 'SH-TEST',
    runId: 'run-test',
    phase: 'self-healing',
    producedBy: 'self-healing',
    schemaVersion: 1,
    status: 'ok',
    evidence: [],
    data: {
      testId: 'TC-TEST-01',
      confidence: 'high',
      filesTouched: ['pages/Foo.js'],
      assertionTouched: true,
      rerunResult: 'not-run',
      decision: 'rejected',
      dryRun: true,
      realFileWritePerformed: false,
      mrOpened: false,
      mergeApprovedByHuman: false,
    },
  };
  const result = validate('self-healing.schema.json', base);
  expect(result.valid).toBe(false);
});

test('self-healing schema rejects a filesTouched path outside pages/', () => {
  const result = validate('self-healing.schema.json', {
    id: 'SH-TEST2',
    runId: 'run-test',
    phase: 'self-healing',
    producedBy: 'self-healing',
    schemaVersion: 1,
    status: 'ok',
    evidence: [],
    data: {
      testId: 'TC-TEST-01',
      confidence: 'high',
      filesTouched: ['tests/home.spec.js'],
      assertionTouched: false,
      rerunResult: 'not-run',
      decision: 'auto-applied-locally-pending-merge-review',
      dryRun: true,
      realFileWritePerformed: false,
      mrOpened: false,
      mergeApprovedByHuman: false,
    },
  });
  expect(result.valid).toBe(false);
});
