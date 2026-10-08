// Artifact store: the file-based data contract between agents (ARCHITECTURE.md Section N).
// Agents never call each other directly -- they write/read artifacts here, and the
// Orchestrator alone sequences work and updates manifest.json.

const fs = require('fs');
const path = require('path');
const { assertValid } = require('./schema-validator');

const RUNS_DIR = path.join(__dirname, '..', 'runs');

const PHASE_SCHEMA = {
  requirements: 'requirement.schema.json',
  discovery: 'discovery.schema.json',
  'test-design': 'test-case.schema.json',
  'test-data': 'test-data.schema.json',
  automation: 'automation.schema.json',
  execution: 'execution.schema.json',
  'failure-analysis': 'failure-analysis.schema.json',
  'self-healing': 'self-healing.schema.json',
  'gap-analysis': 'gap-analysis.schema.json',
  regression: 'regression.schema.json',
  reporting: 'report.schema.json',
  // PHASE 4/5 additions (additive -- existing phase entries above are unchanged):
  'requirement-change': 'requirement-change.schema.json',
  'impact-analysis': 'impact-analysis.schema.json',
};

// A phase's directory name doesn't always match the agent name the schema requires in
// `producedBy` (e.g. phase "requirements" is produced by agent "requirement-analysis").
const PHASE_PRODUCER = {
  requirements: 'requirement-analysis',
  discovery: 'product-discovery',
  'test-design': 'test-design',
  'test-data': 'test-data',
  automation: 'automation-generation',
  execution: 'execution',
  'failure-analysis': 'failure-analysis',
  'self-healing': 'self-healing',
  'gap-analysis': 'gap-analysis',
  regression: 'regression',
  reporting: 'reporting',
  // PHASE 4/5 additions (additive -- existing phase entries above are unchanged):
  'requirement-change': 'requirement-diff',
  'impact-analysis': 'impact-analysis',
};

function runDir(runId) {
  return path.join(RUNS_DIR, runId);
}

function phaseDir(runId, phase) {
  return path.join(runDir(runId), phase);
}

function ensureRun(runId) {
  fs.mkdirSync(runDir(runId), { recursive: true });
}

function writeArtifact(runId, phase, id, data, { evidence = [] } = {}) {
  const schemaFile = PHASE_SCHEMA[phase];
  if (!schemaFile) throw new Error(`Unknown artifact phase "${phase}"`);

  const artifact = {
    id,
    runId,
    phase,
    producedBy: data.producedBy || PHASE_PRODUCER[phase] || phase,
    schemaVersion: 1,
    status: data.status || 'ok',
    evidence,
    data: { ...data },
  };
  delete artifact.data.producedBy;
  delete artifact.data.status;

  assertValid(schemaFile, artifact);

  const dir = phaseDir(runId, phase);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, `${id}.json`);
  fs.writeFileSync(filePath, JSON.stringify(artifact, null, 2));
  return { filePath, artifact };
}

function readArtifact(runId, phase, id) {
  const filePath = path.join(phaseDir(runId, phase), `${id}.json`);
  if (!fs.existsSync(filePath)) return null;
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function listArtifacts(runId, phase) {
  const dir = phaseDir(runId, phase);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
}

function listRuns() {
  if (!fs.existsSync(RUNS_DIR)) return [];
  return fs
    .readdirSync(RUNS_DIR)
    .filter((name) => fs.statSync(path.join(RUNS_DIR, name)).isDirectory())
    .sort();
}

function latestRunId() {
  const runs = listRuns();
  return runs.length ? runs[runs.length - 1] : null;
}

module.exports = {
  RUNS_DIR,
  PHASE_SCHEMA,
  runDir,
  phaseDir,
  ensureRun,
  writeArtifact,
  readArtifact,
  listArtifacts,
  listRuns,
  latestRunId,
};
