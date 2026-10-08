// Audit log: append-only record of every agent action that changes state or proposes a change
// (ARCHITECTURE.md Section H safeguard #4: "nothing is silent"). One JSON-lines file per run.

const fs = require('fs');
const path = require('path');
const { runDir } = require('./artifact-store');

function auditLogPath(runId) {
  return path.join(runDir(runId), 'audit.jsonl');
}

function appendAuditRecord(runId, record) {
  fs.mkdirSync(runDir(runId), { recursive: true });
  const entry = { timestamp: new Date().toISOString(), ...record };
  fs.appendFileSync(auditLogPath(runId), `${JSON.stringify(entry)}\n`);
  return entry;
}

function readAuditLog(runId) {
  const filePath = auditLogPath(runId);
  if (!fs.existsSync(filePath)) return [];
  return fs
    .readFileSync(filePath, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line));
}

module.exports = { auditLogPath, appendAuditRecord, readAuditLog };
