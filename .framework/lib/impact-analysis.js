// PHASE 4, A2 (requirement impact analysis). Given a requirement-diff result (A1) and the
// existing traceability manifest, determines affected requirements/test cases/automation/
// regression scope using ONLY real manifest mappings -- never invents a relationship. A newly
// added requirement with no manifest entry yet correctly produces an empty test-case list for
// itself (it has no automation yet, which is true, not a gap in this function).
//
// Explicitly distinct from regression.js's impact mapping: this module is *requirement-change*
// driven (consumes A1's diff + the manifest's requirement->testCase->automation links);
// regression.js's `computeImpactedTestIds` is *file-change* driven (consumes a changed-files
// list + automation.schema.json's `pageObjectsTouched`). Same underlying manifest data, two
// different trigger signals -- not a duplicate analyzer.

function computeChangeImpact(requirementDiff, manifest) {
  const affectedRequirementIds = [
    ...requirementDiff.added,
    ...requirementDiff.removed,
    ...requirementDiff.modified.map((m) => m.id),
  ];

  const requirements = (manifest && manifest.requirements) || {};
  const affectedTestCaseIds = new Set();
  const affectedAutomationFiles = new Set();

  for (const requirementId of affectedRequirementIds) {
    const entry = requirements[requirementId];
    if (!entry) continue; // no known mapping yet -- real absence, not fabricated
    for (const testCaseId of entry.testCaseIds || []) affectedTestCaseIds.add(testCaseId);
    for (const file of Object.values(entry.automation || {})) affectedAutomationFiles.add(file);
  }

  return {
    affectedRequirementIds,
    affectedTestCaseIds: [...affectedTestCaseIds],
    affectedAutomationFiles: [...affectedAutomationFiles],
    regressionScopeTestCaseIds: [...affectedTestCaseIds],
  };
}

function persistImpactAnalysis(runId, id, impactResult) {
  const { writeArtifact } = require('./artifact-store');
  return writeArtifact(runId, 'impact-analysis', id, impactResult);
}

module.exports = { computeChangeImpact, persistImpactAnalysis };
