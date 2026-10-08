// PHASE 5, B11 (notification/reporting hooks): generic adapter interface, no external service.

const fs = require('fs');
const os = require('os');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { notify, consoleAdapter, createFileAdapter } = require('../../.framework/lib/notification-adapter');

test('notify() invokes the given adapter with the exact event and payload', async () => {
  const calls = [];
  await notify('release-readiness', { status: 'PASS' }, (event, payload) => calls.push({ event, payload }));
  expect(calls).toEqual([{ event: 'release-readiness', payload: { status: 'PASS' } }]);
});

test('the default consoleAdapter never throws', async () => {
  await expect(notify('test-event', { a: 1 })).resolves.toBeUndefined();
});

test('consoleAdapter is exported directly and callable on its own', () => {
  expect(() => consoleAdapter('x', { y: 1 })).not.toThrow();
});

test('createFileAdapter writes a real, appendable JSON-lines record', async () => {
  const filePath = path.join(os.tmpdir(), `notify-${Date.now()}.jsonl`);
  try {
    const adapter = createFileAdapter(filePath);
    await notify('event-one', { n: 1 }, adapter);
    await notify('event-two', { n: 2 }, adapter);

    const lines = fs.readFileSync(filePath, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    expect(lines.length).toBe(2);
    expect(lines[0].event).toBe('event-one');
    expect(lines[1].event).toBe('event-two');
  } finally {
    fs.rmSync(filePath, { force: true });
  }
});

test('a missing/empty event name throws rather than silently notifying nothing', async () => {
  await expect(notify('', {})).rejects.toThrow(/non-empty event name/);
});

test('a non-function adapter throws a clear error', async () => {
  await expect(notify('x', {}, 'not-a-function')).rejects.toThrow(/adapter function/);
});

test('an async (Slack/Teams-shaped) adapter is awaited correctly, proving the interface works for future adapters too', async () => {
  let resolved = false;
  const asyncAdapter = async () => {
    await new Promise((r) => setTimeout(r, 10));
    resolved = true;
  };
  await notify('x', {}, asyncAdapter);
  expect(resolved).toBe(true);
});
