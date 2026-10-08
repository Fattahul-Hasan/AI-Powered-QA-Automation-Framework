const { test, expect } = require('@playwright/test');
const { validate } = require('../../.framework/lib/schema-validator');
const { computeTotals, buildTraceabilityMarkdown, buildFailureDiagnostics } = require('../../.framework/agents/reporting');

test('computeTotals derives counts arithmetically from artifacts, never estimates', () => {
  const totals = computeTotals({
    requirements: [{}, {}],
    testCases: [{}, {}, {}],
    automation: [{ data: { automationStatus: 'existing-linked' } }, { data: { automationStatus: 'pending-automation' } }],
    executions: [{ data: { result: 'passed' } }, { data: { result: 'failed' } }, { data: { result: 'not-automated' } }],
  });
  expect(totals).toEqual({ requirements: 2, testCases: 3, automated: 1, executed: 3, passed: 1, failed: 1, skipped: 1 });
});

test('buildTraceabilityMarkdown includes every requirement and flags requirements with no test case', () => {
  const md = buildTraceabilityMarkdown({
    runId: 'run-x',
    requirements: [{ id: 'REQ-1', data: { title: 'Has a test' } }, { id: 'REQ-2', data: { title: 'No test yet' } }],
    testCases: [{ id: 'TC-1-01', data: { requirementId: 'REQ-1', testType: 'functional', priority: 'P1', scenario: 'Does a thing' } }],
    automation: [{ data: { testCaseId: 'TC-1-01', automationStatus: 'existing-linked', specFile: 'tests/home.spec.js' } }],
    executions: [{ data: { testCaseId: 'TC-1-01', result: 'passed' } }],
    gapAnalysis: null,
  });
  expect(md).toContain('REQ-1');
  expect(md).toContain('REQ-2');
  expect(md).toContain('No test case designed for this requirement (gap)');
  expect(md).toContain('TC-1-01');
  expect(md).toContain('passed');
});

test('a produced report artifact validates against report.schema.json', () => {
  const result = validate('report.schema.json', {
    id: 'RPT-TEST', runId: 'r', phase: 'reporting', producedBy: 'reporting', schemaVersion: 1, status: 'ok', evidence: [],
    data: {
      generatedAt: new Date().toISOString(),
      totals: { requirements: 1, testCases: 1, automated: 1, executed: 1, passed: 1, failed: 0, skipped: 0 },
      gapAnalysisRef: 'GAP-1',
      auditLogRef: '/tmp/audit.jsonl',
    },
  });
  expect(result.valid).toBe(true);
});

// --- PHASE 5, B12 (CI failure diagnostics) ---

test('buildFailureDiagnostics produces an entry only for failed tests, with real category/retry/attachment data', () => {
  const executions = [
    { data: { testCaseId: 'TC-1', specFile: 'tests/a.spec.js', result: 'failed', retryCount: 1, firstAttemptResult: 'failed', finalResult: 'failed', attachments: [{ name: 'trace', path: '/tmp/t.zip' }] } },
    { data: { testCaseId: 'TC-2', specFile: 'tests/b.spec.js', result: 'passed', retryCount: 0, firstAttemptResult: 'passed', finalResult: 'passed', attachments: [] } },
  ];
  const analyses = [{ data: { testId: 'TC-1', category: 'selector-drift', failureGroup: 'test-failure' } }];

  const diagnostics = buildFailureDiagnostics(executions, analyses);
  expect(diagnostics.length).toBe(1);
  expect(diagnostics[0].testCaseId).toBe('TC-1');
  expect(diagnostics[0].category).toBe('selector-drift');
  expect(diagnostics[0].failureGroup).toBe('test-failure');
  expect(diagnostics[0].retryInfo).toEqual({ retryCount: 1, firstAttemptResult: 'failed', finalResult: 'failed' });
  expect(diagnostics[0].attachments).toEqual([{ name: 'trace', path: '/tmp/t.zip' }]);
});

test('a failed test with no matching failure-analysis artifact has null category, never guessed', () => {
  const executions = [{ data: { testCaseId: 'TC-1', specFile: null, result: 'failed', retryCount: 0, firstAttemptResult: 'failed', finalResult: 'failed', attachments: [] } }];
  const diagnostics = buildFailureDiagnostics(executions, []);
  expect(diagnostics[0].category).toBeNull();
  expect(diagnostics[0].failureGroup).toBeNull();
});

test('no failures at all produces an empty diagnostics array', () => {
  const executions = [{ data: { testCaseId: 'TC-1', result: 'passed', attachments: [] } }];
  expect(buildFailureDiagnostics(executions, [])).toEqual([]);
});

test('the environment snapshot never includes a secret value, only non-secret presence/flags', () => {
  const executions = [{ data: { testCaseId: 'TC-1', result: 'failed', retryCount: 0, firstAttemptResult: 'failed', finalResult: 'failed', attachments: [] } }];
  const diagnostics = buildFailureDiagnostics(executions, []);
  const envKeys = Object.keys(diagnostics[0].environment);
  expect(envKeys).toEqual(['baseUrlConfigured', 'testEnvironment', 'ci']);
  const serialized = JSON.stringify(diagnostics[0].environment).toLowerCase();
  expect(serialized).not.toMatch(/password|token|secret|pat\b/);
});
