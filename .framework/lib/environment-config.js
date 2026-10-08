// PHASE 5, B9 (environment management). Supports multiple named environments (local/QA/
// staging/CI) without changing test code -- via config, never real URLs/credentials committed
// (`.framework/config/environments.example.json` is placeholders only). Every load routes
// through the existing `environment-safety.js` guard -- this module cannot be used to bypass
// the production-execution block, only to name a config that guard will still evaluate.

const fs = require('fs');
const path = require('path');
const { assertNonProductionEnvironment } = require('./environment-safety');

const DEFAULT_CONFIG_PATH = path.join(__dirname, '..', 'config', 'environments.example.json');

function loadEnvironmentConfigs(configPath = DEFAULT_CONFIG_PATH) {
  if (!fs.existsSync(configPath)) {
    throw new Error(`Environment config not found: ${configPath}`);
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (err) {
    throw new Error(`Environment config is not valid JSON: ${configPath} (${err.message})`);
  }
}

function loadEnvironmentConfig(name, { configPath = DEFAULT_CONFIG_PATH } = {}) {
  const configs = loadEnvironmentConfigs(configPath);
  const config = configs[name];
  if (!config) {
    throw new Error(`Unknown environment "${name}". Known environments: ${Object.keys(configs).join(', ')}`);
  }
  // Never bypasses the existing production-execution guard -- a named environment config still
  // has to pass the same check a raw BASE_URL/TEST_ENVIRONMENT pair would.
  assertNonProductionEnvironment({ baseURL: config.baseURL, testEnvironment: config.testEnvironment });
  return config;
}

module.exports = { loadEnvironmentConfig, loadEnvironmentConfigs, DEFAULT_CONFIG_PATH };
