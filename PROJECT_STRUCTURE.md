# Project Structure

Status: **UPDATED 2026-08-25 to reflect what has actually been built** (full framework
implementation, dry-run/synthetic mode). Originally an approved pre-implementation proposal;
now a record of the real tree, with remaining forward-looking items still marked `(pending real
application)`.

```
AI-QA-Automation-Framework/
│
├── .git/                                 (project-scoped, no commits yet)
├── .gitignore
├── .gitlab-ci.yml                        (install → framework-validate → smoke → dry-run → publish)
├── .mcp.json                             (Playwright MCP connected, GitLab MCP read-only)
├── .env.example                          (placeholders only — BASE_URL, role creds, GitLab MCP vars)
├── .claude/
│   ├── settings.local.json               (MCP enablement record)
│   └── skills/                           (one SKILL.md per specialist agent)
│       ├── orchestrator/SKILL.md
│       ├── requirement-analysis/SKILL.md
│       ├── product-discovery/SKILL.md
│       ├── test-design/SKILL.md
│       ├── test-data/SKILL.md
│       ├── automation-generation/SKILL.md
│       ├── execution/SKILL.md
│       ├── failure-analysis/SKILL.md
│       ├── self-healing/SKILL.md
│       ├── gap-analysis/SKILL.md
│       ├── regression/SKILL.md
│       └── reporting/SKILL.md
│
├── package.json / package-lock.json
├── playwright.config.js                  (globalSetup env-safety, framework project, 3 browser projects)
│
├── README.md                             (quick start, commands, dry-run vs. real-app mode)
├── SKILL.md                              (human/session-facing conventions + agentic-layer pointer)
├── ARCHITECTURE.md                       (design source of truth)
├── PROJECT_STRUCTURE.md                  (this file)
├── CLAUDE.md                             (enforced project rules)
│
├── .framework/
│   ├── schemas/                          (12 JSON Schemas, ajv-validated, tracked in git)
│   │   ├── manifest.schema.json
│   │   ├── requirement.schema.json
│   │   ├── discovery.schema.json
│   │   ├── test-case.schema.json
│   │   ├── test-data.schema.json
│   │   ├── automation.schema.json
│   │   ├── execution.schema.json
│   │   ├── failure-analysis.schema.json
│   │   ├── self-healing.schema.json
│   │   ├── gap-analysis.schema.json
│   │   ├── regression.schema.json
│   │   └── report.schema.json
│   ├── lib/                              (shared runtime, tracked in git)
│   │   ├── artifact-store.js
│   │   ├── manifest.js                   (single-writer: orchestrator only, enforced)
│   │   ├── schema-validator.js
│   │   ├── logger.js
│   │   ├── ids.js
│   │   ├── audit.js
│   │   ├── environment-safety.js         (production-execution block)
│   │   ├── gitlab-adapter.js             (read functions honest; write functions hard-disabled)
│   │   ├── playwright-mcp-adapter.js
│   │   └── global-setup.js
│   ├── agents/                           (deterministic harness per agent, tracked in git)
│   │   ├── requirement-analysis.js
│   │   ├── product-discovery.js
│   │   ├── test-design.js
│   │   ├── test-data.js
│   │   ├── automation-generation.js
│   │   ├── execution.js
│   │   ├── failure-analysis.js
│   │   ├── self-healing.js
│   │   ├── gap-analysis.js
│   │   ├── regression.js
│   │   ├── reporting.js
│   │   └── orchestrator.js
│   ├── fixtures/                         (synthetic, clearly-labeled dry-run input, tracked in git)
│   │   ├── requirements.md
│   │   ├── synthetic-failure-execution-high.json
│   │   ├── synthetic-failure-execution-medium.json
│   │   ├── synthetic-failure-execution-low.json
│   │   └── synthetic-mr-diff.json
│   ├── cli.js                            (npm-script entry point: agent:* and framework:dry-run)
│   └── runs/                             (git-ignored — generated per pipeline run)
│       └── <run-id>/
│           ├── manifest.json
│           ├── audit.jsonl
│           └── <phase>/<artifact-id>.json
│
├── .auth/                                (git-ignored; populated once real per-role login exists — pending real application)
│
├── pages/
│   ├── BasePage.js                       (preserved, unmodified in spirit — generic only)
│   ├── HomePage.js                       (preserved — demo target, still the only real page object)
│   ├── authentication/BaseLoginPage.js   (generic, caller-supplied selectors only)
│   ├── components/BaseComponent.js       (generic reusable-fragment base)
│   └── modules/                          (real app page objects — pending real application)
│
├── fixtures/
│   └── pages.fixture.js                  (preserved, extended as new page objects are added)
│
├── tests/
│   ├── home.spec.js                      (preserved smoke test — still passing)
│   ├── functional/ positive/ negative/ regression/   (documented, empty — pending real application)
│   └── framework/                        (15 real spec files validating the framework itself)
│       ├── schema-validation.spec.js
│       ├── artifact-store.spec.js
│       ├── test-case-validation.spec.js
│       ├── test-data-generation.spec.js
│       ├── authentication-utilities.spec.js
│       ├── traceability.spec.js
│       ├── self-healing-safety.spec.js
│       ├── environment-safety.spec.js
│       ├── gitlab-write-disabled.spec.js
│       ├── report-generation.spec.js
│       ├── duplicate-detection.spec.js
│       ├── staleness-detection.spec.js
│       ├── flaky-test-detection.spec.js
│       ├── regression-agent.spec.js
│       └── dry-run-pipeline.spec.js
│
├── utils/
│   ├── data-factory.js                   (dynamic test data: unique/seeded/timestamp-based)
│   ├── auth.js                           (generic browser/storageState adapter)
│   ├── auth-api-adapter.js               (generic API token-acquisition adapter)
│   └── api-client.js                     (generic Playwright APIRequestContext factory)
│
├── reports/                              (git-ignored — generated per pipeline run)
│   └── <run-id>/
│       ├── summary.json
│       └── traceability.md
│
├── playwright-report/                    (generated, git-ignored)
└── test-results/                         (generated, git-ignored)
```

## Notes on placement decisions

- **`.claude/skills/` (not `.skills/`)** — the original proposal in `ARCHITECTURE.md` Section 5
  said `.skills/`; corrected during implementation to `.claude/skills/`, the actual Claude Code
  skill-discovery convention. `ARCHITECTURE.md` has been updated to match (2026-08-25).
- **`.framework/runs/` and `reports/` are entirely git-ignored** — regenerable per-run working
  data, not source. The schemas, lib, agents, and fixtures under `.framework/` are tracked.
- **`.auth/` exists only as a gitignore pattern so far** — no login flow exists to populate it
  yet (would require inventing a real application's login page).
- **No `agents/` Node package/runtime separate from this repo** — the 12 agents are Claude Code
  Skills (`.claude/skills/*/SKILL.md`) plus a deterministic Node harness
  (`.framework/agents/*.js`) that operates on this same repo's existing tools.
- **`pages/authentication/`, `pages/components/`, `pages/modules/`** are additive — `BasePage.js`
  and `HomePage.js` were not moved.
- **`tests/functional/positive/negative/regression/`** each hold only a `README.md` — genuinely
  empty until a real application exists to automate against.

## Still Pending (require a real, non-production application)

- `.auth/*.json` real storage-state files and a real `tests/auth.setup.js`
- `pages/modules/*` real page objects
- `tests/functional|positive|negative|regression/*.spec.js` real specs
- GitLab MCP live read connectivity (env vars not yet set)

---

*This document now describes the framework as actually implemented, not only proposed. See the
Phase implementation report in the conversation for full validation results.*
