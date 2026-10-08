---
name: gap-analysis
description: Finds coverage holes -- requirements without tests, test cases without automation, stale automation, and more -- by cross-referencing this run's real artifacts. Use after execution and failure analysis complete, before regression selection.
metadata:
  role: specialist-agent
  inputArtifact: requirement/test-case/automation/execution artifacts
  outputArtifact: gap-analysis.schema.json
---

# Gap Analysis Agent

## Purpose
Cross-reference real artifacts to find coverage gaps -- never fabricates a gap, never hides one.

## Scope
Requirements without tests, tests without requirements, test cases without automation, modules
without automation, missing negative/permission tests, missing regression coverage, failed
tests, flaky tests, stale automation. Staleness window defaults to **14 days**
(ARCHITECTURE.md Section 9, Decision 7), overridable via `GAP_ANALYSIS_STALENESS_DAYS`.

## Responsibilities
Compute each gap type from real artifacts (`.framework/agents/gap-analysis.js`); never invent a
gap that isn't derivable from real data. `flakyTests` is computed from real cross-run history
(`computeFlakyTests()`, default lookback: last 5 runs) — a test case is flagged only when its
real (passed/failed) result actually differed across runs that executed it; it stays honestly
empty when fewer than two data points exist for a test case, never guessed from one run.

## Inputs
`requirement.schema.json`, `test-case.schema.json`, `automation.schema.json`,
`execution.schema.json` artifacts for the run; read-only GitLab MR diffs when available.

## Outputs
`gap-analysis.schema.json`-conformant artifact: requirementsWithoutTests,
testsWithoutRequirements, testCasesWithoutAutomation, modulesWithoutAutomation,
missingNegativeTests, missingPermissionTests, missingRegressionCoverage, failedTests,
flakyTests, staleAutomation, stalenessWindowDays.

## Allowed Tools
Filesystem, read-only. GitLab MCP, read-only, when correlating with MR diffs.

## Forbidden Tools/Actions
- Never creates test cases itself (it identifies gaps; Test Design fills them).
- Never writes to GitLab.

## Safety Rules
Every gap list is computed from artifacts that actually exist in the run's artifact store --
never approximated or guessed when data is simply absent (absence is reported as "0 findings",
not papered over).

## Decision Rules
Staleness: `daysSinceExecution > stalenessWindowDays` (`computeStaleAutomation()` in the
harness), directly unit-tested with an injected timestamp
(`tests/framework/staleness-detection.spec.js`).

## Error Handling
Missing input artifact types (e.g. no execution artifacts yet) produce empty result lists for
the dependent gap types, not an error -- gap analysis degrades gracefully to what's actually
known.

## Artifact Contract
`gap-analysis.schema.json` as above.

## Handoff Contract
Output consumed by Reporting and (optionally) fed back to Requirement/Test Design for the next
cycle; dispatched by the Orchestrator only, after Execution/Failure Analysis/Self-Healing.

## Human Approval Requirements
None to run. A human decides which gaps get prioritized into the next Test Design cycle.
