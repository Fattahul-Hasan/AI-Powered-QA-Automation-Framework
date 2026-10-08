// ARCHITECTURE.md Section C: Dynamic Test-Data Architecture.
//
// Generic, application-agnostic data generation helpers. Nothing here knows about any real
// application's fields or business rules — that belongs to a future Test Data Agent output,
// scoped per module, once a target application exists.

function timestampSuffix() {
  return Date.now().toString(36);
}

function randomString(length = 8) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < length; i += 1) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

function uniqueEmail(prefix = 'user') {
  return `${prefix}.${timestampSuffix()}.${randomString(4)}@example.test`;
}

function uniqueUsername(prefix = 'user') {
  return `${prefix}_${timestampSuffix()}_${randomString(4)}`;
}

// Deterministic PRNG (mulberry32) for tests that need reproducibility instead of uniqueness.
function seededRandom(seed) {
  let t = seed >>> 0;
  return function next() {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

// Namespaces generated data per module/feature and tracks cleanup callbacks so a test can tear
// down whatever it created — every data artifact must declare its own teardown (Section C).
function createDataFactory(moduleName) {
  const cleanupTasks = [];

  return {
    uniqueEmail: (prefix = moduleName) => uniqueEmail(prefix),
    uniqueUsername: (prefix = moduleName) => uniqueUsername(prefix),
    randomString,
    seededRandom,
    registerCleanup(task) {
      cleanupTasks.push(task);
    },
    async runCleanup() {
      while (cleanupTasks.length) {
        const task = cleanupTasks.pop();
        await task();
      }
    },
  };
}

module.exports = {
  timestampSuffix,
  randomString,
  uniqueEmail,
  uniqueUsername,
  seededRandom,
  createDataFactory,
};
