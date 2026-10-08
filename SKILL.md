---
name: web-automation-testing
description: Conventions and workflow for Claude Code when writing, running, and maintaining Playwright web automation tests in this repository. Use this whenever adding a test, a page object, or investigating a test failure in this project.
---

# Web Automation Testing Framework

This project is an AI-agentic Playwright test framework driven through Claude Code. It uses the
Page Object Model (POM) and MCP servers (Playwright MCP, GitLab MCP) to let an agent author,
run, and debug browser tests.

## Stack

- Node.js + JavaScript (CommonJS)
- Playwright + `@playwright/test`
- Playwright MCP (`.mcp.json` → `playwright`) for live browser inspection/authoring
- GitLab MCP (`.mcp.json` → `gitlab`) for merge requests, pipelines, and issues
- Page Object Model under `pages/`

## Directory layout

- `pages/` — one class per page/component. `BasePage` holds shared navigation/wait helpers;
  every other page object extends it.
- `fixtures/` — Playwright fixtures that wire page objects into `test`. Tests should obtain
  page objects from a fixture, never construct them inline.
- `tests/` — spec files, one feature/flow per file, importing `test`/`expect` from
  `fixtures/*.fixture.js` (not from `@playwright/test` directly).
- `playwright.config.js` — base URL, projects, and reporter configuration.

## Conventions

- Add a new page object in `pages/` before writing the spec that uses it — tests should not
  contain raw selectors.
- Extend `BasePage` for any new page object; add cross-cutting helpers there, not per-page.
- Add a fixture entry in `fixtures/pages.fixture.js` for every new page object.
- Keep one behavior/assertion focus per test; prefer role-based locators
  (`getByRole`, `getByLabel`) over CSS/XPath selectors.
- Use `npm test` to run the suite, `npm run test:headed` to watch it, `npm run report` to view
  the last HTML report.

## Using the MCP servers

- **Playwright MCP**: use it to explore a live page (accessibility tree, screenshots, network)
  before writing selectors, and to validate a new page object against the real DOM.
- **GitLab MCP**: use it to read merge request context, check pipeline status, or file/update
  issues related to failing tests. It is configured `GITLAB_PERMISSION_MODE=readonly` by
  default — do not switch it to a write mode without explicit user approval, since that allows
  creating/editing GitLab resources.

## When a test fails

1. Reproduce with `npm run test:headed` or inspect the HTML report (`npm run report`) first.
2. Use Playwright MCP to compare the live page against the page object's locators before
   changing test logic.
3. Prefer fixing the page object (selector drift) over adding waits/retries in the spec.

## The agentic layer

This is the human/session-facing conventions doc. The full 12-agent pipeline (Orchestrator,
Requirement Analysis, Product Discovery, Test Design, Test Data, Automation Generation,
Execution, Failure Analysis, Self-Healing, Gap Analysis, Regression, Reporting) is defined in
detail in:

- `ARCHITECTURE.md` — the design source of truth (agent contracts, safety model, phases).
- `.claude/skills/<agent-name>/SKILL.md` — one scoped skill definition per agent.
- `.framework/agents/*.js` — the deterministic Node harness for each agent (artifact I/O,
  schema validation, dry-run reference logic).

The Orchestrator (`.claude/skills/orchestrator/SKILL.md`, `.framework/agents/orchestrator.js`)
is the only thing that sequences agents — no specialist agent invokes another directly; every
handoff goes through the file-based artifact store under `.framework/runs/<run-id>/`. Run the
whole pipeline with `npm run framework:dry-run`, or a single agent with `npm run agent:<name>`.
See `README.md` for the full command list and current dry-run vs. real-application status.
