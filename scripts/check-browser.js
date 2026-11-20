// Real Chromium service-worker registration test with mocked Chrome APIs and model.
// No user profile, API keys, or paid model requests are used.
import { createServer } from 'node:http';
import { readFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';

const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'autotab-browser-'));
let browser;
let socket;
let server;
const mock = `
let listener;
const event = { addListener() {} };
const tabs = [1, 2].map(id => ({ id, title: 'Test', url: 'https://example.com/' + id, groupId: -1 }));
globalThis.chrome = {
  runtime: { id: 'test', onInstalled: event, onStartup: event, onMessage: { addListener(fn) { listener = fn; } } },
  storage: { local: { async setAccessLevel() {}, async get() { return { settings: { provider: 'openai', baseUrl: 'https://example.com/v1', apiKey: 'fake', model: 'test' } }; }, async set() {} }, onChanged: event },
  permissions: { async contains() { return true; } }, alarms: { onAlarm: event },
  windows: { async get(id) { return { id, type: 'normal' }; } },
  tabs: { async query() { return tabs; }, async group(options) { for (const tab of tabs) if (options.tabIds.includes(tab.id)) tab.groupId = 1; return 1; } },
  tabGroups: { async update() {} },
};
globalThis.fetch = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ groups: [{ title: '测试', summary: '测试资料', color: 'blue', groupIds: ['d0'] }] }) } }] }) });
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('message', event => { listener(event.data, { id: 'test' }, result => event.ports[0].postMessage(result)); });
`;
try {
  server = createServer((request, response) => {
    response.setHeader('Content-Type', request.url.endsWith('.js') ? 'application/javascript' : 'text/html');
    if (request.url === '/background.js') response.end(mock + readFileSync('extension/background.js', 'utf8'));
    else if (request.url === '/vendor/public-suffix-list.js') response.end(readFileSync('extension/vendor/public-suffix-list.js'));
    else if (['/i18n.js', '/messages.js'].includes(request.url)) response.end(readFileSync('extension' + request.url));
    else if (request.url === '/core.js') response.end(readFileSync('extension/core.js'));
    else if (request.url === '/invalid-worker.js') response.end('await Promise.resolve();');
    else response.end('<!doctype html><title>AutoTab test</title>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = spawn(chromePath, ['--headless=new', '--no-first-run', '--no-default-browser-check', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: ['ignore', 'ignore', 'pipe'] });
  const endpoint = await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Chrome startup timeout')), 15000);
    let output = '';
    browser.on('error', error => { clearTimeout(timeout); reject(error); });
    browser.stderr.on('data', chunk => {
      output += chunk.toString();
      const match = output.match(/DevTools listening on (ws:\/\/[^\s]+)/);
      if (match) { clearTimeout(timeout); resolve(match[1]); }
    });
  });
  socket = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let sequence = 0;
  const pending = new Map();
  socket.onmessage = event => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const callback = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) callback.reject(new Error(JSON.stringify(message.error)));
      else callback.resolve(message.result);
    }
  };
  function command(method, params = {}, sessionId) {
    return new Promise((resolve, reject) => {
      const id = ++sequence;
      pending.set(id, { resolve, reject });
      socket.send(JSON.stringify({ id, method, params, sessionId }));
    });
  }
  const { targetId } = await command('Target.createTarget', { url: origin });
  const { sessionId } = await command('Target.attachToTarget', { targetId, flatten: true });
  // Wait for the initial page navigation before evaluating the registration.
  for (let attempt = 0; attempt < 100; attempt++) {
    const location = await command('Runtime.evaluate', { expression: 'location.origin', returnByValue: true }, sessionId);
    if (location.result.value === origin) break;
    if (attempt === 99) throw new Error('Test page navigation failed');
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  const result = await command('Runtime.evaluate', {
    expression: `(async () => {
      let rejectedTopLevelAwait = false;
      try { await navigator.serviceWorker.register('/invalid-worker.js', { type: 'module', scope: '/invalid/' }); }
      catch { rejectedTopLevelAwait = true; }
      await navigator.serviceWorker.register('/background.js', { type: 'module' });
      const registration = await navigator.serviceWorker.ready;
      const response = await new Promise((resolve, reject) => {
        const channel = new MessageChannel();
        const timeout = setTimeout(() => reject(new Error('Background did not respond')), 5000);
        channel.port1.onmessage = event => { clearTimeout(timeout); resolve(event.data); };
        registration.active.postMessage({ type: 'group', windowId: 1 }, [channel.port2]);
      });
      return { rejectedTopLevelAwait, response };
    })()`, awaitPromise: true, returnByValue: true,
  }, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails));
  assert.equal(result.result.value.rejectedTopLevelAwait, true);
  assert.equal(result.result.value.response.result.requestCount, 1);
  assert.equal(result.result.value.response.result.tabCount, 2);
  console.log('Chrome confirmed: top-level await rejected; fixed worker registered, handled message, grouped 2 tabs locally, and requested a group name.');
} finally {
  socket?.close();
  if (browser && browser.exitCode === null) {
    const exited = new Promise(resolve => browser.once('exit', resolve));
    browser.kill('SIGTERM');
    await exited;
  }
  if (server) await new Promise(resolve => server.close(resolve));
  rmSync(profile, { recursive: true, force: true });
}
