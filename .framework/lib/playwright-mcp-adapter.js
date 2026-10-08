// Playwright MCP integration boundary (ARCHITECTURE.md Section E / Section 20).
//
// Playwright MCP is for LIVE, INTERACTIVE work inside a Claude Code session: an agent
// (Claude, acting per a SKILL.md) drives the `playwright` MCP server's tools directly to
// explore a page, validate a locator, or gather failure evidence. That only happens when
// Claude Code itself is the caller -- there is no way for a plain `node` script to open an
// MCP session, and this project's design (ARCHITECTURE.md Section E) explicitly says MCP must
// never replace deterministic Playwright Test execution anyway.
//
// So the Product Discovery Agent's *harness* (.framework/agents/product-discovery.js) does its
// own deterministic discovery pass using the Playwright library directly (@playwright/test's
// browser automation), not MCP -- this is real, automated, and produces genuinely real
// discovery data against the same public demo target already used by the existing smoke test.
// This module exists to make that boundary explicit and to give the harness a single place to
// note when a step is one Playwright MCP would also be well-suited to.

function describeInteractiveMcpUse(step) {
  return {
    performedVia: 'playwright-library-direct',
    note:
      `"${step}" was performed by the Node harness driving Playwright directly (real browser, ` +
      'no MCP session available outside an interactive Claude Code invocation). When a human or ' +
      'Claude Code agent performs this step interactively, the equivalent, richer exploration ' +
      'goes through the Playwright MCP server configured in .mcp.json (ARCHITECTURE.md Section E).',
  };
}

module.exports = { describeInteractiveMcpUse };
