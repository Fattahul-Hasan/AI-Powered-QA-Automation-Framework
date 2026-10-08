#!/usr/bin/env node
// Framework CLI: dispatches individual agents or the full dry-run pipeline.
// Usage: node .framework/cli.js <agent-name|dry-run> [--run-id=<id>] [--url=<discoveryUrl>]

const { newRunId } = require('./lib/ids');
const artifactStore = require('./lib/artifact-store');
const { runDryRunPipeline } = require('./agents/orchestrator');
// PHASE 5, B5 (artifact management): opt-in pruning, never invoked automatically.
const { pruneRunsOlderThan, pruneRunsKeepingLast } = require('./lib/artifact-retention');
// PHASE 5, B7/B8: real evidence wiring for quality gates / release readiness.
const { evaluateReleaseReadinessForRun } = require('./lib/release-evidence');

const AGENTS = {
  'requirement-analysis': require('./agents/requirement-analysis'),
  'product-discovery': require('./agents/product-discovery'),
  'test-design': require('./agents/test-design'),
  'test-data': require('./agents/test-data'),
  'automation-generation': require('./agents/automation-generation'),
  execution: require('./agents/execution'),
  'failure-analysis': require('./agents/failure-analysis'),
  'self-healing': require('./agents/self-healing'),
  'gap-analysis': require('./agents/gap-analysis'),
  regression: require('./agents/regression'),
  reporting: require('./agents/reporting'),
};

function parseArgs(argv) {
  const args = { _: [] };
  for (const raw of argv) {
    const match = raw.match(/^--([a-zA-Z-]+)=(.*)$/);
    if (match) args[match[1]] = match[2];
    else args._.push(raw);
  }
  return args;
}

async function main() {
  const [, , command, ...rest] = process.argv;
  const args = parseArgs(rest);

  if (!command) {
    console.error('Usage: node .framework/cli.js <agent-name|dry-run> [--run-id=<id>]');
    console.error(`Known agents: ${Object.keys(AGENTS).join(', ')}, dry-run`);
    process.exitCode = 1;
    return;
  }

  if (command === 'dry-run') {
    const runId = args['run-id'] || newRunId();
    const result = await runDryRunPipeline({ runId, discoveryUrl: args.url });
    console.log(`\nDry-run pipeline complete. runId=${result.runId}`);
    console.log(`Report: ${result.reportsDir}`);
    return;
  }

  if (command === 'prune-runs') {
    const dryRun = args.apply !== 'true';
    const result = args['keep-last']
      ? pruneRunsKeepingLast(Number(args['keep-last']), { dryRun })
      : pruneRunsOlderThan(Number(args['older-than-days'] || 30), { dryRun });
    console.log(dryRun
      ? `DRY RUN (pass --apply=true to actually delete). Would prune ${result.prunedRunIds.length} run(s):`
      : `Pruned ${result.prunedRunIds.length} run(s):`);
    for (const runId of result.prunedRunIds) console.log(`  - ${runId}`);
    return;
  }

  if (command === 'release-readiness') {
    const runId = args['run-id'] || artifactStore.latestRunId();
    if (!runId) {
      console.error('No run found. Run `npm run framework:dry-run` first, or pass --run-id=<id>.');
      process.exitCode = 1;
      return;
    }
    let thresholds;
    if (args.thresholds) {
      const fs = require('fs');
      const raw = JSON.parse(fs.readFileSync(args.thresholds, 'utf8'));
      // Strip comment-style keys (leading underscore) -- a documentation convention in the
      // example config, not a real gate name.
      thresholds = Object.fromEntries(Object.entries(raw).filter(([key]) => !key.startsWith('_')));
    }
    const result = evaluateReleaseReadinessForRun(runId, thresholds);
    console.log(`Release readiness for ${runId}: ${result.readiness.status}`);
    console.log(`Reason: ${result.readiness.reason}`);
    console.log('Metrics (real, extracted from this run):', JSON.stringify(result.metrics, null, 2));
    console.log(`Pending human approvals: ${result.pendingHumanApprovals}`);
    console.log(`Critical requirement gaps: ${result.criticalRequirementGaps}`);
    if (!thresholds) {
      console.log('(No --thresholds=<path> supplied -- quality gates were not evaluated, which is why evidence is insufficient unless already BLOCKED above.)');
    }
    return;
  }

  const agent = AGENTS[command];
  if (!agent) {
    console.error(`Unknown agent "${command}". Known: ${Object.keys(AGENTS).join(', ')}, dry-run`);
    process.exitCode = 1;
    return;
  }

  const runId = args['run-id'] || artifactStore.latestRunId() || newRunId();
  artifactStore.ensureRun(runId);
  console.log(`Running agent "${command}" against runId=${runId}`);
  const result = await agent.run({ runId, ...(args.url ? { url: args.url } : {}) });
  console.log(`Agent "${command}" complete. Artifacts produced: ${Array.isArray(result) ? result.length : 1}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exitCode = 1;
});
