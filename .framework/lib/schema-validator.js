// Real JSON Schema validation for every artifact (ARCHITECTURE.md Section N: schemaVersion on
// every artifact so the contract is enforced, not just documented).

const fs = require('fs');
const path = require('path');
const Ajv = require('ajv');

const SCHEMAS_DIR = path.join(__dirname, '..', 'schemas');

const ajv = new Ajv({ allErrors: true, strict: false });
const compiledCache = new Map();

function loadSchema(schemaFile) {
  const fullPath = path.join(SCHEMAS_DIR, schemaFile);
  if (!fs.existsSync(fullPath)) {
    throw new Error(`Unknown schema "${schemaFile}" (looked in ${SCHEMAS_DIR})`);
  }
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

function getValidator(schemaFile) {
  if (compiledCache.has(schemaFile)) return compiledCache.get(schemaFile);
  const schema = loadSchema(schemaFile);
  const validate = ajv.compile(schema);
  compiledCache.set(schemaFile, validate);
  return validate;
}

function validate(schemaFile, data) {
  const validateFn = getValidator(schemaFile);
  const valid = validateFn(data);
  return {
    valid,
    errors: valid ? [] : (validateFn.errors || []).map((e) => `${e.instancePath || '(root)'} ${e.message}`),
  };
}

function assertValid(schemaFile, data) {
  const result = validate(schemaFile, data);
  if (!result.valid) {
    throw new Error(
      `Artifact failed schema validation against ${schemaFile}:\n  - ${result.errors.join('\n  - ')}`,
    );
  }
  return data;
}

function listSchemaFiles() {
  return fs.readdirSync(SCHEMAS_DIR).filter((f) => f.endsWith('.schema.json'));
}

module.exports = { validate, assertValid, listSchemaFiles, SCHEMAS_DIR };
