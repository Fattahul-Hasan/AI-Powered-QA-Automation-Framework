// ARCHITECTURE.md Section B: generic API-based authentication adapter, distinct from the
// browser-based adapter in utils/auth.js. No real application endpoint is referenced here --
// the caller supplies the token endpoint and payload shape once a real application exists.

const { createApiContext } = require('./api-client');

// Generic token-acquisition adapter: POSTs caller-supplied credentials to a caller-supplied
// endpoint and returns whatever token field the caller names. Does not assume any specific
// authentication API shape.
async function acquireApiToken({ baseURL, tokenEndpoint, credentials, tokenField = 'token' }) {
  const context = await createApiContext({ baseURL });
  try {
    const response = await context.post(tokenEndpoint, { data: credentials });
    if (!response.ok()) {
      throw new Error(`Token acquisition failed: ${response.status()} ${await response.text()}`);
    }
    const body = await response.json();
    if (!body[tokenField]) {
      throw new Error(`Token acquisition response did not contain expected field "${tokenField}"`);
    }
    return body[tokenField];
  } finally {
    await context.dispose();
  }
}

module.exports = { acquireApiToken };
