// Execution Agent (ARCHITECTURE.md Section 9 / Section F).
//
// Playwright CLI only, real execution for any test case with linked automation. Test cases
// still "pending-automation" are honestly recorded as skipped/not-automated -- never faked as
// passed or failed. Never edits any test/page-object/fixture file (Section 9: "NOT allowed to").

const path = require('path');
const fs = require('fs');
const os = require('os');
const { execFileSync } = require('child_process');
const { createLogger } = require('../lib/logger');
const { writeArtifact, listArtifacts, runDir } = require('../lib/artifact-store');
const { appendAuditRecord } = require('../lib/audit');
const { prefixedId } = require('../lib/ids');
const { assertNonProductionEnvironment } = require('../lib/environment-safety');

const logger = createLogger('execution');
const REPO_ROOT = path.join(__dirname, '..', '..');

// package.json "exports" blocks require.resolve('@playwright/test/cli.js') directly, so
// resolve the package root via its manifest and join the bin path from there instead.
const PLAYWRIGHT_PKG_DIR = path.dirname(require.resolve('@playwright/test/package.json'));
const PLAYWRIGHT_CLI = path.join(PLAYWRIGHT_PKG_DIR, require('@playwright/test/package.json').bin.playwright);

// PHASE 5, B4 (retry strategy) -- bug-fix exception, not a new feature: execution.schema.json
// already required a real `retryCount` integer, but this function previously only ever read
// `results[0]` and the caller hardcoded `retryCount: 0` regardless of how many attempts
// Playwright's JSON reporter actually recorded. Extracted as a pure function so the parsing
// logic is directly unit-testable against synthetic report shapes, independent of actually
// invoking Playwright.
function parsePlaywrightJsonReport(report) {
  const specs = (report.suites || []).flatMap((s) => s.specs || []);
  const spec = specs[0];
  const results = (spec && spec.tests && spec.tests[0] && spec.tests[0].results) || [];

  if (results.length === 0) {
    return { passed: false, durationMs: null, errorMessage: null, retryCount: 0, firstAttemptResult: null, finalResult: null, attachments: [] };
  }

  const toResult = (r) => (r.status === 'passed' ? 'passed' : 'failed');
  const finalAttempt = results[results.length - 1];

  return {
    passed: Boolean(spec && spec.ok),
    durationMs: finalAttempt.duration ?? null,
    errorMessage: finalAttempt.error ? finalAttempt.error.message : null,
    // Retries must never hide a real failure and must never falsely convert a flaky test into
    // a "stable" one (PHASE 5, B4): retryCount/firstAttemptResult/finalResult are reported
    // separately so a caller can always see that attempt 1 failed, even if a later retry passed.
    retryCount: results.length - 1,
    firstAttemptResult: toResult(results[0]),
    finalResult: toResult(finalAttempt),
    // PHASE 5, B12 (CI failure diagnostics): real trace/screenshot/video paths, when Playwright
    // actually captured them (per playwright.config.js's trace/screenshot/video settings) --
    // never a guessed or conventional path.
    attachments: (finalAttempt.attachments || []).map((a) => ({ name: a.name, path: a.path || null })),
  };
}

function runPlaywrightSpec(specFile, { retries } = {}) {
  const jsonOutputPath = path.join(os.tmpdir(), `pw-json-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
  const args = [PLAYWRIGHT_CLI, 'test', specFile, '--project=chromium', '--reporter=json'];
  if (typeof retries === 'number') args.push(`--retries=${retries}`);
  try {
    // Invoke Playwright's CLI script directly via the current Node executable -- avoids
    // platform-specific npx/npx.cmd shell-resolution issues entirely.
    execFileSync(process.execPath, args, {
      cwd: REPO_ROOT,
      env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: jsonOutputPath },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
  } catch (err) {
    // Playwright CLI exits non-zero on test failure -- that's a real result, not a harness
    // error. Fall through to read whatever JSON report was produced either way.
    if (!fs.existsSync(jsonOutputPath)) throw err;
  }

  const report = JSON.parse(fs.readFileSync(jsonOutputPath, 'utf8'));
  fs.unlinkSync(jsonOutputPath);
  return parsePlaywrightJsonReport(report);
}

async function run({ runId, retries } = {}) {
  assertNonProductionEnvironment();
  logger.info('Starting execution', { runId });
  const automationArtifacts = listArtifacts(runId, 'automation');
  const results = [];

  for (const auto of automationArtifacts) {
    const { testCaseId, automationStatus, specFile } = auto.data;
    let executionData;

    if (automationStatus === 'existing-linked' && specFile) {
      logger.info('Running real Playwright execution', { testCaseId, specFile });
      const outcome = runPlaywrightSpec(specFile, { retries });
      if (outcome.retryCount > 0) {
        logger.info('Test required retries -- reported distinctly, never silently converted to a stable pass', {
          testCaseId, retryCount: outcome.retryCount, firstAttemptResult: outcome.firstAttemptResult, finalResult: outcome.finalResult,
        });
      }
      executionData = {
        testCaseId,
        specFile,
        result: outcome.passed ? 'passed' : 'failed',
        durationMs: outcome.durationMs,
        browserProject: 'chromium',
        errorMessage: outcome.errorMessage,
        stackTrace: null,
        source: 'real-playwright-run',
        retryCount: outcome.retryCount,
        firstAttemptResult: outcome.firstAttemptResult,
        finalResult: outcome.finalResult,
        attachments: outcome.attachments,
      };
    } else {
      logger.info('No automation available; recording as not-automated (never faked)', { testCaseId });
      executionData = {
        testCaseId,
        specFile: null,
        result: 'not-automated',
        durationMs: null,
        browserProject: null,
        errorMessage: null,
        stackTrace: null,
        source: 'real-playwright-run',
        retryCount: 0,
        firstAttemptResult: null,
        finalResult: null,
        attachments: [],
      };
    }

    const id = prefixedId('EXEC', testCaseId.replace(/^TC-/, ''));
    const { artifact } = writeArtifact(runId, 'execution', id, {
      ...executionData,
      status: executionData.result === 'failed' ? 'partial' : 'ok',
    });
    results.push(artifact);
    appendAuditRecord(runId, { agent: 'execution', action: 'test-executed', testCaseId, result: executionData.result });
  }

  logger.info('Execution complete', { runId, count: results.length });
  return results;
}

module.exports = { run, runPlaywrightSpec, parsePlaywrightJsonReport };
