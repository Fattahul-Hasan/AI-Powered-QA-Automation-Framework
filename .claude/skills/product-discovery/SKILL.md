---
name: product-discovery
description: Builds a live map of the application's pages, components, and flows using Playwright, so downstream agents design against reality instead of assumption. Use when a target page/flow needs to be explored or re-verified before test design or automation generation.
metadata:
  role: specialist-agent
  inputArtifact: target-url
  outputArtifact: discovery.schema.json
---

# Product Discovery Agent

## Purpose
Discover real application structure (pages, forms, navigation, roles/permissions) so downstream
agents never invent selectors or workflows.

## Scope
Application URL, login page, navigation, modules, pages, forms, input fields, buttons, tables,
grids, dropdowns, validation messages, business workflows, roles and permissions. The current
implementation (`.framework/agents/product-discovery.js`) performs a real, live discovery pass
against the pre-approved public demo target (`https://playwright.dev`) in dry-run mode. Against
a real, non-production application, the same approach applies once that target is approved
(ARCHITECTURE.md Section 9, Decision 5) -- this agent is otherwise inert.

## Responsibilities
Navigate the target, capture accessibility-tree information and key locators, take evidence
screenshots, detect changes from a prior discovery pass.

## Inputs
A target URL (never invented; never production -- see Safety Rules) and, if present, a prior
discovery snapshot to diff against.

## Outputs
`discovery.schema.json`-conformant artifacts per page/flow, each including `keyLocators[]`,
`screenshotRef`, and `environment` (`public-demo` | `non-production-test`).

## Allowed Tools
Playwright MCP for live, interactive exploration inside a Claude Code session
(ARCHITECTURE.md Section E). The Node harness instead drives Playwright directly
(`.framework/lib/playwright-mcp-adapter.js` documents this boundary) so it can run
deterministically outside an interactive session. Filesystem for evidence (screenshots).

## Forbidden Tools/Actions
- Read-only against the application: no destructive actions, no form submissions beyond what's
  needed to reach a page.
- Never operates against production (`.framework/lib/environment-safety.js` blocks this
  whenever a real, non-placeholder `BASE_URL` is configured without explicit non-production
  confirmation).
- Never infers business logic not observable in the UI.

## Safety Rules
Environment-safety check runs before any real-target discovery. The public demo fallback is
always safe and never blocked.

## Decision Rules
If the discovered structure differs from a prior snapshot, record `diffFromPrevious` rather
than silently overwriting history.

## Error Handling
If the target is unreachable, the artifact's `status` is `failed` with the error recorded --
never a fabricated "empty but successful" discovery.

## Artifact Contract
`discovery.schema.json`: id (`DISC-*`), url, keyLocators, screenshotRef, lastSeen, environment.

## Handoff Contract
Output consumed by Test Design, Automation Generation, and Self-Healing via the manifest,
dispatched by the Orchestrator only. Runs concurrently with Requirement Analysis
(ARCHITECTURE.md Section 2, confirmed 2026-08-24).

## Human Approval Requirements
First discovery run against any new target URL (ARCHITECTURE.md Section Q, gate #2).
