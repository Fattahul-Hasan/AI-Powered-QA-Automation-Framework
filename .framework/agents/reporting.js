// Reporting Agent (ARCHITECTURE.md Section 14 / Section K).
//
// Aggregates this run's real artifacts -- never re-interprets a result (a failure here is a
// failure in the report, always). Writes the schema-validated artifact plus the two
// human-facing outputs PROJECT_STRUCTURE.md places under reports/<run-id>/.

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../lib/logger');
const { writeArtifact, listArtifacts } = require('../lib/artifact-store');
const { readAuditLog, auditLogPath } = require('../lib/audit');
const { loadManifest } = require('../lib/manifest');

const logger = createLogger('reporting');
const REPO_ROOT = path.join(__dirname, '..', '..');

function computeTotals({ requirements, testCases, automation, executions }) {
  const automated = automation.filter((a) => a.data.automationStatus === 'existing-linked').length;
  const passed = executions.filter((e) => e.data.result === 'passed').length;
  const failed = executions.filter((e) => e.data.result === 'failed').length;
  const skipped = executions.filter((e) => e.data.result === 'not-automated' || e.data.result === 'skipped').length;
  return {
    requirements: requirements.length,
    testCases: testCases.length,
    automated,
    executed: executions.length,
    passed,
    failed,
    skipped,
  };
}

function buildTraceabilityMarkdown({ runId, requirements, testCases, automation, executions, gapAnalysis }) {
  const testCasesByReq = new Map();
  for (const tc of testCases) {
    const list = testCasesByReq.get(tc.data.requirementId) || [];
    list.push(tc);
    testCasesByReq.set(tc.data.requirementId, list);
  }
  const automationByTc = new Map(automation.map((a) => [a.data.testCaseId, a]));
  const executionByTc = new Map(executions.map((e) => [e.data.testCaseId, e]));

  const lines = [`# Traceability Report — ${runId}`, ''];
  for (const req of requirements) {
    lines.push(`## ${req.id}: ${req.data.title}`);
    const tcs = testCasesByReq.get(req.id) || [];
    if (tcs.length === 0) {
      lines.push('- **No test case designed for this requirement (gap).**');
    }
    for (const tc of tcs) {
      const auto = automationByTc.get(tc.id);
      const exec = executionByTc.get(tc.id);
      lines.push(
        `- **${tc.id}** (${tc.data.testType}, ${tc.data.priority}): ${tc.data.scenario}` +
          `\n  - Automation: ${auto ? auto.data.automationStatus : 'not designed'}${auto && auto.data.specFile ? ` (${auto.data.specFile})` : ''}` +
          `\n  - Execution: ${exec ? exec.data.result : 'not run'}`,
      );
    }
    lines.push('');
  }
  if (gapAnalysis) {
    lines.push('## Gap Analysis Summary', '');
    lines.push(`- Requirements without tests: ${gapAnalysis.data.requirementsWithoutTests.join(', ') || 'none'}`);
    lines.push(`- Test cases without automation: ${gapAnalysis.data.testCasesWithoutAutomation.join(', ') || 'none'}`);
    lines.push(`- Stale automation (> ${gapAnalysis.data.stalenessWindowDays} days): ${gapAnalysis.data.staleAutomation.length}`);
  }
  return lines.join('\n');
}

// PHASE 5, B12 (CI failure diagnostics). Actionable, per-failure information -- category/group
// from Failure Analysis (A5), retry info from Execution (B4), real attachment paths when
// Playwright captured them, and a non-secret environment snapshot (presence/flags only, never
// credential values -- consistent with this framework's existing redaction rules).
function buildFailureDiagnostics(executions, failureAnalyses) {
  const analysisByTestId = new Map(failureAnalyses.map((a) => [a.data.testId, a]));
  return executions
    .filter((e) => e.data.result === 'failed')
    .map((e) => {
      const analysis = analysisByTestId.get(e.data.testCaseId);
      return {
        testCaseId: e.data.testCaseId,
        specFile: e.data.specFile,
        category: analysis ? analysis.data.category : null,
        failureGroup: analysis ? analysis.data.failureGroup : null,
        retryInfo: {
          retryCount: e.data.retryCount,
          firstAttemptResult: e.data.firstAttemptResult,
          finalResult: e.data.finalResult,
        },
        attachments: e.data.attachments || [],
        environment: {
          baseUrlConfigured: Boolean(process.env.BASE_URL),
          testEnvironment: process.env.TEST_ENVIRONMENT || null,
          ci: Boolean(process.env.CI),
        },
      };
    });
}

async function run({ runId } = {}) {
  logger.info('Starting reporting', { runId });

  const requirements = listArtifacts(runId, 'requirements');
  const testCases = listArtifacts(runId, 'test-design');
  const automation = listArtifacts(runId, 'automation');
  const executions = listArtifacts(runId, 'execution');
  const failureAnalyses = listArtifacts(runId, 'failure-analysis');
  const selfHealing = listArtifacts(runId, 'self-healing');
  const gapAnalysisList = listArtifacts(runId, 'gap-analysis');
  const gapAnalysis = gapAnalysisList[0] || null;
  const regressionList = listArtifacts(runId, 'regression');

  const totals = computeTotals({ requirements, testCases, automation, executions });
  const requirementCoveragePercent = requirements.length
    ? Number(((requirements.length - (gapAnalysis ? gapAnalysis.data.requirementsWithoutTests.length : 0)) / requirements.length * 100).toFixed(1))
    : 0;
  const automationCoveragePercent = testCases.length
    ? Number((totals.automated / testCases.length * 100).toFixed(1))
    : 0;

  const moduleBreakdown = {};
  for (const tc of testCases) {
    const mod = tc.data.module || 'unknown';
    moduleBreakdown[mod] = (moduleBreakdown[mod] || 0) + 1;
  }
  const testTypeBreakdown = {};
  for (const tc of testCases) {
    testTypeBreakdown[tc.data.testType] = (testTypeBreakdown[tc.data.testType] || 0) + 1;
  }

  const diagnostics = buildFailureDiagnostics(executions, failureAnalyses);

  const { artifact } = writeArtifact(runId, 'reporting', 'RPT-1', {
    generatedAt: new Date().toISOString(),
    totals,
    moduleBreakdown,
    testTypeBreakdown,
    requirementCoveragePercent,
    automationCoveragePercent,
    gapAnalysisRef: gapAnalysis ? gapAnalysis.id : 'none',
    regressionRef: regressionList.length ? regressionList.map((r) => r.id).join(',') : null,
    selfHealingActivity: selfHealing.map((s) => ({ testId: s.data.testId, decision: s.data.decision, confidence: s.data.confidence })),
    flakyTests: gapAnalysis ? gapAnalysis.data.flakyTests : [],
    staleTests: gapAnalysis ? gapAnalysis.data.staleAutomation.map((s) => s.testCaseId) : [],
    diagnostics,
    auditLogRef: auditLogPath(runId),
  });

  const reportsDir = path.join(REPO_ROOT, 'reports', runId);
  fs.mkdirSync(reportsDir, { recursive: true });
  fs.writeFileSync(path.join(reportsDir, 'summary.json'), JSON.stringify(artifact, null, 2));
  const traceabilityMd = buildTraceabilityMarkdown({ runId, requirements, testCases, automation, executions, gapAnalysis });
  fs.writeFileSync(path.join(reportsDir, 'traceability.md'), traceabilityMd);

  logger.info('Reporting complete', { runId, totals });
  return { artifact, reportsDir };
}

module.exports = { run, computeTotals, buildTraceabilityMarkdown, buildFailureDiagnostics };
