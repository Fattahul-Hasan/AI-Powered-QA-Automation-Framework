// Gap Analysis Agent (ARCHITECTURE.md Section 12 / Section I).
//
// Real cross-referencing of this run's artifacts -- never fabricates a gap, and never hides a
// real one. Staleness window defaults to 14 days (ARCHITECTURE.md Section 9, Decision 7),
// overridable via GAP_ANALYSIS_STALENESS_DAYS for tuning without a code change.

const { createLogger } = require('../lib/logger');
const { writeArtifact, listArtifacts, listRuns } = require('../lib/artifact-store');
const { appendAuditRecord } = require('../lib/audit');

const logger = createLogger('gap-analysis');
const DEFAULT_STALENESS_DAYS = 14;
const DEFAULT_FLAKY_HISTORY_LIMIT = 5;
// PHASE 4, A7 (flaky-test intelligence): a test is "recommended for quarantine" only once its
// result flips across at least half of the consecutive run-pairs in its recent history -- a
// documented, overridable default, never a silently-invented "real" threshold.
const DEFAULT_QUARANTINE_FREQUENCY_THRESHOLD = 0.5;

// PHASE 5, B6 (historical execution data): the single, reusable place that reads a test case's
// real cross-run execution history. Extracted from computeFlakyTests (below) so A4's
// risk-scoring and A7's flaky-frequency computation both consume the exact same history-reading
// logic rather than re-deriving it -- additive export, computeFlakyTests' own behavior/callers
// are unaffected by this extraction.
function getExecutionHistoryForTestCase(testCaseId, { historyLimit = DEFAULT_FLAKY_HISTORY_LIMIT, runIds = listRuns() } = {}) {
  const recentRuns = [...runIds].sort().slice(-historyLimit);
  const resultsSeen = [];
  for (const runId of recentRuns) {
    const executions = listArtifacts(runId, 'execution');
    const exec = executions.find((e) => e.data.testCaseId === testCaseId);
    if (exec && (exec.data.result === 'passed' || exec.data.result === 'failed')) {
      resultsSeen.push({ runId, result: exec.data.result });
    }
  }
  return resultsSeen;
}

// Counts how many times the result flips between consecutive runs in the history (0 for a
// history of length 0 or 1 -- there's no pair to compare).
function countResultTransitions(history) {
  let transitions = 0;
  for (let i = 1; i < history.length; i += 1) {
    if (history[i].result !== history[i - 1].result) transitions += 1;
  }
  return transitions;
}

// Real flaky-test detection across run history (run-ids sort chronologically: they embed a
// timestamp). A test is flaky if its real (non-skipped) result differs across the most recent
// `historyLimit` runs that actually executed it -- never guessed from a single run, and never
// counted from a single data point. PHASE 4, A7 extension: also reports how *often* it flips
// (`flakyFrequency`) and whether that crosses the quarantine threshold -- both derived from the
// same real history, nothing new is fabricated.
function computeFlakyTests(testCaseIds, {
  historyLimit = DEFAULT_FLAKY_HISTORY_LIMIT,
  runIds = listRuns(),
  quarantineFrequencyThreshold = DEFAULT_QUARANTINE_FREQUENCY_THRESHOLD,
} = {}) {
  const flaky = [];

  for (const testCaseId of testCaseIds) {
    const resultsSeen = getExecutionHistoryForTestCase(testCaseId, { historyLimit, runIds });
    const distinctResults = new Set(resultsSeen.map((r) => r.result));
    if (distinctResults.size > 1) {
      const transitions = countResultTransitions(resultsSeen);
      const flakyFrequency = resultsSeen.length > 1 ? Number((transitions / (resultsSeen.length - 1)).toFixed(2)) : 0;
      flaky.push({
        testCaseId,
        history: resultsSeen,
        flakyFrequency,
        quarantineRecommended: flakyFrequency >= quarantineFrequencyThreshold,
      });
    }
  }
  return flaky;
}

// PHASE 4, A10 (coverage intelligence): a requirement is "partially covered" when it has at
// least one designed test case but not all of them are automated yet -- distinct from
// `requirementsWithoutTests` (zero test cases) and from full coverage (all automated). Derived
// entirely from data already computed in run() below; never fabricated.
function computePartiallyCoveredRequirements(testCasesByRequirement, automationByTestCaseId) {
  const partial = [];
  for (const [requirementId, testCases] of testCasesByRequirement) {
    if (testCases.length === 0) continue;
    const automatedCount = testCases.filter((tc) => {
      const auto = automationByTestCaseId.get(tc.id);
      return auto && auto.data.automationStatus === 'existing-linked';
    }).length;
    if (automatedCount > 0 && automatedCount < testCases.length) {
      partial.push({ requirementId, automatedCount, totalTestCases: testCases.length });
    }
  }
  return partial;
}

