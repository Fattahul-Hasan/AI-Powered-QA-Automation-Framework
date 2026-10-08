// Product Discovery Agent (ARCHITECTURE.md Section 5).
//
// Read-only by default; never operates against production (enforced by
// .framework/lib/environment-safety.js when a real BASE_URL is configured). In dry-run mode
// this performs a REAL discovery pass -- not a fabricated one -- against the same public demo
// target (https://playwright.dev) already used by the pre-existing, approved smoke test. It
// does not invent selectors: everything recorded here is read live from the real page.
//
// Interactive discovery inside a Claude Code session goes through Playwright MCP instead
// (ARCHITECTURE.md Section E / .framework/lib/playwright-mcp-adapter.js); this harness uses the
// Playwright library directly so it can run deterministically as a plain Node process.

const path = require('path');
const fs = require('fs');
const { chromium } = require('@playwright/test');
const { createLogger } = require('../lib/logger');
const { writeArtifact, runDir } = require('../lib/artifact-store');
const { appendAuditRecord } = require('../lib/audit');
const { assertNonProductionEnvironment } = require('../lib/environment-safety');
const { describeInteractiveMcpUse } = require('../lib/playwright-mcp-adapter');

const logger = createLogger('product-discovery');
const DEMO_URL = 'https://playwright.dev';

async function discoverKeyLocators(page) {
  const candidates = [
    { role: 'link', accessibleName: 'Get started' },
    { role: 'searchbox', accessibleName: /search/i },
    { role: 'button', accessibleName: /search/i },
  ];
  const found = [];
  for (const candidate of candidates) {
    const locator = page.getByRole(candidate.role, { name: candidate.accessibleName });
    const count = await locator.count().catch(() => 0);
    if (count > 0) {
      const accessibleName = await locator.first().getAttribute('aria-label').catch(() => null);
      found.push({
        role: candidate.role,
        name: candidate.role,
        accessibleName: accessibleName || String(candidate.accessibleName),
      });
    }
  }
  return found;
}

async function run({ runId, url = DEMO_URL } = {}) {
  assertNonProductionEnvironment({ baseURL: url === DEMO_URL ? undefined : url });
  logger.info('Starting product discovery', { runId, url });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  let artifact;
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    const title = await page.title();
    const keyLocators = await discoverKeyLocators(page);

    const screenshotDir = path.join(runDir(runId), 'discovery', 'screenshots');
    fs.mkdirSync(screenshotDir, { recursive: true });
    const screenshotPath = path.join(screenshotDir, 'homepage.png');
    await page.screenshot({ path: screenshotPath });

    const mcpNote = describeInteractiveMcpUse('homepage accessibility discovery');

    const { artifact: written } = writeArtifact(runId, 'discovery', 'DISC-DEMO-HOMEPAGE', {
      url,
      role: 'homepage',
      title,
      accessibilityTree: keyLocators,
      keyLocators,
      screenshotRef: screenshotPath,
      lastSeen: new Date().toISOString(),
      diffFromPrevious: null,
      environment: url === DEMO_URL ? 'public-demo' : 'non-production-test',
    }, { evidence: [screenshotPath, mcpNote.note] });
    artifact = written;

    appendAuditRecord(runId, {
      agent: 'product-discovery',
      action: 'discovery-completed',
      url,
      keyLocatorsFound: keyLocators.length,
    });
    logger.info('Product discovery complete', { runId, keyLocatorsFound: keyLocators.length });
  } finally {
    await browser.close();
  }
  return artifact;
}

module.exports = { run, discoverKeyLocators, DEMO_URL };
