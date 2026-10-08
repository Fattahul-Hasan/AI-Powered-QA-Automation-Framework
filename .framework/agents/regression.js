// Regression Agent (ARCHITECTURE.md Section 13 / Section J).
//
// Two trigger paths into the same real impact-mapping logic, finalized 2026-08-25: the
// standard tail of every run (dispatched after Gap Analysis), and an independent GitLab MR
// trigger. GitLab MCP is read-only and unreachable from a plain Node process (see
// .framework/lib/gitlab-adapter.js), so the independent-trigger path in dry-run reads a
// clearly-labeled synthetic MR-diff fixture instead of fabricating a real GitLab response.

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../lib/logger');
const { writeArtifact, listArtifacts } = require('../lib/artifact-store');
const { appendAuditRecord } = require('../lib/audit');
const { readMergeRequest } = require('../lib/gitlab-adapter');
const { selectTests } = require('../lib/test-selection');

const logger = createLogger('regression');

function computeSmokeBaseline(testCases) {
  return testCases.filter((tc) => tc.data.priority === 'P1').map((tc) => tc.id);
}

function computeImpactedTestIds(automationArtifacts, changedFiles) {
  return automationArtifacts
    .filter((a) => (a.data.pageObjectsTouched || []).some((f) => changedFiles.includes(f)))
    .map((a) => a.data.testCaseId);
}

async function runStandardTail({ runId }) {
  const testCases = listArtifacts(runId, 'test-design');
  const executions = listArtifacts(runId, 'execution');
  const smokeBaselineIds = computeSmokeBaseline(testCases);
  const impactedTestIds = executions.map((e) => e.data.testCaseId);
  const selectedForExecution = [...new Set([...impactedTestIds, ...smokeBaselineIds])];

  if (smokeBaselineIds.length === 0) {
    // A legitimate early-project state (no P1 test cases designed yet) -- surfaced honestly
    // rather than silently accepted or treated as a schema-level error. This is distinct from
    // the agent itself ever *narrowing* an existing baseline to zero, which remains forbidden.
    logger.warn('Smoke baseline is empty -- no P1-priority test cases exist yet in this run', { runId });
  }

  // PHASE 4, A3 (intelligent test selection): additive -- explains WHY each already-selected
  // test was included. Does not change selectedForExecution's existing value/computation above.
  const { reasons: selectionReasons } = selectTests({ impactedTestIds, smokeBaselineIds });

  const { artifact } = writeArtifact(runId, 'regression', 'REG-STANDARD-TAIL', {
    trigger: 'standard-tail',
    changedFiles: [],
    impactedTestIds,
    smokeBaselineIds,
    selectedForExecution,
    selectionReasons,
    isSyntheticTrigger: false,
  });
  appendAuditRecord(runId, { agent: 'regression', action: 'standard-tail-regression', selectedForExecution });
  return artifact;
}

async function runIndependentMrTrigger({ runId, mrFixturePath = path.join(__dirname, '..', 'fixtures', 'synthetic-mr-diff.json') }) {
  // Real GitLab MCP read would go here in an interactive session; honestly reports
  // not-connected from this plain Node harness (see gitlab-adapter.js), then falls back to the
  // labeled synthetic fixture for the dry-run demonstration.
  const mcpAttempt = await readMergeRequest('SYNTHETIC-MR-1');
  logger.info('GitLab MCP read attempt from harness', mcpAttempt);

  if (!fs.existsSync(mrFixturePath)) {
    logger.warn('No synthetic MR fixture found; skipping independent-trigger demonstration', { mrFixturePath });
    return null;
  }
  const fixture = JSON.parse(fs.readFileSync(mrFixturePath, 'utf8'));
  const testCases = listArtifacts(runId, 'test-design');
  const automation = listArtifacts(runId, 'automation');
  const smokeBaselineIds = computeSmokeBaseline(testCases);
  const impactedTestIds = computeImpactedTestIds(automation, fixture.changedFiles);
  const selectedForExecution = [...new Set([...impactedTestIds, ...smokeBaselineIds])];

  const { reasons: selectionReasons } = selectTests({ impactedTestIds, smokeBaselineIds });

  const { artifact } = writeArtifact(runId, 'regression', 'REG-MR-SYNTHETIC', {
    trigger: 'independent-mr-trigger',
    changedFiles: fixture.changedFiles,
    impactedTestIds,
    smokeBaselineIds,
    selectedForExecution,
    selectionReasons,
    isSyntheticTrigger: true,
  }, { evidence: [`Synthetic MR fixture: ${mrFixturePath} (${fixture.title})`] });

  appendAuditRecord(runId, {
    agent: 'regression',
    action: 'independent-mr-regression',
    isSynthetic: true,
    impactedTestIds,
  });
  return artifact;
}

async function run({ runId } = {}) {
  logger.info('Starting regression selection', { runId });
  const standardTail = await runStandardTail({ runId });
  const mrTriggered = await runIndependentMrTrigger({ runId });
  logger.info('Regression selection complete', { runId });
  return [standardTail, mrTriggered].filter(Boolean);
}

module.exports = { run, runStandardTail, runIndependentMrTrigger, computeSmokeBaseline, computeImpactedTestIds };
