// ARCHITECTURE.md Section B: Authentication / Token Reuse Architecture.
//
// Generic authentication foundation. This module intentionally has no knowledge of any real
// target application's login page, selectors, or API — those are supplied by the caller once
// the application under test is known and approved (see ARCHITECTURE.md "Phase 1 Status").
// Do NOT hardcode a real application's login flow here.

const path = require('path');

const AUTH_STATE_DIR = path.join(__dirname, '..', '.auth');

function storageStatePath(role) {
  return path.join(AUTH_STATE_DIR, `${role}.json`);
}

// Reads a role's credentials from environment variables named `<ROLE>_USERNAME` /
// `<ROLE>_PASSWORD` (see .env.example). Fails loudly if unset rather than silently testing
// with an empty/placeholder credential.
function getRoleCredentials(role) {
  const key = role.toUpperCase();
  const username = process.env[`${key}_USERNAME`];
  const password = process.env[`${key}_PASSWORD`];
  if (!username || !password) {
    throw new Error(
      `Missing credentials for role "${role}". Set ${key}_USERNAME and ${key}_PASSWORD in .env.`,
    );
  }
  return { username, password };
}

// Generic form-based login: performs a login using caller-supplied selectors. `loginPath` and
// `selectors` are wired up by whoever sets this up against the real application (a future
// tests/auth.setup.js) — this function has no knowledge of any specific app's login page.
async function loginWithCredentials(page, { loginPath, selectors, username, password }) {
  const { usernameInput, passwordInput, submitButton } = selectors;
  await page.goto(loginPath);
  await page.locator(usernameInput).fill(username);
  await page.locator(passwordInput).fill(password);
  await page.locator(submitButton).click();
}

// Saves the browser context's session (cookies/local storage) for reuse by other
// tests/projects via Playwright's `storageState`, avoiding repeated logins (Section B).
async function saveAuthState(context, role) {
  await context.storageState({ path: storageStatePath(role) });
}

module.exports = {
  AUTH_STATE_DIR,
  storageStatePath,
  getRoleCredentials,
  loginWithCredentials,
  saveAuthState,
};
