// Self-Healing Agent (ARCHITECTURE.md Section 11 / Section H, finalized Decision 1, 2026-08-25).
//
// CRITICAL: this module must never let a proposed change reach "applied" if it touches an
// assertion, expected outcome, validation logic, or test intent -- enforced here as code, not
// as a comment. In dry-run mode it additionally NEVER performs a real file write, regardless of
// confidence: `dryRun`, `realFileWritePerformed`, `mrOpened`, and `mergeApprovedByHuman` are all
// hard-coded false by the self-healing.schema.json contract itself.

const { createLogger } = require('../lib/logger');
const { writeArtifact, listArtifacts } = require('../lib/artifact-store');
const { appendAuditRecord } = require('../lib/audit');
const { prefixedId } = require('../lib/ids');

const logger = createLogger('self-healing');

const ASSERTION_PATTERN = /expect\(|\.toBe\(|\.toEqual\(|\.toHaveText\(|\.toHaveValue\(|\.toHaveCount\(|\.toHaveTitle\(|\.toHaveURL\(/;

// Hard, mechanical guard (ARCHITECTURE.md Section H safeguard #2). Any proposed diff is run
// through this before a decision is finalized -- if it matches, the change is rejected, full
// stop, regardless of confidence score. This function is directly unit-tested
// (tests/framework/self-healing-safety.spec.js) with a deliberately "poisoned" diff.
function assertionGuard(diffText) {
  return ASSERTION_PATTERN.test(diffText);
}

function buildLocatorDiff({ filePath, before, after }) {
  return [
    `--- a/${filePath}`,
    `+++ b/${filePath}`,
    '@@',
    `-    this.${before.propertyGuess} = page.getByRole('${before.role}', { name: '${before.accessibleName}' });`,
    `+    this.${before.propertyGuess} = page.getByRole('${after.role}', { name: '${after.accessibleName}' });`,
  ].join('\n');
}

function decide(confidence) {
  if (confidence === 'high') return 'auto-applied-locally-pending-merge-review';
  if (confidence === 'medium') return 'pending-approval';
  return 'no-change-proposed';
}

async function run({ runId } = {}) {
  logger.info('Starting self-healing', { runId });
  const analyses = listArtifacts(runId, 'failure-analysis');
  // Structural safeguard: only ever consider failures Failure Analysis itself classified
  // selector-drift AND recommended for self-healing. No override is possible here.
  const eligible = analyses.filter((a) => a.data.category === 'selector-drift' && a.data.recommendedNextAgent === 'self-healing');
  const results = [];

  for (const analysis of eligible) {
    const decision = decide(analysis.data.confidence);
    // "Low confidence -> no diff generated at all" (ARCHITECTURE.md Section H). This must be
    // decided BEFORE building anything -- a diff is never even constructed for a low-confidence
    // finding, let alone persisted.
    if (decision === 'no-change-proposed') {
      const id = prefixedId('SH', analysis.data.testId.replace(/^TC-/, ''));
      const { artifact } = writeArtifact(runId, 'self-healing', id, {
        testId: analysis.data.testId,
        sourceFailureAnalysisId: analysis.id,
        proposedDiff: '[No diff generated: confidence is low, so no automatic change is proposed. Human investigation required.]',
        confidence: analysis.data.confidence,
        filesTouched: [],
        assertionTouched: false,
        changeScope: null,
        rerunResult: 'not-run',
        decision,
        dryRun: true,
        realFileWritePerformed: false,
        mrOpened: false,
        mergeApprovedByHuman: false,
      });
      results.push(artifact);
      appendAuditRecord(runId, {
        agent: 'self-healing', action: 'healing-proposal', testId: analysis.data.testId,
        confidence: analysis.data.confidence, decision, dryRun: true,
      });
      continue;
    }

    // Reconstruct the before/after pair from the evidence Failure Analysis actually recorded
    // for this scenario (from real DOM inspection in a real, non-dry-run implementation; from
    // the labeled synthetic fixture here). Falls back to a generic placeholder only if that
    // evidence is somehow absent, rather than fabricating a specific-looking value.
    const filePath = analysis.data.filePath || 'pages/modules/UnknownPage.js';
    const propertyGuess = analysis.data.propertyGuess || 'unknownLocator';
    const before = analysis.data.domSnapshotBefore || { role: 'unknown', accessibleName: 'unknown' };
    const after = analysis.data.domSnapshotAfter || { role: 'unknown', accessibleName: 'unknown' };
    const candidateDiff = buildLocatorDiff({
      filePath,
      before: { ...before, propertyGuess },
      after: { ...after, propertyGuess },
    });

    const touchesAssertion = assertionGuard(candidateDiff);
    let finalDecision = decision;
    let proposedDiff = candidateDiff;
    let changeScope = 'locator-level';
    let filesTouched = [filePath];

    if (touchesAssertion) {
      // The check runs unconditionally on every candidate regardless of confidence -- there is
      // no code path that skips it, even though this demo's locator-only diffs never trigger it.
      finalDecision = 'rejected';
      proposedDiff = '[REJECTED: candidate diff touched an assertion pattern -- self-healing may never do this, at any confidence.]';
      changeScope = null;
      filesTouched = [];
      logger.error('Self-healing candidate rejected by assertion guard', { testId: analysis.data.testId });
    }

    const id = prefixedId('SH', analysis.data.testId.replace(/^TC-/, ''));
    const { artifact } = writeArtifact(runId, 'self-healing', id, {
      testId: analysis.data.testId,
      sourceFailureAnalysisId: analysis.id,
      proposedDiff,
      confidence: analysis.data.confidence,
      filesTouched,
      assertionTouched: false, // always false in what we persist -- guard above ensures this
      changeScope,
      rerunResult: 'not-run', // dry-run: no real file changed, so no real re-run is meaningful
      decision: finalDecision,
      dryRun: true,
      realFileWritePerformed: false,
      mrOpened: false,
      mergeApprovedByHuman: false,
    }, { evidence: [`Note: hypothetical fix targets ${filePath}, which does not exist yet (test case is still pending-automation) -- this is a dry-run demonstration, not a real applied change.`] });
    results.push(artifact);

    appendAuditRecord(runId, {
      agent: 'self-healing',
      action: 'healing-proposal',
      testId: analysis.data.testId,
      confidence: analysis.data.confidence,
      decision: finalDecision,
      assertionGuardTriggered: touchesAssertion,
      dryRun: true,
    });
  }

  logger.info('Self-healing complete', { runId, count: results.length });
  return results;
}

module.exports = { run, assertionGuard, buildLocatorDiff, decide, ASSERTION_PATTERN };
