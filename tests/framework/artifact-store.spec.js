const fs = require('fs');
const { test, expect } = require('@playwright/test');
const artifactStore = require('../../.framework/lib/artifact-store');
const manifest = require('../../.framework/lib/manifest');

function freshRunId(label) {
  return `run-test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

test.afterEach(async () => {
  // Clean up any run directories this file created, keyed by prefix.
  if (fs.existsSync(artifactStore.RUNS_DIR)) {
    for (const dir of fs.readdirSync(artifactStore.RUNS_DIR)) {
      if (dir.startsWith('run-test-')) {
        fs.rmSync(require('path').join(artifactStore.RUNS_DIR, dir), { recursive: true, force: true });
      }
    }
  }
});

test('writeArtifact + readArtifact round-trips and validates against its schema', () => {
  const runId = freshRunId('roundtrip');
  const { artifact } = artifactStore.writeArtifact(runId, 'requirements', 'REQ-RT-1', {
    title: 'Round trip',
    acceptanceCriteria: ['a'],
    sourceRef: 'test',
    sourceType: 'synthetic',
    ambiguities: [],
    missingInformation: [],
  });
  expect(artifact.schemaVersion).toBe(1);

  const read = artifactStore.readArtifact(runId, 'requirements', 'REQ-RT-1');
  expect(read).toEqual(artifact);
});

test('writeArtifact rejects data that fails schema validation', () => {
  const runId = freshRunId('invalid');
  expect(() => artifactStore.writeArtifact(runId, 'requirements', 'REQ-BAD', { title: 'no other fields' })).toThrow();
});

test('listArtifacts returns all artifacts written for a phase', () => {
  const runId = freshRunId('list');
  artifactStore.writeArtifact(runId, 'requirements', 'REQ-A', {
    title: 'A', acceptanceCriteria: ['x'], sourceRef: 's', sourceType: 'synthetic', ambiguities: [], missingInformation: [],
  });
  artifactStore.writeArtifact(runId, 'requirements', 'REQ-B', {
    title: 'B', acceptanceCriteria: ['y'], sourceRef: 's', sourceType: 'synthetic', ambiguities: [], missingInformation: [],
  });
  const all = artifactStore.listArtifacts(runId, 'requirements');
  expect(all.map((a) => a.id).sort()).toEqual(['REQ-A', 'REQ-B']);
});

test('manifest.json may only be written by the orchestrator', () => {
  const runId = freshRunId('manifest-guard');
  expect(() => manifest.upsertRequirement(runId, 'REQ-X', { testCaseIds: [] }, 'test-design')).toThrow(
    /only be written by the Orchestrator/,
  );
  expect(() => manifest.upsertRequirement(runId, 'REQ-X', { testCaseIds: [] }, 'orchestrator')).not.toThrow();
});
