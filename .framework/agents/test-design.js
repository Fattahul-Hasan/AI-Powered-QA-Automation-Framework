// Test Design Agent (ARCHITECTURE.md Section 6).
//
// Converts approved (non-ambiguous) requirements into structured test case specs. Never
// designs a test case for a requirement that doesn't exist or is still ambiguous (Section 6:
// "NOT allowed to: Design a test case for a requirement that doesn't exist"; Section Q gate #1:
// ambiguous requirements must be clarified by a human first).

const { createLogger } = require('../lib/logger');
const { writeArtifact, listArtifacts } = require('../lib/artifact-store');
const { appendAuditRecord } = require('../lib/audit');
const { testCaseId } = require('../lib/ids');
const { similarity } = require('./failure-analysis');

const logger = createLogger('test-design');

const HIGH_RISK_CATEGORIES = new Set([
  'Payments',
  'PII / Sensitive Data',
  'User Account Deletion',
  'Financial Transactions',
  'Authentication / Authorization',
]);

// ARCHITECTURE.md Section 8: "Avoid duplicate test cases." A duplicate is the same requirement
// + the same scenario text.
function detectDuplicates(testCases) {
  const seen = new Map();
  const duplicates = [];
  for (const tc of testCases) {
    const key = `${tc.requirementId}::${tc.scenario.trim().toLowerCase()}`;
    if (seen.has(key)) {
      duplicates.push({ duplicate: tc, originalId: seen.get(key) });
    } else {
      seen.set(key, tc.id || key);
    }
  }
  return duplicates;
}

// PHASE 4, A8 (duplicate test detection extension): near-duplicate/similarity detection, for
// test cases that are worded differently but likely test the same thing -- distinct from
// `detectDuplicates` above (exact requirement+scenario match). Reuses the same Levenshtein
// `similarity()` already used by the Failure Analysis Agent for selector-drift confidence,
// rather than a second, duplicate string-similarity implementation. `threshold` is always
// caller-supplied (never a hardcoded "real" number, consistent with this framework's other
// scoring/threshold-based tools) and only compares test cases under the SAME requirement --
// never suggests two unrelated requirements' tests are duplicates of each other. Returns
// recommendations only; nothing is deleted or modified automatically.
function findSimilarTestCases(testCases, threshold) {
  if (typeof threshold !== 'number') {
    throw new Error('findSimilarTestCases requires an explicit numeric threshold -- no default is assumed.');
  }
  const similarPairs = [];
  for (let i = 0; i < testCases.length; i += 1) {
    for (let j = i + 1; j < testCases.length; j += 1) {
      const a = testCases[i];
      const b = testCases[j];
      if (a.requirementId !== b.requirementId) continue; // never compare across requirements
      const score = similarity(a.scenario, b.scenario);
      if (score >= threshold) {
        similarPairs.push({ testCaseIds: [a.id, b.id], requirementId: a.requirementId, similarityScore: Number(score.toFixed(2)) });
      }
    }
  }
  return similarPairs;
}

// Synthetic, dry-run-only test case designs for the two non-ambiguous requirements in the demo
// fixture set. REQ-DEMO-2 is deliberately left with zero designed test cases (a real gap for
// the Gap Analysis Agent to find). REQ-DEMO-3 is skipped entirely because it is ambiguous.
function designTestCasesFor(requirementArtifact) {
  const reqId = requirementArtifact.id;
  if (reqId === 'REQ-DEMO-1') {
    return [
      {
        id: testCaseId(reqId, 1),
        requirementId: reqId,
        module: requirementArtifact.data.module,
        feature: requirementArtifact.data.feature,
        scenario: "Verify the 'Get started' link navigates from the homepage",
        testType: 'functional',
        priority: 'P1',
        severity: 'high',
        risk: 'low',
        role: 'Visitor',
        preconditions: ['Homepage is reachable'],
        dataNeeds: ['visitorSessionTag'],
        steps: [
          "Navigate to the homepage",
          "Locate the link with accessible name 'Get started'",
          'Click the link',
        ],
        expectedResult: 'The visitor is navigated away from the homepage toward the documentation.',
        pageObjectsNeeded: ['HomePage'],
        automationCandidate: true,
        regressionCandidate: true,
        humanReviewRequired: false,
      },
      {
        id: testCaseId(reqId, 2),
        requirementId: reqId,
        module: requirementArtifact.data.module,
        feature: requirementArtifact.data.feature,
        scenario: "Verify the homepage exposes exactly one unambiguous 'Get started' call-to-action",
        testType: 'data-integrity',
        priority: 'P3',
        severity: 'low',
        risk: 'low',
        role: 'Visitor',
        preconditions: ['Homepage is reachable'],
        dataNeeds: [],
        steps: [
          'Navigate to the homepage',
          "Count elements with accessible name 'Get started'",
        ],
        expectedResult: 'Exactly one unambiguous call-to-action is present.',
        pageObjectsNeeded: ['HomePage'],
        automationCandidate: true,
        regressionCandidate: false,
        humanReviewRequired: false,
      },
    ];
  }
  return [];
}

async function run({ runId } = {}) {
  logger.info('Starting test design', { runId });
  const requirements = listArtifacts(runId, 'requirements');
  const allTestCases = [];

  for (const requirement of requirements) {
    const isAmbiguous = requirement.data.ambiguities.length > 0 || requirement.data.missingInformation.length > 0;
    if (isAmbiguous) {
      logger.warn('Skipping test design: requirement is ambiguous and requires human clarification first', {
        requirementId: requirement.id,
      });
      appendAuditRecord(runId, {
        agent: 'test-design',
        action: 'skipped-ambiguous-requirement',
        requirementId: requirement.id,
      });
      continue;
    }

    const designed = designTestCasesFor(requirement);
    if (designed.length === 0) {
      logger.info('No test cases designed for requirement (tracked as a gap, not an error)', {
        requirementId: requirement.id,
      });
    }
    for (const tc of designed) {
      const highRiskCategory = requirement.data.highRiskCategory;
      const humanReviewRequired = HIGH_RISK_CATEGORIES.has(highRiskCategory);
      const { artifact } = writeArtifact(runId, 'test-design', tc.id, {
        ...tc,
        humanReviewRequired,
        highRiskCategory: highRiskCategory || null,
        duplicateOf: null,
      });
      allTestCases.push(artifact);
      appendAuditRecord(runId, {
        agent: 'test-design',
        action: 'test-case-designed',
        testCaseId: tc.id,
        requirementId: requirement.id,
        humanReviewRequired,
      });
    }
  }

  const duplicates = detectDuplicates(allTestCases.map((a) => a.data));
  if (duplicates.length > 0) {
    logger.warn('Duplicate test cases detected', { count: duplicates.length });
  }

  logger.info('Test design complete', { runId, count: allTestCases.length });
  return allTestCases;
}

module.exports = { run, designTestCasesFor, detectDuplicates, findSimilarTestCases };
