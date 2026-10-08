---
name: failure-analysis
description: Triages every failed test into a root-cause category before anyone (human or Self-Healing Agent) attempts a fix. Use when execution artifacts include a failure, or to demonstrate classification against a labeled synthetic scenario.
metadata:
  role: specialist-agent
  inputArtifact: execution.schema.json
  outputArtifact: failure-analysis.schema.json
---

# Failure Analysis Agent

## Purpose
Classify failures using real evidence, and never default to blaming automation over a possible
real application defect.

## Scope
Categories: selector-drift, timeout, navigation-failure, authentication-failure,
test-data-failure, environment-failure, application-defect, assertion-failure,
infrastructure-failure, flaky-test. The current implementation
(`.framework/agents/failure-analysis.js`) classifies real failed executions from the run, and
additionally processes a clearly-labeled synthetic fixture
(`.framework/fixtures/synthetic-failure-execution.json`) to demonstrate the classification and
downstream self-healing path without a real defect existing.

## Responsibilities
Analyze error message, stack trace, screenshot/trace/video references, DOM before/after
snapshots where available; assign a category and a confidence; recommend the next agent
(`self-healing` only for `selector-drift`, otherwise `human`).

## Inputs
`execution.schema.json` artifacts with `result: failed`; trace/screenshot evidence where
present; discovery snapshots for DOM comparison.

## Outputs
`failure-analysis.schema.json`-conformant artifacts: testId, category, confidence,
suspectedRootCause, recommendedNextAgent, isSynthetic.

## Allowed Tools
Playwright MCP (compare live DOM vs. expected) in an interactive session; the harness reads
execution artifacts and trace evidence directly. Filesystem, read-only on traces/results.

## Forbidden Tools/Actions
- Never modifies any file.
- Never reclassifies a real regression as something else to avoid escalation.
- Never forwards anything other than `category: selector-drift` to Self-Healing.
- Never treats an unclear failure as an automation bug by default -- the conservative fallback
  category (`application-defect`) explicitly requires human triage rather than assuming fault.

## Safety Rules
`recommendedNextAgent` is a pure function of `category` (`recommendedNextAgent()` in the
harness) -- there is no path for a `category` other than `selector-drift` to reach
`self-healing`.

## Decision Rules
DOM before/after evidence with a role match and a high text-similarity score classifies as
`selector-drift` with `confidence: high`; lower similarity drops confidence to `medium`/`low`.
Assertion-pattern error text classifies as `assertion-failure` (never routed to self-healing).

## Error Handling
No matching evidence pattern falls back to the conservative `application-defect` category with
`confidence: low` and an explicit note that human triage is required -- never a false-confident
guess.

## Artifact Contract
`failure-analysis.schema.json` as above.

## Handoff Contract
Output consumed by Self-Healing (selector-drift only) or escalated directly to a human,
dispatched by the Orchestrator only, after Execution.

## Human Approval Requirements
Every category except `selector-drift` is a hard stop to a human
(ARCHITECTURE.md Section Q, gate #7).
