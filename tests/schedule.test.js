import test from 'node:test';
import assert from 'node:assert/strict';
import { defaults, normalizeSettings, validateSettings } from '../extension/core.js';
let initialize;
let saved;
let created = [];
let cleared = [];
const event = { addListener() {} };
globalThis.chrome = {
  storage: { local: {
    async setAccessLevel() {}, async get() { return { settings: saved }; },
    async set(value) { saved = value.settings; },
  }, onChanged: event },
  runtime: { onInstalled: { addListener(callback) { initialize = callback; } }, onStartup: event, onMessage: event },
  alarms: { onAlarm: event, async clear(name) { cleared.push(name); }, async create(name, options) { created.push({ name, ...options }); } },
};
await import('../extension/background.js');
test('legacy minute settings convert to seconds exactly once', async () => {
  saved = { provider: 'openai', automatic: true, interval: 2 };
  created = []; cleared = [];
  await initialize();
  assert.equal(saved.intervalSeconds, 120);
  assert.equal(Object.hasOwn(saved, 'interval'), false);
  assert.equal(created[0].periodInMinutes, 2);
  await initialize();
  assert.equal(saved.intervalSeconds, 120);
  assert.equal(created[1].periodInMinutes, 2);
});
test('30-second setting schedules a half-minute Chrome alarm; disabling clears it', async () => {
  saved = { ...defaults, automatic: true, intervalSeconds: 30 };
  created = []; cleared = [];
  await initialize();
  assert.equal(created[0].periodInMinutes, 0.5);
  saved.automatic = false;
  await initialize();
  assert.equal(created.length, 1);
  assert.equal(cleared.length, 2);
});
test('seconds validation enforces Chrome minimum and preserves existing frequency', () => {
  const credentials = { ...defaults, apiKey: 'key', model: 'model' };
  for (const intervalSeconds of [0, 29, 30.5, 86401, NaN]) assert.throws(() => validateSettings({ ...credentials, intervalSeconds }));
  for (const intervalSeconds of [30, 45, 60, 86400]) assert.equal(validateSettings({ ...credentials, intervalSeconds }).intervalSeconds, intervalSeconds);
  assert.equal(normalizeSettings({ interval: 30 }).intervalSeconds, 1800);
  assert.equal(normalizeSettings({ interval: 2, intervalSeconds: 45 }).intervalSeconds, 45);
});
