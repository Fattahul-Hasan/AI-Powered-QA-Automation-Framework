// PHASE 5, B11 (notification/reporting hooks). A generic adapter interface with two working,
// dependency-free reference implementations (console, file) -- no external service required,
// no Slack/Teams/email SDK installed. Future adapters (Slack, Teams, email) implement the same
// `(event, payload) => void|Promise<void>` shape and can be passed to `notify()` unchanged.

const fs = require('fs');

function consoleAdapter(event, payload) {
  // eslint-disable-next-line no-console
  console.log(`[notification] ${event}: ${JSON.stringify(payload)}`);
}

function createFileAdapter(filePath) {
  return function fileAdapter(event, payload) {
    const line = JSON.stringify({ timestamp: new Date().toISOString(), event, payload });
    fs.appendFileSync(filePath, `${line}\n`);
  };
}

async function notify(event, payload, adapter = consoleAdapter) {
  if (typeof event !== 'string' || !event) {
    throw new Error('notify() requires a non-empty event name.');
  }
  if (typeof adapter !== 'function') {
    throw new Error('notify() requires an adapter function: (event, payload) => void|Promise<void>.');
  }
  await adapter(event, payload);
}

module.exports = { notify, consoleAdapter, createFileAdapter };
