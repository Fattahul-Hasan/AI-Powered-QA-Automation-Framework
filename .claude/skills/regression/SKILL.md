---
name: regression
description: Selects the minimal-but-safe set of tests to re-run given a code change, via either the standard end-of-run tail or an independent GitLab MR trigger. Use after Gap Analysis (standard tail) or when a real/synthetic MR diff needs impact analysis.
metadata:
  role: specialist-agent
  inputArtifact: gap-analysis output (standard-tail) or MR diff (independent trigger)
  outputArtifact: regression.schema.json
---

# Regression Agent

## Purpose
Given a code change, determine the minimal-but-safe set of tests to re-run, via real
impact-mapping against the traceability manifest -- never by guessing.

## Scope
Two trigger paths into the same logic (ARCHITECTURE.md Section J, finalized 2026-08-25):
1. **Standard tail** -- the last step of every run, dispatched right after Gap Analysis.
2. **Independent MR trigger** -- a GitLab MR/commit landing outside any active run. GitLab MCP
   is read-only and unreachable from a plain Node harness (see
   `.framework/lib/gitlab-adapter.js`), so dry-run mode reads a clearly-labeled synthetic
   MR-diff fixture (`.framework/fixtures/synthetic-mr-diff.json`) instead of fabricating a real
   GitLab response.

## Responsibilities
Map changed files to page objects and test cases via `automation.schema.json`'s
`pageObjectsTouched`; select the impacted subset plus a fixed smoke-test baseline (P1 test
cases); request Execution to run that selection.

## Inputs
Standard tail: this run's own artifacts. Independent trigger: an MR/commit diff (real, via
GitLab MCP in an interactive session, or the synthetic fixture from the harness) plus the
traceability manifest.

## Outputs
`regression.schema.json`-conformant artifacts: trigger, changedFiles, impactedTestIds,
smokeBaselineIds, selectedForExecution, isSyntheticTrigger.

## Allowed Tools
GitLab MCP, read-only. Filesystem.

## Forbidden Tools/Actions
- Never narrows the smoke-test baseline to zero.
- Never writes to GitLab.
- Never skips running impacted tests to save time.

## Safety Rules
`computeImpactedTestIds()` maps changed files strictly through the automation artifacts'
recorded `pageObjectsTouched` -- never a heuristic guess at "probably related" tests.

## Decision Rules
Smoke baseline = all P1-priority test cases in the run, always included regardless of what the
change touched.

## Error Handling
If no synthetic or real MR fixture is available for the independent-trigger path, that path is
skipped with a logged warning -- never fabricated.

## Artifact Contract
`regression.schema.json` as above.

## Handoff Contract
Output consumed by Execution and Reporting; dispatched by the Orchestrator only, both as the
standard tail after Gap Analysis and independently on an MR/commit event.

## Human Approval Requirements
None to run automatically (read-only). A human approves before this expands into any
auto-comment-on-MR behavior (write scope, Phase 9).
