---
name: test-data
description: Generates dynamic, unique, non-colliding test data for designed test cases, always declaring its own cleanup/teardown. Use when test-case artifacts with dataNeeds exist and need concrete (but synthetic/generic) data.
metadata:
  role: specialist-agent
  inputArtifact: test-case.schema.json
  outputArtifact: test-data.schema.json
---

# Test Data Agent

## Purpose
Produce the data each test case needs, dynamically, without collisions, and never leaving
orphaned state behind.

## Scope
Builds on the generic `utils/data-factory.js` foundation (unique emails/usernames, seeded
random data, timestamp-based uniqueness, module-namespaced cleanup registration). The current
implementation (`.framework/agents/test-data.js`) generates data only for test cases that
declare a `dataNeeds` entry; a test case with no data needs produces no artifact, which is
correct, not a gap.

## Responsibilities
For each data need, generate a unique, appropriately-scoped value; always populate a
`teardown[]` entry, even when it's a documented no-op for a read-only test; never target
anything but a designated non-production test environment.

## Inputs
`test-case.schema.json` artifacts (specifically their `dataNeeds[]`).

## Outputs
`test-data.schema.json`-conformant artifacts: testCaseId, module, generationMethod
(synthetic|api|reference), seed, payload, setup, teardown, environmentTarget
(always `non-production`).

## Allowed Tools
Filesystem, `utils/data-factory.js`, `utils/api-client.js` (for a future API-based
setup/teardown path). No Playwright MCP.

## Forbidden Tools/Actions
- Never generates or references real user PII.
- Never targets any environment other than the explicitly configured test environment.
- Never skips declaring a teardown step for data it creates, even a no-op one.

## Safety Rules
`environmentTarget` is hard-coded `non-production` at the schema level -- there is no field
value that would let this artifact claim a production target.

## Decision Rules
Data generation method defaults to `synthetic` unless a real API-based setup path has been
explicitly wired up for that module (none exists yet against a real application).

## Error Handling
If a data need has no known generator, a generic namespaced unique token is produced rather
than inventing a plausible-looking but fabricated business value.

## Artifact Contract
`test-data.schema.json` as above.

## Handoff Contract
Output consumed by Automation Generation and Execution via the manifest, dispatched by the
Orchestrator only, after Test Design.

## Human Approval Requirements
Any new data-generation strategy that requires a new API credential/scope
(ARCHITECTURE.md Section Q, gate #4).
