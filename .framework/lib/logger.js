// Structured logging for agent harnesses. Never logs secret values (CLAUDE.md Secret-Management
// Rules) -- callers must not pass credential/token values into `meta`.

const SECRET_KEY_PATTERN = /password|token|secret|api[-_]?key|pat\b/i;

function redact(meta) {
  if (!meta || typeof meta !== 'object') return meta;
  const out = {};
  for (const [key, value] of Object.entries(meta)) {
    out[key] = SECRET_KEY_PATTERN.test(key) ? '[redacted]' : value;
  }
  return out;
}

function line(level, agent, message, meta) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    agent,
    message,
    ...(meta ? { meta: redact(meta) } : {}),
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(entry));
  return entry;
}

function createLogger(agent) {
  return {
    info: (message, meta) => line('info', agent, message, meta),
    warn: (message, meta) => line('warn', agent, message, meta),
    error: (message, meta) => line('error', agent, message, meta),
  };
}

module.exports = { createLogger, redact };
