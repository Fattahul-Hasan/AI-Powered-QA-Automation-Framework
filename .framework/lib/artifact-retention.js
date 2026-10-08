// PHASE 5, B5 (artifact management -- cleaned according to policy). Both functions default to
// `dryRun: true` -- they report what WOULD be pruned unless explicitly told to actually delete.
// Never auto-invoked by any agent or the orchestrator; this is an opt-in operator action only,
// exposed via `npm run artifact:prune`.

const fs = require('fs');
const { listRuns, runDir } = require('./artifact-store');

function extractTimestampFromRunId(runId) {
  const match = runId.match(/^run-(\d+)-/);
  return match ? Number(match[1]) : null;
}

function pruneRuns(candidateRunIds, { dryRun = true } = {}) {
  if (!dryRun) {
    for (const runId of candidateRunIds) fs.rmSync(runDir(runId), { recursive: true, force: true });
  }
  return { prunedRunIds: candidateRunIds, dryRun };
}

function pruneRunsOlderThan(days, { dryRun = true, now = new Date(), runIds = listRuns() } = {}) {
  const cutoffMs = now.getTime() - days * 24 * 60 * 60 * 1000;
  const candidates = runIds.filter((runId) => {
    const ts = extractTimestampFromRunId(runId);
    return ts !== null && ts < cutoffMs;
  });
  return pruneRuns(candidates, { dryRun });
}

function pruneRunsKeepingLast(n, { dryRun = true, runIds = listRuns() } = {}) {
  const sorted = [...runIds].sort(); // run ids embed a timestamp, so lexical sort is chronological
  const candidates = sorted.length > n ? sorted.slice(0, sorted.length - n) : [];
  return pruneRuns(candidates, { dryRun });
}

module.exports = { pruneRunsOlderThan, pruneRunsKeepingLast, extractTimestampFromRunId };
