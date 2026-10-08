// Automation Generation Agent (ARCHITECTURE.md Section 8).
//
// ARCHITECTURE.md Section 27 (dry-run mode) lists "Automation Metadata" as the simulated
// artifact, not generated code -- this harness follows that literally: it links test cases to
// automation that already exists (the preserved tests/home.spec.js + pages/HomePage.js), and
// honestly marks test cases with no automation yet as "pending-automation". It never writes a
// new page object or spec file during this pass, so it cannot invent selectors for anything.

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../lib/logger');
const { writeArtifact, listArtifacts } = require('../lib/artifact-store');
const { appendAuditRecord } = require('../lib/audit');
const { prefixedId } = require('../lib/ids');

const logger = createLogger('automation-generation');
const REPO_ROOT = path.join(__dirname, '..', '..');

// Known mapping from a test-case scenario to already-existing automation. This is the only
// "generation" logic in dry-run: recognizing and linking to real, already-reviewed code, never
// fabricating new code against the demo target during this pass.
const EXISTING_AUTOMATION_MAP = {
  'TC-DEMO-1-01': {
    specFile: 'tests/home.spec.js',
    pageObjectsTouched: ['pages/HomePage.js', 'pages/BasePage.js'],
  },
};

async function run({ runId } = {}) {
  logger.info('Starting automation generation', { runId });
  const testCases = listArtifacts(runId, 'test-design');
  const results = [];

  for (const tc of testCases) {
    const existing = EXISTING_AUTOMATION_MAP[tc.id];
    let automationStatus;
    let specFile = null;
    let pageObjectsTouched = [];
    let generatedNewFiles = false;

    if (existing && fs.existsSync(path.join(REPO_ROOT, existing.specFile))) {
      automationStatus = 'existing-linked';
      specFile = existing.specFile;
      pageObjectsTouched = existing.pageObjectsTouched;
    } else {
      automationStatus = 'pending-automation';
      logger.info('No automation exists yet for this test case; recorded as pending (not generated in dry-run per ARCHITECTURE.md Section 27)', {
        testCaseId: tc.id,
      });
    }

    const id = prefixedId('AUTO', tc.id.replace(/^TC-/, ''));
    const { artifact } = writeArtifact(runId, 'automation', id, {
      testCaseId: tc.id,
      specFile,
      pageObjectsTouched,
      automationStatus,
      generatedNewFiles,
    });
    results.push(artifact);
    appendAuditRecord(runId, { agent: 'automation-generation', action: 'automation-linked', testCaseId: tc.id, automationStatus });
  }

  logger.info('Automation generation complete', { runId, count: results.length });
  return results;
}

module.exports = { run, EXISTING_AUTOMATION_MAP };
