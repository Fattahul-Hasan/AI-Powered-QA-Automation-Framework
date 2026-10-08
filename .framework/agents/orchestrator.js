// Orchestrator Agent (ARCHITECTURE.md Section 3). Sequences the canonical pipeline finalized
// 2026-08-24/25: Requirement Analysis + Product Discovery dispatch concurrently, Test Design is
// a join point, everything from Test Data onward is sequential, Execution branches on
// pass/fail, self-healing always loops through an explicit (here: dry-run no-op, documented)
// Re-run before Gap Analysis, and Regression has both its standard-tail and independent-MR
// entry points exercised. The Orchestrator is the ONLY writer of manifest.json.

const { createLogger } = require('../lib/logger');
const { ensureRun, listArtifacts } = require('../lib/artifact-store');
const { newRunId } = require('../lib/ids');
const { saveManifest, loadManifest } = require('../lib/manifest');
const { appendAuditRecord } = require('../lib/audit');
// PHASE 5, B11: real wiring -- pipeline completion is a genuine notification event, not just
// an audit record. Defaults to the safe console adapter (no external network call); callers
// that want file/other delivery pass their own adapter via `runDryRunPipeline`'s options.
const { notify, consoleAdapter } = require('../lib/notification-adapter');

const requirementAnalysis = require('./requirement-analysis');
const productDiscovery = require('./product-discovery');
const testDesign = require('./test-design');
const testData = require('./test-data');
const automationGeneration = require('./automation-generation');
const execution = require('./execution');
const failureAnalysis = require('./failure-analysis');
const selfHealing = require('./self-healing');
const gapAnalysis = require('./gap-analysis');
const regression = require('./regression');
const reporting = require('./reporting');

const logger = createLogger('orchestrator');

function updateManifestFromRun(runId) {
  const requirements = listArtifacts(runId, 'requirements');
  const testCases = listArtifacts(runId, 'test-design');
  const automation = listArtifacts(runId, 'automation');
  const executions = listArtifacts(runId, 'execution');
  // PHASE 4, A11 (traceability): link each test case's manifest entry to the failure-analysis /
  // self-healing artifacts that concern it, when they exist -- additive, optional leaf fields.
  const failureAnalyses = listArtifacts(runId, 'failure-analysis');
  const healingProposals = listArtifacts(runId, 'self-healing');

  const manifest = loadManifest(runId);
  for (const req of requirements) {
    const tcs = testCases.filter((tc) => tc.data.requirementId === req.id);
    const automationMap = {};
    const lastExecution = {};
    for (const tc of tcs) {
      const auto = automation.find((a) => a.data.testCaseId === tc.id);
      if (auto && auto.data.specFile) automationMap[tc.id] = auto.data.specFile;
      const exec = executions.find((e) => e.data.testCaseId === tc.id);
      if (exec) {
        lastExecution[tc.id] = { runId, status: exec.data.result === 'not-automated' ? 'not-automated' : exec.data.result };
        const failureAnalysis = failureAnalyses.find((fa) => fa.data.testId === tc.id);
        if (failureAnalysis) lastExecution[tc.id].failureAnalysisId = failureAnalysis.id;
        const healing = healingProposals.find((h) => h.data.testId === tc.id);
        if (healing) lastExecution[tc.id].selfHealingId = healing.id;
      }
    }
    manifest.requirements[req.id] = {
      testCaseIds: tcs.map((t) => t.id),
      automation: automationMap,
      lastExecution,
      reportRef: `reports/${runId}/traceability.md#${req.id}`,
    };
  }
  saveManifest(runId, manifest, 'orchestrator');
  return manifest;
}

async function runDryRunPipeline({ runId = newRunId(), discoveryUrl, notifyAdapter = consoleAdapter } = {}) {
  logger.info('Orchestrator: starting dry-run pipeline', { runId });
  ensureRun(runId);
  appendAuditRecord(runId, { agent: 'orchestrator', action: 'pipeline-started', mode: 'dry-run' });

  // Concurrent kickoff: Requirement Analysis and Product Discovery have no data dependency on
  // each other (ARCHITECTURE.md Section 2/3, finalized 2026-08-24).
  logger.info('Dispatching Requirement Analysis and Product Discovery concurrently');
  const [requirements] = await Promise.all([
    requirementAnalysis.run({ runId }),
    productDiscovery.run({ runId, ...(discoveryUrl ? { url: discoveryUrl } : {}) }),
  ]);
  logger.info('Join point reached: both Requirement Analysis and Product Discovery complete', {
    requirementCount: requirements.length,
  });

  await testDesign.run({ runId });
  await testData.run({ runId });
  await automationGeneration.run({ runId });
  const executionResults = await execution.run({ runId });

  const anyFailed = executionResults.some((e) => e.data.result === 'failed');
  logger.info(anyFailed ? 'Execution branch: FAIL path' : 'Execution branch: PASS path (real results); processing synthetic fixture to demonstrate the FAIL path too');
  const failures = await failureAnalysis.run({ runId });
  const healingProposals = await selfHealing.run({ runId });
  if (healingProposals.length > 0) {
    logger.info('Re-run step: dry-run mode performs no real file change, so no real re-run is meaningful here (see self-healing.js) -- this is logged explicitly rather than silently skipped');
  }

  await gapAnalysis.run({ runId });
  await regression.run({ runId });
  const { artifact: report, reportsDir } = await reporting.run({ runId });

  updateManifestFromRun(runId);
  appendAuditRecord(runId, { agent: 'orchestrator', action: 'pipeline-completed', mode: 'dry-run' });
  logger.info('Orchestrator: dry-run pipeline complete', { runId, reportsDir });
  // B11 real wiring: the pipeline-completed audit record above is a durable trace entry; this
  // is the actual notification event a human/ops-facing adapter would act on. Failure to
  // notify must never fail the pipeline itself -- the run already succeeded and its artifacts
  // are already persisted, so a notification-delivery problem is logged, not thrown.
  try {
    await notify('pipeline-completed', { runId, totals: report.data.totals }, notifyAdapter);
  } catch (err) {
    logger.warn('Notification delivery failed (pipeline result is unaffected)', { runId, error: err.message });
  }

  return {
    runId,
    requirements,
    executionResults,
    failures,
    healingProposals,
    report,
    reportsDir,
  };
}

module.exports = { runDryRunPipeline, updateManifestFromRun };
