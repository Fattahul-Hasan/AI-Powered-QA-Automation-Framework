# Framework Readiness Report

Date: 2026-08-25
Scope: Full framework-level audit of the AI Agentic QA Automation Framework as built through
the "full framework implementation" and subsequent "continue development" work. No real
application was accessed or required to perform this audit — every finding below was
discovered and verified through direct inspection, standalone CLI execution, and the
framework's own test suite.

This is not a re-statement of prior claims — every item below was actively re-verified: agents
were run standalone via the CLI (individually and chained), edge cases (empty runs, missing
data) were deliberately probed, every schema was checked against what the code actually
produces, and every documentation file was checked against the current file tree and current
code behavior.

---

## Summary

**5 genuine bugs found and fixed.** **6 documentation inconsistencies found and fixed.** **1
missing test suite added** (which is what surfaced the most serious bug). **82/82 tests pass**
after fixes, including the preserved smoke test. No blocking issues remain.

---

## Findings by Severity

### Genuine bugs (found via live execution, not review) — all fixed

| # | Bug | Impact before fix | Fix |
|---|---|---|---|
| 1 | `artifact-store.js` defaulted every artifact's `producedBy` to its phase directory name, but several schemas require a *different* constant (e.g. phase `requirements` requires `producedBy: "requirement-analysis"`) | **The dry-run pipeline crashed on its very first artifact write**, every time, before this was caught | Added an explicit `PHASE_PRODUCER` map |
| 2 | `execution.js` spawned Playwright's CLI via `npx.cmd` on Windows, which fails with `EINVAL` under `execFileSync` | Execution Agent crashed on every real test run | Invoke Playwright's CLI script directly via `node` + a resolved path, bypassing the shell entirely |
| 3 | Self-Healing Agent built and persisted a full diff even at **low** confidence, contradicting its own documented rule ("low confidence → no diff generated at all") | A low-confidence finding could look like a proposed fix when it should show nothing at all | Low confidence now short-circuits before any diff is constructed |
| 4 | `regression.schema.json` required `smokeBaselineIds` to have at least 1 item | **Crashes the Regression Agent (and therefore the whole pipeline)** on any run with zero P1-priority test cases — a normal state early in a project, not an error | Relaxed the schema constraint; added an honest runtime warning instead of a hard failure |
| 5 | `requirement.schema.json`'s `module`/`feature` fields didn't allow `null` | Broke on the intentionally-ambiguous demo requirement, which has no module/feature yet | Allowed `null` |

Bug #4 was caught specifically because this audit added `tests/framework/regression-agent.spec.js` — a dedicated test suite that didn't exist before and deliberately exercised the empty-baseline edge case the full dry-run pipeline test never hit (its one demo test case happens to be P1).

### Documentation inconsistencies — all fixed

| # | Inconsistency | Fix |
|---|---|---|
| 6 | `ARCHITECTURE.md` Section 5 specified `.skills/`; actual implementation (and the real Claude Code convention) is `.claude/skills/` | Corrected in `ARCHITECTURE.md` and `PROJECT_STRUCTURE.md`, with a note that this is a path correction only, not a control-flow change |
| 7 | `ARCHITECTURE.md` Section 6 said `CLAUDE.md` was "Not created yet" | `CLAUDE.md` was created in Phase 1; section updated |
| 8 | `ARCHITECTURE.md`'s top status line said "Implementation has not started"; its closing line said "No code... has been created" | Both false after the full framework build; corrected to reflect actual implementation status |
| 9 | `PROJECT_STRUCTURE.md` had drifted from the real tree (wrong schema filenames, missing `.framework/lib`/`agents`/`fixtures`/`cli.js`, missing `README.md`, stale fixture/test-file lists) | Fully resynced to the real file tree |
| 10 | `.env.example` didn't document `TEST_ENVIRONMENT`, `PRODUCTION_HOSTS`, or `GAP_ANALYSIS_STALENESS_DAYS` — real env vars the code actually reads | Added, with explanatory comments |
| 11 | `README.md` didn't explain that the scoped test scripts (`test:functional` etc.) exit 1 with "No tests found" until a real app exists — could read as broken | Added an explicit note that this is expected |

### Missing framework tests — added

- `tests/framework/regression-agent.spec.js` (5 tests) — Regression Agent had **zero** dedicated unit tests before this audit; only indirect coverage via the full pipeline test, which never exercised the empty-baseline path. This is the suite that caught bug #4.

---

## Audit by Area

**1. Architecture** — Internally consistent after fixes. All Section 9 decisions correctly reflected in code. Canonical pipeline flow (concurrent kickoff, join, branch, re-run, dual regression trigger) matches the actual orchestrator implementation, verified by re-reading both side by side.

