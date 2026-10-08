# AI Agentic Web Automation Testing Framework

An enterprise-oriented, Playwright-based web automation testing framework built around the Page
Object Model and a 12-agent AI-agentic layer (Orchestrator + 11 specialist agents), driven
through Claude Code. Full design: [`ARCHITECTURE.md`](./ARCHITECTURE.md). Hard rules:
[`CLAUDE.md`](./CLAUDE.md). Day-to-day conventions: [`SKILL.md`](./SKILL.md).

## Status

- **POM foundation**: working (`pages/`, `fixtures/`, `tests/`), preserved smoke test passing.
- **12 specialist agents**: implemented as real code (`.framework/agents/*.js`) and Claude Code
  skills (`.claude/skills/*/SKILL.md`), running in **DRY-RUN / SYNTHETIC mode** end-to-end.
- **Real application execution**: not configured. See "Real Application Onboarding" below.
- **GitLab MCP**: read-only. Write operations are disabled at the code level until
  `ARCHITECTURE.md` Phase 9 is explicitly approved.

## Technology Stack

JavaScript (Node.js, CommonJS — no TypeScript) · Playwright + `@playwright/test` · Playwright
CLI · Playwright MCP · GitLab MCP (read-only) · Page Object Model · Claude Code · `SKILL.md`
agent definitions · `ajv` for JSON Schema artifact validation.

## Quick Start

```bash
npm install
npx playwright install   # if browsers aren't already cached
npm test                 # runs the preserved smoke test + all framework validation tests
```

## Directory Guide

```
pages/                    Page Object Model (BasePage + page objects)
  authentication/         Generic login-page foundation (no real app selectors)
  components/             Generic reusable UI-fragment base
  modules/                Real application page objects go here once approved (empty for now)
fixtures/                 Playwright fixtures wiring page objects into tests
tests/                    Spec files
  functional/ positive/ negative/ regression/   Populated once a real app is approved
  framework/              Real tests validating the framework itself (schemas, agents, safety)
utils/                    Generic helpers: dynamic data, browser/API auth adapters
.claude/skills/<agent>/   One SKILL.md per specialist agent
.framework/
  schemas/                JSON Schemas for every artifact type (tracked in git)
  lib/                    Shared runtime: artifact store, manifest, logger, safety guards
  agents/                 Deterministic Node harness per agent
  fixtures/               Synthetic, clearly-labeled dry-run input data
  runs/                   Generated per pipeline run (git-ignored)
reports/<run-id>/         Generated report output (git-ignored)
```

## Running Tests

| Command | What it does |
|---|---|
| `npm test` / `npm run test:all` | Full suite: chromium/firefox/webkit + framework tests |
| `npm run test:headed` | Headed run (chromium only) |
| `npm run test:functional` / `test:positive` / `test:negative` / `test:regression` | Scoped suites — **currently exit with "No tests found" (exit code 1) until a real app is onboarded and populates these directories; that's expected, not a bug** |
| `npm run test:module -- "<grep pattern>"` | Run tests matching a name pattern |
| `npm run test:framework` | Just the framework's own validation tests |
| `npm run report` | Open the last HTML report |

## Running the Agentic Pipeline

```bash
npm run framework:dry-run   # full 12-agent pipeline, synthetic/demo data, no real app needed
```

This runs Requirement Analysis and Product Discovery concurrently, joins into Test Design, then
Test Data → Automation Generation → Execution → (branch on pass/fail) → Failure Analysis →
Self-Healing → Gap Analysis → Regression (both trigger paths) → Reporting. Output lands in
`reports/<run-id>/summary.json` and `reports/<run-id>/traceability.md`.

Individual agents can also be run standalone against the latest run:

```bash
npm run agent:requirement   # Requirement Analysis
npm run agent:discover      # Product Discovery
npm run agent:design        # Test Design
npm run agent:data          # Test Data
npm run agent:generate      # Automation Generation
npm run agent:execute       # Execution
npm run agent:analyze       # Failure Analysis
npm run agent:heal          # Self-Healing
npm run agent:gap           # Gap Analysis
npm run agent:regression    # Regression
npm run agent:report        # Reporting
```

## DRY-RUN vs. REAL APPLICATION Mode

**DRY-RUN / SYNTHETIC mode** (current, default) processes clearly-labeled synthetic input
(`.framework/fixtures/requirements.md`, a synthetic failure scenario, a synthetic GitLab MR
diff) and the pre-approved public demo target (`https://playwright.dev`, the same site the
original smoke test already targets). Nothing here ever pretends a real application exists.

**REAL APPLICATION mode** is not configured. It requires:

1. A real, **non-production** test-environment base URL.
2. `TEST_ENVIRONMENT=non-production` set explicitly — production execution is blocked by
   default (`.framework/lib/environment-safety.js`), even once a real `BASE_URL` is set.
3. Role credentials as environment variables (see `.env.example`).

The framework will not invent selectors, workflows, or business rules for a real application —
Product Discovery must run against it first, and Automation Generation only links to automation
that's been reviewed.

## Environment Setup

```bash
cp .env.example .env
# fill in BASE_URL, role credentials, and GitLab MCP vars as needed -- .env is git-ignored
```

Never commit `.env`, `.auth/` (Playwright storage state), or any credential.

## Real Application Onboarding (when you're ready)

1. Confirm a dedicated non-production test environment exists (`ARCHITECTURE.md` Section 9,
   Decision 5).
2. Provide the base URL, the roles that need separate authenticated sessions, and the env var
   names for their credentials (not the values, in chat).
3. Set `TEST_ENVIRONMENT=non-production` in `.env`.
4. Run Product Discovery against the real target (`npm run agent:discover -- --url=<real-url>`)
   — this is a human-approval gate (`ARCHITECTURE.md` Section Q, gate #2).
5. From there, Requirement Analysis → Test Design → Automation Generation proceed against real
   requirements instead of the synthetic fixture.

## GitLab MCP

Configured read-only in `.mcp.json`. Write operations (`createMergeRequest`, `mergeMergeRequest`,
`pushToBranch`, `createIssue`, `postComment`) are disabled in code
(`.framework/lib/gitlab-adapter.js`) regardless of any environment variable, until
`ARCHITECTURE.md` Phase 9 is explicitly approved.

## Further Reading

- [`ARCHITECTURE.md`](./ARCHITECTURE.md) — full system design, all 12 agent contracts, safety
  model, phased rollout.
- [`PROJECT_STRUCTURE.md`](./PROJECT_STRUCTURE.md) — annotated folder-tree proposal.
- [`CLAUDE.md`](./CLAUDE.md) — enforced project rules.
- [`SKILL.md`](./SKILL.md) — day-to-day POM/MCP conventions and pointer to the agentic layer.
