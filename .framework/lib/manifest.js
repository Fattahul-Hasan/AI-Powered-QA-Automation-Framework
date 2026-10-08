// Traceability manifest (ARCHITECTURE.md Section A). "The Orchestrator is the only writer of
// manifest.json itself" -- enforced here, not just documented: any caller other than
// 'orchestrator' is rejected.

const fs = require('fs');
const path = require('path');
const { assertValid } = require('./schema-validator');
const { runDir } = require('./artifact-store');

function manifestPath(runId) {
  return path.join(runDir(runId), 'manifest.json');
}

function loadManifest(runId) {
  const filePath = manifestPath(runId);
  if (!fs.existsSync(filePath)) {
    return { runId, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), requirements: {} };
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function saveManifest(runId, manifest, callerAgent) {
  if (callerAgent !== 'orchestrator') {
    throw new Error(
      `manifest.json may only be written by the Orchestrator (ARCHITECTURE.md Section A). Rejected write from "${callerAgent}".`,
    );
  }
  manifest.updatedAt = new Date().toISOString();
  assertValid('manifest.schema.json', manifest);
  fs.mkdirSync(runDir(runId), { recursive: true });
  fs.writeFileSync(manifestPath(runId), JSON.stringify(manifest, null, 2));
  return manifest;
}

function upsertRequirement(runId, requirementId, patch, callerAgent) {
  const manifest = loadManifest(runId);
  const existing = manifest.requirements[requirementId] || { testCaseIds: [], automation: {}, lastExecution: {} };
  manifest.requirements[requirementId] = { ...existing, ...patch };
  return saveManifest(runId, manifest, callerAgent);
}

module.exports = { manifestPath, loadManifest, saveManifest, upsertRequirement };