**2. Project structure** — Now fully synced to the real tree (see fix #9). Verified via `find`/`ls` against the document.

**3. `.claude/skills`** — All 12 files present, verified valid frontmatter (scripted check), content cross-checked against actual harness behavior post-fixes (Self-Healing and Gap Analysis SKILL.md updated to match code changes made during this audit and the prior session).

**4. Agents** — All 12 run standalone via CLI, individually and chained, verified live (not just re-read). Every agent tested against a completely empty run — all degrade gracefully except Regression, which was broken (bug #4, now fixed). Unknown CLI agent name errors cleanly with exit code 1.

**5. Schemas** — All 12 compile via ajv. Two required corrections (bugs #4, #5) found by actually exercising edge cases the original test suite didn't reach.

**6. Configuration** — `playwright.config.js`, `package.json`, `.mcp.json`, `.gitignore` all internally consistent. CI image Playwright version (`v1.62.1`) confirmed to match the installed package version. `.env.example` gap fixed (#10).

**7. Error handling** — Verified: every agent's errors are self-descriptive (agent name + what failed), propagate cleanly to a non-zero CLI exit code, and are never silently swallowed. Considered adding an orchestrator-level "which phase failed" wrapper; decided against it as unnecessary — per-agent error messages already self-identify, and adding a wrapper now would be a speculative addition with no concrete gap to justify it.

**8. Logging** — `redact()` verified functionally (not just read) to correctly mask secret-shaped keys. Known, documented limitation: redaction is shallow (top-level keys only). Audited every `logger.*` call site in the codebase — none currently logs a nested object that could carry a credential, so this is not an active risk, just a hardening note for the future.

**9. Reporting** — Verified totals/coverage percentages compute correctly on both populated and empty runs (no divide-by-zero). Traceability Markdown verified against real pipeline output.

**10. Test data management** — `utils/data-factory.js` uniqueness/seeding/cleanup all verified by test. Confirmed repeated runs never fail due to prior data (explicit test).

**11. Playwright integration readiness** — Config, trace/screenshot/video, browser projects, and the `framework` project's browser-less isolation all verified working. `globalSetup` environment-safety hook confirmed to be a true no-op for the preserved smoke test.

**12. API testing readiness** — `utils/api-client.js` and `utils/auth-api-adapter.js` exist and are tested (error paths verified), but are not yet exercised by any live agent path — honestly so, since no real API exists to call. This is a foundation, not a gap.

**13. Requirement analysis readiness** — Markdown parsing is real and tested (ambiguity detection, missing-info flagging, high-risk classification all verified). Other documented source types (PDF/DOC/XLS/CSV/HTML) are **not implemented** — `SKILL.md` already says so honestly. This is a scope limitation, not a defect.

**14. Regression readiness** — Both trigger paths (standard-tail, independent-MR) verified working, including the previously-broken empty-baseline case (bug #4, now fixed and tested).

**15. Gap analysis** — All gap types verified against real artifacts in a live run, including the deliberately-uncovered demo requirement.

**16. Flaky-test detection** — Real multi-run history detection, verified by 6 dedicated tests (added in the prior development session, re-verified here).

**17. Self-healing confidence tiers** — All three tiers (high/medium/low) verified to produce the architecturally-correct decision, including the bug fix (#3) ensuring low confidence truly produces no diff.

**18. CLI commands** — Every `npm run agent:*` command and `framework:dry-run` verified by live execution during this audit, not just documentation review.

**19. Documentation** — 6 inconsistencies found and fixed (see above). All cross-references between `ARCHITECTURE.md`, `PROJECT_STRUCTURE.md`, `CLAUDE.md`, `SKILL.md`, and `README.md` re-checked.

**20. Unit/framework test coverage** — 82 tests across 15 spec files (up from 77/13 before this audit), all passing. One genuine coverage gap found and closed (Regression Agent).

---

## Known Limitations (not blocking, explicitly out of framework scope)

- Requirement Analysis: Markdown only; other formats need real extraction tooling not yet built.
- API-based test data/auth: generic adapters exist, unexercised by any live path (no real API).
- Logger redaction: shallow, not recursive — no current risk, noted for future hardening.
- No ESLint/static analysis configured — optional per original scope, not added.
- `.auth/` real storage-state files, a real `tests/auth.setup.js`, and `pages/modules/*` real
  page objects: correctly do not exist; require a real, approved application.

---

*See `FINAL_FRAMEWORK_STATUS.md` for the readiness verdict.*
