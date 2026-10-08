// ARCHITECTURE.md Section G / CLAUDE.md MCP Rules: GitLab MCP must remain read-only until
// Phase 9. This proves the write interfaces are disabled at the code level, not just by
// .mcp.json configuration.

const { test, expect } = require('@playwright/test');
const gitlab = require('../../.framework/lib/gitlab-adapter');

test('createMergeRequest always throws GitLabWriteDisabledError', async () => {
  await expect(gitlab.createMergeRequest()).rejects.toThrow(gitlab.GitLabWriteDisabledError);
});

test('mergeMergeRequest always throws', async () => {
  await expect(gitlab.mergeMergeRequest()).rejects.toThrow(gitlab.GitLabWriteDisabledError);
});

test('pushToBranch always throws', async () => {
  await expect(gitlab.pushToBranch()).rejects.toThrow(gitlab.GitLabWriteDisabledError);
});

test('createIssue always throws', async () => {
  await expect(gitlab.createIssue()).rejects.toThrow(gitlab.GitLabWriteDisabledError);
});

test('postComment always throws', async () => {
  await expect(gitlab.postComment()).rejects.toThrow(gitlab.GitLabWriteDisabledError);
});

test('write operations are not controlled by any environment variable -- setting one does not enable them', async () => {
  process.env.ALLOW_GITLAB_WRITE = 'true';
  process.env.GITLAB_PERMISSION_MODE = 'full';
  await expect(gitlab.createMergeRequest()).rejects.toThrow(gitlab.GitLabWriteDisabledError);
  delete process.env.ALLOW_GITLAB_WRITE;
  delete process.env.GITLAB_PERMISSION_MODE;
});

test('read operations are honest about not being connected from a plain Node process', async () => {
  const result = await gitlab.readMergeRequest('123');
  expect(result.connected).toBe(false);
  expect(result.note.toLowerCase()).toContain('read-only');
});
