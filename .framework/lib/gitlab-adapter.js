// GitLab integration adapter (ARCHITECTURE.md Section G). Read operations are honest about
// what this plain Node harness can and cannot do: real GitLab read access in this project goes
// through the GitLab MCP server (.mcp.json), which is only reachable from an interactive Claude
// Code session, not from a standalone `node` process. This adapter defines the read interface
// the agent harnesses call, and is honest ("not-connected") when no such session is invoking it.
//
// Write operations are hard-disabled at the code level, not just by documentation or by the
// current .mcp.json permission mode -- calling any of them always throws, regardless of env
// vars, unless a future, separately-approved Phase 9 change replaces this module.

class GitLabWriteDisabledError extends Error {}

function readOperation(name) {
  return async function read(..._args) {
    return {
      connected: false,
      operation: name,
      note:
        'Read-only GitLab access in this project is provided by the GitLab MCP server ' +
        '(.mcp.json), reachable only from an interactive Claude Code session. This adapter ' +
        'function is the interface a harness script calls; it reports "not-connected" rather ' +
        'than fabricating GitLab data when run as a plain Node process.',
    };
  };
}

const readIssue = readOperation('readIssue');
const readMergeRequest = readOperation('readMergeRequest');
const readPipeline = readOperation('readPipeline');
const readRepositoryFile = readOperation('readRepositoryFile');

function writeOperationDisabled(name) {
  return async function write() {
    throw new GitLabWriteDisabledError(
      `${name} is disabled. GitLab MCP must remain read-only until ARCHITECTURE.md Phase 9 is ` +
        'explicitly approved (ARCHITECTURE.md Section G, Decision 2). This is a hard, code-level ' +
        'block -- it is not controlled by any environment variable.',
    );
  };
}

const createMergeRequest = writeOperationDisabled('createMergeRequest');
const mergeMergeRequest = writeOperationDisabled('mergeMergeRequest');
const pushToBranch = writeOperationDisabled('pushToBranch');
const createIssue = writeOperationDisabled('createIssue');
const postComment = writeOperationDisabled('postComment');

module.exports = {
  GitLabWriteDisabledError,
  readIssue,
  readMergeRequest,
  readPipeline,
  readRepositoryFile,
  createMergeRequest,
  mergeMergeRequest,
  pushToBranch,
  createIssue,
  postComment,
};
