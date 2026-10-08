// Test Data Agent (ARCHITECTURE.md Section 7 / Section C). Builds on the Phase 1
// utils/data-factory.js foundation -- generates unique, timestamp-suffixed data per test case
// and always declares a teardown, even when the teardown is a no-op for a read-only test.

const { createLogger } = require('../lib/logger');
const { writeArtifact, listArtifacts } = require('../lib/artifact-store');
const { appendAuditRecord } = require('../lib/audit');
const { createDataFactory } = require('../../utils/data-factory');
const { prefixedId } = require('../lib/ids');

const logger = createLogger('test-data');

function generateFor(testCase, factory) {
  const needs = testCase.data.dataNeeds || [];
  const payload = {};
  for (const need of needs) {
    if (need === 'visitorSessionTag') {
      payload.visitorSessionTag = factory.uniqueUsername('visitor');
    } else {
      // Generic fallback for any not-yet-modeled data need: a namespaced unique token, never a
      // fabricated business value.
      payload[need] = factory.uniqueUsername(need);
    }
  }
  return payload;
}

async function run({ runId } = {}) {
  logger.info('Starting test data generation', { runId });
  const testCases = listArtifacts(runId, 'test-design');
  const results = [];

  for (const tc of testCases) {
    const needs = tc.data.dataNeeds || [];
    if (needs.length === 0) {
      logger.info('No data needs for test case; skipping (no artifact required)', { testCaseId: tc.id });
      continue;
    }
    const moduleName = (tc.data.module || 'general').toLowerCase().replace(/\s+/g, '-');
    const factory = createDataFactory(moduleName);
    const payload = generateFor(tc, factory);

    const id = prefixedId('TD', tc.id.replace(/^TC-/, ''));
    const { artifact } = writeArtifact(runId, 'test-data', id, {
      testCaseId: tc.id,
      module: tc.data.module,
      generationMethod: 'synthetic',
      seed: null,
      payload,
      setup: [],
      teardown: ['No persistent state created (read-only navigation test); teardown is a no-op.'],
      environmentTarget: 'non-production',
    });
    results.push(artifact);
    appendAuditRecord(runId, { agent: 'test-data', action: 'test-data-generated', testCaseId: tc.id, dataId: id });
  }

  logger.info('Test data generation complete', { runId, count: results.length });
  return results;
}

module.exports = { run, generateFor };
