const { test, expect } = require('@playwright/test');
const { createDataFactory, uniqueEmail, uniqueUsername, seededRandom } = require('../../utils/data-factory');
const { generateFor } = require('../../.framework/agents/test-data');

test('uniqueEmail/uniqueUsername never collide across repeated calls', () => {
  const emails = new Set();
  const usernames = new Set();
  for (let i = 0; i < 20; i += 1) {
    emails.add(uniqueEmail('demo'));
    usernames.add(uniqueUsername('demo'));
  }
  expect(emails.size).toBe(20);
  expect(usernames.size).toBe(20);
});

test('seededRandom is deterministic for the same seed', () => {
  const a = seededRandom(42);
  const b = seededRandom(42);
  const sequenceA = [a(), a(), a()];
  const sequenceB = [b(), b(), b()];
  expect(sequenceA).toEqual(sequenceB);
});

test('seededRandom differs across different seeds', () => {
  const a = seededRandom(1)();
  const b = seededRandom(2)();
  expect(a).not.toBe(b);
});

test('createDataFactory namespaces generated data per module', () => {
  const factory = createDataFactory('login');
  expect(factory.uniqueUsername()).toMatch(/^login_/);
});

test('cleanup registration runs all registered tasks in LIFO order, then empties', async () => {
  const factory = createDataFactory('cleanup-test');
  const order = [];
  factory.registerCleanup(() => order.push('first'));
  factory.registerCleanup(() => order.push('second'));
  await factory.runCleanup();
  expect(order).toEqual(['second', 'first']);
  // Repeated execution of the same cleanup must not fail simply because it already ran.
  await expect(factory.runCleanup()).resolves.toBeUndefined();
});

test('repeated invocation with the same visitorSessionTag data need never fails due to prior data', () => {
  const tc = { data: { dataNeeds: ['visitorSessionTag'] } };
  const factory = createDataFactory('demo');
  const first = generateFor(tc, factory);
  const second = generateFor(tc, factory);
  expect(first.visitorSessionTag).not.toBe(second.visitorSessionTag);
});