function computeStaleAutomation(automationArtifacts, executionByTestCaseId, stalenessWindowDays, now = new Date()) {
  const stale = [];
  for (const auto of automationArtifacts) {
    if (auto.data.automationStatus !== 'existing-linked') continue;
    const exec = executionByTestCaseId.get(auto.data.testCaseId);
    if (!exec) continue;
    const lastExecutedAt = exec.data.lastExecutedAt || exec.timestamp || now.toISOString();
    const daysSince = (now - new Date(lastExecutedAt)) / (1000 * 60 * 60 * 24);
    if (daysSince > stalenessWindowDays) {
      stale.push({ testCaseId: auto.data.testCaseId, lastExecutedAt, daysSinceExecution: Number(daysSince.toFixed(2)) });
    }
  }
  return stale;
}

async function run({ runId, stalenessWindowDays = Number(process.env.GAP_ANALYSIS_STALENESS_DAYS) || DEFAULT_STALENESS_DAYS } = {}) {
  logger.info('Starting gap analysis', { runId, stalenessWindowDays });

  const requirements = listArtifacts(runId, 'requirements');
  const testCases = listArtifacts(runId, 'test-design');
  const automation = listArtifacts(runId, 'automation');
  const executions = listArtifacts(runId, 'execution');

  const testCasesByRequirement = new Map();
  for (const tc of testCases) {
    const list = testCasesByRequirement.get(tc.data.requirementId) || [];
    list.push(tc);
    testCasesByRequirement.set(tc.data.requirementId, list);
  }

  const requirementsWithoutTests = requirements
    .filter((r) => !(testCasesByRequirement.get(r.id) || []).length)
    .map((r) => r.id);

  const knownRequirementIds = new Set(requirements.map((r) => r.id));
  const testsWithoutRequirements = testCases
    .filter((tc) => !knownRequirementIds.has(tc.data.requirementId))
    .map((tc) => tc.id);

  const testCasesWithoutAutomation = automation
    .filter((a) => a.data.automationStatus === 'pending-automation')
    .map((a) => a.data.testCaseId);

  const moduleTestTypes = new Map(); // module -> Set(testType) / regression flag
  for (const tc of testCases) {
    const mod = tc.data.module || 'unknown';
    const entry = moduleTestTypes.get(mod) || { types: new Set(), hasRegression: false, hasAutomation: false };
    entry.types.add(tc.data.testType);
    if (tc.data.regressionCandidate) entry.hasRegression = true;
    moduleTestTypes.set(mod, entry);
  }
  for (const auto of automation) {
    const tc = testCases.find((t) => t.id === auto.data.testCaseId);
    if (tc && auto.data.automationStatus === 'existing-linked') {
      const entry = moduleTestTypes.get(tc.data.module || 'unknown');
      if (entry) entry.hasAutomation = true;
    }
  }

  const modulesWithoutAutomation = [...moduleTestTypes.entries()].filter(([, v]) => !v.hasAutomation).map(([m]) => m);
  const missingNegativeTests = [...moduleTestTypes.entries()].filter(([, v]) => !v.types.has('negative')).map(([m]) => m);
  const missingPermissionTests = [...moduleTestTypes.entries()].filter(([, v]) => !v.types.has('permission') && !v.types.has('role-based')).map(([m]) => m);
  const missingRegressionCoverage = [...moduleTestTypes.entries()].filter(([, v]) => !v.hasRegression).map(([m]) => m);

  const failedTests = executions.filter((e) => e.data.result === 'failed').map((e) => e.data.testCaseId);
  const allTestCaseIds = testCases.map((tc) => tc.id);
  const flakyTests = computeFlakyTests(allTestCaseIds);

  const executionByTestCaseId = new Map(executions.map((e) => [e.data.testCaseId, e]));
  const staleAutomation = computeStaleAutomation(automation, executionByTestCaseId, stalenessWindowDays);

  const automationByTestCaseId = new Map(automation.map((a) => [a.data.testCaseId, a]));
  const partiallyCoveredRequirements = computePartiallyCoveredRequirements(testCasesByRequirement, automationByTestCaseId);

  const { artifact } = writeArtifact(runId, 'gap-analysis', 'GAP-1', {
    requirementsWithoutTests,
    testsWithoutRequirements,
    testCasesWithoutAutomation,
    modulesWithoutAutomation,
    missingNegativeTests,
    missingPermissionTests,
    missingRegressionCoverage,
    partiallyCoveredRequirements,
    failedTests,
    flakyTests,
    staleAutomation,
    stalenessWindowDays,
  });

  appendAuditRecord(runId, {
    agent: 'gap-analysis',
    action: 'gap-analysis-completed',
    requirementsWithoutTests,
    testCasesWithoutAutomation,
  });
  logger.info('Gap analysis complete', {
    runId,
    requirementsWithoutTests: requirementsWithoutTests.length,
    testCasesWithoutAutomation: testCasesWithoutAutomation.length,
  });
  return artifact;
}

module.exports = {
  run,
  computeStaleAutomation,
  computeFlakyTests,
  getExecutionHistoryForTestCase,
  computePartiallyCoveredRequirements,
  DEFAULT_STALENESS_DAYS,
  DEFAULT_FLAKY_HISTORY_LIMIT,
  DEFAULT_QUARANTINE_FREQUENCY_THRESHOLD,
};
