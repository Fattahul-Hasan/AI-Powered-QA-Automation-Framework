// Failure Analysis Agent (ARCHITECTURE.md Section 10).
//
// Real rule-based classification -- never defaults to blaming automation over a possible real
// application defect ("Do not incorrectly classify application defects as automation
// failures"), and only ever routes `selector-drift` toward Self-Healing.

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../lib/logger');
const { writeArtifact, listArtifacts } = require('../lib/artifact-store');
const { appendAuditRecord } = require('../lib/audit');
const { prefixedId } = require('../lib/ids');

const logger = createLogger('failure-analysis');

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j += 1) dp[0][j] = j;
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function similarity(a, b) {
  if (!a || !b) return 0;
  const distance = levenshtein(a.toLowerCase(), b.toLowerCase());
  return 1 - distance / Math.max(a.length, b.length);
}

// Real, rule-based classifier. Returns { category, confidence, suspectedRootCause }.
function classifyFailure({ errorMessage = '', domSnapshotBefore, domSnapshotAfter }) {
  const msg = errorMessage.toLowerCase();

  if (domSnapshotBefore && domSnapshotAfter && domSnapshotBefore.role === domSnapshotAfter.role) {
    const sim = similarity(domSnapshotBefore.accessibleName, domSnapshotAfter.accessibleName);
    const confidence = sim >= 0.7 ? 'high' : sim >= 0.4 ? 'medium' : 'low';
    return {
      category: 'selector-drift',
      confidence,
      suspectedRootCause: `Element role "${domSnapshotBefore.role}" accessible name changed from "${domSnapshotBefore.accessibleName}" to "${domSnapshotAfter.accessibleName}" (similarity ${sim.toFixed(2)}).`,
    };
  }
  if (/expect\(|toequal|tobe\(|assertion/.test(msg)) {
    return { category: 'assertion-failure', confidence: 'high', suspectedRootCause: 'Assertion did not match actual value.' };
  }
  if (/401|403|unauthorized|forbidden|login/.test(msg)) {
    return { category: 'authentication-failure', confidence: 'medium', suspectedRootCause: 'Request was unauthenticated/unauthorized.' };
  }
  if (/econnrefused|net::|dns|enotfound/.test(msg)) {
    return { category: 'environment-failure', confidence: 'medium', suspectedRootCause: 'Target environment unreachable.' };
  }
  if (/navigat/.test(msg)) {
    return { category: 'navigation-failure', confidence: 'low', suspectedRootCause: 'Navigation did not complete as expected.' };
  }
  if (/timeout/.test(msg)) {
    return { category: 'timeout', confidence: 'low', suspectedRootCause: 'Action timed out with no clear DOM-change evidence of a selector rename.' };
  }
  // Deliberately conservative default: never assume automation is at fault without evidence.
  return {
    category: 'application-defect',
    confidence: 'low',
    suspectedRootCause: 'No automation-side pattern matched; requires human triage before assuming an application defect, but not auto-classified as a tooling issue either.',
  };
}

function recommendedNextAgent(category) {
  return category === 'selector-drift' ? 'self-healing' : 'human';
}

// PHASE 4, A5 (advanced failure analysis): a higher-level grouping on top of the existing 10
// categories, distinguishing failures where the test genuinely executed and produced a real
// signal ("test-failure") from failures where execution itself was compromised by something
// external ("environment-infrastructure"). `application-defect` deliberately maps to
// `unknown` -- grouping it as a test-failure would repeat exactly the mistake this agent
// already guards against ("Do not incorrectly classify application defects as automation
// failures"), and it isn't an environment/infrastructure issue either. Any category this
// function doesn't recognize also falls back to `unknown`, never guessed into one of the two
// confident buckets.
const FAILURE_GROUP_BY_CATEGORY = {
  'selector-drift': 'test-failure',
  'assertion-failure': 'test-failure',
  'test-data-failure': 'test-failure',
  'flaky-test': 'test-failure',
  timeout: 'environment-infrastructure',
  'navigation-failure': 'environment-infrastructure',
  'authentication-failure': 'environment-infrastructure',
  'environment-failure': 'environment-infrastructure',
  'infrastructure-failure': 'environment-infrastructure',
  'application-defect': 'unknown',
};

function classifyFailureGroup(category) {
  return FAILURE_GROUP_BY_CATEGORY[category] || 'unknown';
}

const DEFAULT_FIXTURES_DIR = path.join(__dirname, '..', 'fixtures');

function findSyntheticFixtures(fixturesDir) {
  if (!fs.existsSync(fixturesDir)) return [];
  return fs
    .readdirSync(fixturesDir)
    .filter((f) => /^synthetic-failure-execution.*\.json$/.test(f))
    .map((f) => path.join(fixturesDir, f));
}

async function run({ runId, fixturesDir = DEFAULT_FIXTURES_DIR } = {}) {
  logger.info('Starting failure analysis', { runId });
  const executions = listArtifacts(runId, 'execution');
  const realFailures = executions.filter((e) => e.data.result === 'failed');
  const results = [];

  for (const exec of realFailures) {
    const classification = classifyFailure({ errorMessage: exec.data.errorMessage || '' });
    const id = prefixedId('FA', exec.data.testCaseId.replace(/^TC-/, ''));
    const { artifact } = writeArtifact(runId, 'failure-analysis', id, {
      testId: exec.data.testCaseId,
      category: classification.category,
      failureGroup: classifyFailureGroup(classification.category),
      confidence: classification.confidence,
      suspectedRootCause: classification.suspectedRootCause,
      recommendedNextAgent: recommendedNextAgent(classification.category),
      isSynthetic: false,
      filePath: null,
      propertyGuess: null,
      domSnapshotBefore: null,
      domSnapshotAfter: null,
    });
    results.push(artifact);
  }

  // Demonstrates all three self-healing confidence tiers (ARCHITECTURE.md Section H) against
  // clearly-labeled synthetic scenarios -- never a real application defect.
  for (const fixturePath of findSyntheticFixtures(fixturesDir)) {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
    const classification = classifyFailure(fixture);
    const id = prefixedId('FA', `${fixture.testCaseId.replace(/^TC-/, '')}-SYNTH`);
    const { artifact } = writeArtifact(runId, 'failure-analysis', id, {
      testId: fixture.testCaseId,
      category: classification.category,
      failureGroup: classifyFailureGroup(classification.category),
      confidence: classification.confidence,
      suspectedRootCause: classification.suspectedRootCause,
      recommendedNextAgent: recommendedNextAgent(classification.category),
      isSynthetic: true,
      filePath: fixture.filePath || null,
      propertyGuess: fixture.propertyGuess || null,
      domSnapshotBefore: fixture.domSnapshotBefore || null,
      domSnapshotAfter: fixture.domSnapshotAfter || null,
    }, { evidence: [`Synthetic dry-run fixture: ${fixturePath} (${fixture.scenarioLabel})`] });
    results.push(artifact);
    logger.info('Processed synthetic failure fixture to demonstrate the fail branch', {
      testId: fixture.testCaseId,
      category: classification.category,
      confidence: classification.confidence,
    });
  }

  for (const artifact of results) {
    appendAuditRecord(runId, {
      agent: 'failure-analysis',
      action: 'failure-classified',
      testId: artifact.data.testId,
      category: artifact.data.category,
      confidence: artifact.data.confidence,
      isSynthetic: artifact.data.isSynthetic,
    });
  }

  logger.info('Failure analysis complete', { runId, count: results.length });
  return results;
}

module.exports = { run, classifyFailure, recommendedNextAgent, similarity, findSyntheticFixtures, classifyFailureGroup };
