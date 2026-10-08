// PHASE 4, A1 (requirement change detection). Compares two versions of a requirement source
// and classifies each requirement id as added, removed, modified, or unchanged. Accepts either
// a full requirement artifact (`{ id, data: { title, ... } }`, as written by
// requirement-analysis.js) or the raw parsed shape (`{ id, title, ... }`, as returned by
// requirement-analysis.js's own exported `parseRequirementsMarkdown`) -- both are real shapes
// already used elsewhere in this framework, nothing new is invented.

const COMPARED_FIELDS = ['title', 'description', 'acceptanceCriteria'];

function fieldsOf(requirement) {
  return requirement.data || requirement;
}

function fieldValue(requirement, field) {
  return JSON.stringify(fieldsOf(requirement)[field] ?? null);
}

function computeChangedFields(oldReq, newReq) {
  return COMPARED_FIELDS.filter((field) => fieldValue(oldReq, field) !== fieldValue(newReq, field));
}

// Returns { added: [id], removed: [id], modified: [{id, changedFields}], unchanged: [id] }.
// Never invents a change: an id present in both with identical compared-field values is
// unchanged, full stop -- no heuristic "probably meant the same thing" fuzziness here (that
// belongs to a similarity-based tool like test-design.js's findSimilarTestCases, not this one).
function diffRequirements(oldRequirements = [], newRequirements = []) {
  const oldById = new Map(oldRequirements.map((r) => [r.id, r]));
  const newById = new Map(newRequirements.map((r) => [r.id, r]));

  const added = [];
  const modified = [];
  const unchanged = [];

  for (const [id, newReq] of newById) {
    if (!oldById.has(id)) {
      added.push(id);
      continue;
    }
    const changedFields = computeChangedFields(oldById.get(id), newReq);
    if (changedFields.length === 0) {
      unchanged.push(id);
    } else {
      modified.push({ id, changedFields });
    }
  }

  const removed = [...oldById.keys()].filter((id) => !newById.has(id));

  return { added, removed, modified, unchanged };
}

// Optional persistence into the standard artifact store, for callers that want this diff
// recorded alongside the rest of a run's artifacts. The pure `diffRequirements` above needs no
// runId/artifact-store dependency at all -- this is a separate, opt-in convenience.
function persistRequirementChange(runId, id, diffResult) {
  const { writeArtifact } = require('./artifact-store');
  return writeArtifact(runId, 'requirement-change', id, diffResult);
}

module.exports = { diffRequirements, computeChangedFields, COMPARED_FIELDS, persistRequirementChange };
