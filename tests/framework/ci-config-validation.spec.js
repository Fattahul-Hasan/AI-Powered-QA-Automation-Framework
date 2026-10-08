// PHASE 2 — Generic Framework Completion & End-to-End Validation.
//
// Validates .gitlab-ci.yml without adding a YAML-parsing dependency (that would mean editing
// the frozen package.json to add one) -- a lightweight, honest structural check: no tabs
// (YAML's most common real-world break), and every `npm run <script>` referenced in the
// pipeline actually exists in package.json.

const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const REPO_ROOT = path.join(__dirname, '..', '..');
const CI_FILE = path.join(REPO_ROOT, '.gitlab-ci.yml');

test('.gitlab-ci.yml exists and contains no tab characters (a common YAML break)', () => {
  const content = fs.readFileSync(CI_FILE, 'utf8');
  expect(content.includes('\t')).toBe(false);
});

test('.gitlab-ci.yml defines the expected stage order', () => {
  const content = fs.readFileSync(CI_FILE, 'utf8');
  const stagesBlock = content.match(/stages:\n([\s\S]*?)\n\n/)[1];
  const stages = [...stagesBlock.matchAll(/^\s*-\s*(\S+)/gm)].map((m) => m[1]);
  expect(stages).toEqual(['install', 'validate', 'test', 'dry-run', 'publish']);
});

test('every `npm run <script>` referenced in the pipeline exists in package.json', () => {
  const ciContent = fs.readFileSync(CI_FILE, 'utf8');
  const referencedScripts = [...ciContent.matchAll(/npm run ([a-zA-Z0-9:_-]+)/g)].map((m) => m[1]);
  expect(referencedScripts.length).toBeGreaterThan(0);

  const pkg = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'));
  for (const script of referencedScripts) {
    expect(pkg.scripts).toHaveProperty(script);
  }
});

test('every `npx playwright ...` invocation in the pipeline uses a project this config actually defines', () => {
  const ciContent = fs.readFileSync(CI_FILE, 'utf8');
  const referencedProjects = [...ciContent.matchAll(/--project=([a-zA-Z0-9_-]+)/g)].map((m) => m[1]);
  expect(referencedProjects.length).toBeGreaterThan(0);

  const configContent = fs.readFileSync(path.join(REPO_ROOT, 'playwright.config.js'), 'utf8');
  const definedProjects = [...configContent.matchAll(/name:\s*'([a-zA-Z0-9_-]+)'/g)].map((m) => m[1]);
  for (const project of referencedProjects) {
    expect(definedProjects).toContain(project);
  }
});

test('the CI pipeline never invokes any GitLab-write operation', () => {
  const ciContent = fs.readFileSync(CI_FILE, 'utf8').toLowerCase();
  for (const forbidden of ['createmergerequest', 'mergemergerequest', 'createissue', 'postcomment', 'push origin', 'gitlab_permission_mode=full', 'gitlab_permission_mode=modify']) {
    expect(ciContent.includes(forbidden)).toBe(false);
  }
});
