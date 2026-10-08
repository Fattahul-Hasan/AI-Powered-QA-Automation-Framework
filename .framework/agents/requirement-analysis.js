// Requirement Analysis Agent (ARCHITECTURE.md Section 4).
//
// Real Markdown parsing of a requirement source -- never invents acceptance criteria or
// resolves ambiguity on its own judgment (Section 4: "must NEVER invent missing requirements").
// In dry-run mode the source is the clearly-labeled synthetic fixture at
// .framework/fixtures/requirements.md; in real use, the same parser would run against a real
// requirement document supplied later.

const fs = require('fs');
const path = require('path');
const { createLogger } = require('../lib/logger');
const { writeArtifact } = require('../lib/artifact-store');
const { appendAuditRecord } = require('../lib/audit');

const logger = createLogger('requirement-analysis');

function parseRequirementsMarkdown(markdown) {
  const lines = markdown.split(/\r?\n/);
  const requirements = [];
  let current = null;
  let section = null; // 'description' | 'acceptanceCriteria' | 'ambiguities' | null

  function flush() {
    if (current) requirements.push(current);
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    const heading = line.match(/^## (REQ-[A-Z0-9-]+): (.+)$/);
    if (heading) {
      flush();
      current = {
        id: heading[1],
        title: heading[2],
        description: '',
        acceptanceCriteria: [],
        ambiguities: [],
        missingInformation: [],
        actors: [],
        module: null,
        feature: null,
      };
      section = 'description';
      continue;
    }
    if (!current) continue;

    if (/^\*\*Acceptance Criteria:\*\*/.test(line)) {
      section = 'acceptanceCriteria';
      if (/intentionally incomplete/i.test(line)) {
        current.missingInformation.push('Acceptance criteria explicitly marked incomplete in source.');
      }
      continue;
    }
    if (/^\*\*Ambiguities:\*\*/.test(line)) {
      section = 'ambiguities';
      continue;
    }
    const actorsMatch = line.match(/^\*\*Actors:\*\*\s*(.+)$/);
    if (actorsMatch) {
      current.actors = actorsMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
      section = null;
      continue;
    }
    const moduleMatch = line.match(/^\*\*Module:\*\*\s*(.+)$/);
    if (moduleMatch) {
      current.module = moduleMatch[1].trim();
      continue;
    }
    const featureMatch = line.match(/^\*\*Feature:\*\*\s*(.+)$/);
    if (featureMatch) {
      current.feature = featureMatch[1].trim();
      continue;
    }
    if (line.startsWith('- ')) {
      const item = line.slice(2).trim();
      if (section === 'acceptanceCriteria') current.acceptanceCriteria.push(item);
      else if (section === 'ambiguities') current.ambiguities.push(item);
      continue;
    }
    if (line === '' || line.startsWith('#') || line.startsWith('*(')) continue;

    if (section === 'description') {
      current.description = current.description ? `${current.description} ${line}` : line;
    }
  }
  flush();
  return requirements;
}

function classifyHighRiskCategory(requirement) {
  const HIGH_RISK = ['Payments', 'PII / Sensitive Data', 'User Account Deletion', 'Financial Transactions', 'Authentication / Authorization'];
  const text = `${requirement.title} ${requirement.description}`.toLowerCase();
  const map = {
    Payments: /payment|billing|checkout/,
    'PII / Sensitive Data': /personal data|pii|sensitive/,
    'User Account Deletion': /delete account|account deletion/,
    'Financial Transactions': /transaction|transfer|invoice/,
    'Authentication / Authorization': /login|authenticat|authoriz|permission|role/,
  };
  for (const category of HIGH_RISK) {
    if (map[category].test(text)) return category;
  }
  return null;
}

async function run({ runId, sourcePath = path.join(__dirname, '..', 'fixtures', 'requirements.md') } = {}) {
  logger.info('Starting requirement analysis', { runId, sourcePath });

  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Requirement source not found: ${sourcePath}`);
  }
  const markdown = fs.readFileSync(sourcePath, 'utf8');
  const isSynthetic = sourcePath.includes(`${path.sep}fixtures${path.sep}`);
  const parsed = parseRequirementsMarkdown(markdown);

  if (parsed.length === 0) {
    logger.warn('No requirements found in source', { sourcePath });
  }

  const results = [];
  for (const requirement of parsed) {
    const hasAmbiguity = requirement.ambiguities.length > 0 || requirement.missingInformation.length > 0;
    const artifactData = {
      status: hasAmbiguity ? 'partial' : 'ok',
      title: requirement.title,
      description: requirement.description,
      actors: requirement.actors,
      module: requirement.module,
      feature: requirement.feature,
      workflows: [],
      businessRules: [],
      acceptanceCriteria: requirement.acceptanceCriteria,
      dependencies: [],
      validations: [],
      risks: hasAmbiguity ? ['Ambiguous requirement -- human clarification required before Test Design consumes it.'] : [],
      sourceRef: sourcePath,
      sourceType: isSynthetic ? 'synthetic' : 'markdown',
      ambiguities: requirement.ambiguities,
      missingInformation: requirement.missingInformation,
      highRiskCategory: classifyHighRiskCategory(requirement),
    };
    const { artifact } = writeArtifact(runId, 'requirements', requirement.id, artifactData);
    results.push(artifact);

    if (hasAmbiguity) {
      logger.warn('Requirement flagged ambiguous -- human clarification required (ARCHITECTURE.md Section Q gate #1)', {
        requirementId: requirement.id,
      });
    }
    appendAuditRecord(runId, {
      agent: 'requirement-analysis',
      action: 'requirement-extracted',
      requirementId: requirement.id,
      ambiguous: hasAmbiguity,
    });
  }

  logger.info('Requirement analysis complete', { runId, count: results.length });
  return results;
}

module.exports = { run, parseRequirementsMarkdown, classifyHighRiskCategory };
