// PHASE 5, B2 (test execution profiles). Config-driven profile -> Playwright CLI args
// resolution -- never hardcoded product behavior. `.framework/config/execution-profiles.json`
// is the single source of truth; this module only resolves a profile name to CLI arguments, it
// never invokes Playwright itself (that stays the Execution Agent's job).

const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', 'config', 'execution-profiles.json');

function loadProfiles(configPath = DEFAULT_CONFIG_PATH) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Execution profiles config not found: ${configPath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(`Execution profiles config is not valid JSON: ${configPath} (${err.message})`);
  }
}

// Returns a Playwright CLI argument array for the named profile. Never assumes a profile that
// isn't explicitly configured -- an unknown name is a clear error, not a silent fallback.
function resolveProfile(name, { configPath = DEFAULT_CONFIG_PATH } = {}) {
  const profiles = loadProfiles(configPath);
  const profile = profiles[name];
  if (!profile) {
    throw new Error(`Unknown execution profile "${name}". Known profiles: ${Object.keys(profiles).join(', ')}`);
  }
  const args = [];
  if (profile.testDir) args.push(profile.testDir);
  if (profile.grep) args.push('--grep', profile.grep);
  if (profile.project) args.push(`--project=${profile.project}`);
  return args;
}

module.exports = { resolveProfile, loadProfiles, DEFAULT_CONFIG_PATH };
