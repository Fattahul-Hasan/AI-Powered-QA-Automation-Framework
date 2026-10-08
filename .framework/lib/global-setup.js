// Playwright globalSetup: enforces environment-safety before any test runs. See
// .framework/lib/environment-safety.js -- this is a no-op whenever BASE_URL is unset or still
// the placeholder demo, so it never affects the existing, preserved smoke test.

const { assertNonProductionEnvironment } = require('./environment-safety');

module.exports = async function globalSetup() {
  assertNonProductionEnvironment();
};
