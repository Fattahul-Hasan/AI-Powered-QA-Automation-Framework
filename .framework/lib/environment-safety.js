// Environment safety (CLAUDE.md / ARCHITECTURE.md-consistent addition, finalized during full
// framework implementation on 2026-08-25): PRODUCTION = BLOCKED by default.
//
// Design constraint: the existing, preserved smoke test runs against the public demo fallback
// (https://playwright.dev) with zero required environment variables, and that behavior must
// keep working unmodified. So this guard only activates once a real BASE_URL is configured --
// it never blocks the placeholder-demo path.

class ProductionExecutionBlockedError extends Error {}

function isRealTargetConfigured(baseURL) {
  return Boolean(baseURL) && baseURL !== 'https://playwright.dev';
}

function assertNonProductionEnvironment({
  baseURL = process.env.BASE_URL,
  testEnvironment = process.env.TEST_ENVIRONMENT,
  productionHostsDenylist = process.env.PRODUCTION_HOSTS,
} = {}) {
  if (!isRealTargetConfigured(baseURL)) {
    // Placeholder-demo mode: nothing to block, no real application is targeted.
    return { blocked: false, reason: 'placeholder-demo-mode' };
  }

  let hostname = null;
  try {
    hostname = new URL(baseURL).hostname;
  } catch {
    throw new ProductionExecutionBlockedError(`BASE_URL "${baseURL}" is not a valid URL.`);
  }

  if (productionHostsDenylist) {
    const denied = productionHostsDenylist.split(',').map((h) => h.trim());
    if (denied.includes(hostname)) {
      throw new ProductionExecutionBlockedError(
        `Execution against "${hostname}" is hard-blocked via PRODUCTION_HOSTS, regardless of TEST_ENVIRONMENT.`,
      );
    }
  }

  if (testEnvironment !== 'non-production') {
    throw new ProductionExecutionBlockedError(
      `Production execution is blocked by default. A real BASE_URL ("${baseURL}") is configured, ` +
        'but TEST_ENVIRONMENT is not explicitly set to "non-production". Set TEST_ENVIRONMENT=non-production ' +
        'in .env only once you have confirmed this target is a non-production test environment ' +
        '(ARCHITECTURE.md Section 9, Decision 5).',
    );
  }

  return { blocked: false, reason: 'explicitly-confirmed-non-production', hostname };
}

module.exports = { assertNonProductionEnvironment, isRealTargetConfigured, ProductionExecutionBlockedError };
