// Stable ID generation. ARCHITECTURE.md Section A/N: every artifact needs a stable ID.

function slugify(text) {
  return String(text)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

function newRunId(now = Date.now()) {
  const rand = Math.random().toString(36).slice(2, 8);
  return `run-${now}-${rand}`;
}

function requirementId(slug) {
  return `REQ-${slugify(slug)}`;
}

function testCaseId(requirementIdValue, sequence) {
  const base = requirementIdValue.replace(/^REQ-/, '');
  return `TC-${base}-${String(sequence).padStart(2, '0')}`;
}

function prefixedId(prefix, seed) {
  return `${prefix}-${seed}`;
}

module.exports = {
  slugify,
  newRunId,
  requirementId,
  testCaseId,
  prefixedId,
};
