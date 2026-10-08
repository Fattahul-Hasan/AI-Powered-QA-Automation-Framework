// ARCHITECTURE.md Section B (API-based authentication) and Section C (API-based test-data
// setup/teardown, "preferred for speed over UI setup"). Generic Playwright API
// request-context factory only — no application-specific endpoints live here.

const { request } = require('@playwright/test');

// Creates a Playwright APIRequestContext scoped to a base URL, optionally with a bearer token
// (e.g. obtained via a future API-based login). Callers own which endpoints they call — this
// factory does not know or assume any real application's API shape.
async function createApiContext({ baseURL = process.env.BASE_URL, token } = {}) {
  return request.newContext({
    baseURL,
    extraHTTPHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

module.exports = { createApiContext };
