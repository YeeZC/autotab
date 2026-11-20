// Real Chromium service-worker registration test with mocked Chrome APIs and model.
// No user profile, API keys, or paid model requests are used.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
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
const listeners = [];
const tabs = ['github.com', 'github.com', 'github.com', 'github.com', 'developer.chrome.com', 'developer.chrome.com', 'platform.claude.com', 'platform.claude.com', 'figma.com', 'example.com', 'example.com', 'example.com'].map((domain, id) => ({ id, title: '开发资料', url: 'https://' + domain + '/' + id, groupId: -1 }));
tabs.push({ id: 20, groupId: 7, pinned: false }, { id: 21, groupId: -1, pinned: true });
let data = { settings: { provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: 'test-key', model: 'example-model', automatic: true, intervalSeconds: 30, instructions: '' } };
globalThis.__uiData = data;
globalThis.chrome = {
  i18n: { getUILanguage() { return new URL(location.href).searchParams.get('lang') || 'en-US'; } },
  runtime: { id: 'abcdefghijklmnopabcdefghijklmnop', openOptionsPage() {}, async sendMessage(message) { return { result: { message: message.type === 'ungroupAll' ? 'Removed all groups' : 'Done', locale: 'en', running: false, tabCount: 12, groupCount: 3 } }; } },
  storage: { local: { async get() { return data; }, async set(value) { const changes = {}; for (const key of Object.keys(value)) { changes[key] = { newValue: value[key] }; } Object.assign(data, value); listeners.forEach(fn => fn(changes, 'local')); } }, onChanged: { addListener(fn) { listeners.push(fn); } } },
  windows: { async getCurrent() { return { id: 1 }; } },
  tabs: { async query() { return tabs; } },
  permissions: { async request() { return true; } },
};
`;

try {
  server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    if (pathname === '/mock-ui.js') { response.setHeader('Content-Type', 'application/javascript'); response.end(mock); return; }
    const name = pathname.slice(1) || 'popup.html';
    if (!/^[a-zA-Z0-9_./-]+$/.test(name) || name.includes('..')) { response.writeHead(404); response.end(); return; }
    const types = { html: 'text/html', css: 'text/css', js: 'application/javascript', woff2: 'font/woff2' };
    response.setHeader('Content-Type', types[name.split('.').pop()] || 'text/plain');
    try {
      let content = readFileSync('extension/' + name);
      if (name.endsWith('.html')) content = content.toString().replace('<head>', '<head><script src="/mock-ui.js"></script>');
      response.end(content);
    } catch { response.writeHead(404); response.end(); }
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
  async function evaluate(expression) {
    const response = await command('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }
  async function waitFor(expression) {
    for (let attempt = 0; attempt < 100; attempt++) {
      if (await evaluate(expression)) return;
      await new Promise(resolve => setTimeout(resolve, 30));
    }
    throw new Error('UI initialization timeout: ' + expression);
  }
  async function screenshot(name) {
    await evaluate('document.fonts.ready');
    await new Promise(resolve => setTimeout(resolve, 500));
    const screenshot = await command('Page.captureScreenshot', { format: 'png' }, sessionId);
    writeFileSync('.artifacts/' + name + '.png', Buffer.from(screenshot.data, 'base64'));
  }
  mkdirSync('.artifacts', { recursive: true });
  await command('Emulation.setDeviceMetricsOverride', { width: 384, height: 600, deviceScaleFactor: 1, mobile: false }, sessionId);
  await waitFor('document.querySelector("#domains .domain-row")');
  assert.equal(await evaluate('document.querySelector("#count").textContent'), '12');
  assert.equal(await evaluate('document.querySelector("#group-count").textContent'), '1');
  assert.equal(await evaluate('document.querySelector("#pinned-count").textContent'), '1');
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  assert.equal(await evaluate('typeof gsap'), 'object');
  assert.equal(await evaluate('document.body.scrollHeight <= 600'), true);
  await screenshot('popup');
  await evaluate('document.querySelector("#ungroup").click()');
  await waitFor('document.querySelector("#status").textContent === "Removed all groups"');
  await command('Page.navigate', { url: origin + '/options.html' }, sessionId);
  await command('Emulation.setDeviceMetricsOverride', { width: 1100, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
  await waitFor('document.querySelector("#model")?.value === "example-model"');
  await evaluate('document.querySelector("#toggle-key").click()');
  assert.equal(await evaluate('document.querySelector("#apiKey").type'), 'text');
  await evaluate('document.querySelector("#toggle-key").click()');
  assert.equal(await evaluate('document.querySelector("input[value=codex]")'), null);
  await evaluate('document.querySelector("input[value=anthropic]").click()');
  assert.equal(await evaluate('document.querySelector("#baseUrl").value'), 'https://api.anthropic.com/v1');
  await evaluate('document.querySelector("#model").value = "example-model"; document.querySelector("#apiKey").value = "test-key"');
  assert.equal(await evaluate('document.querySelector("#intervalSeconds").min'), '30');
  assert.equal(await evaluate('document.querySelector("#intervalSeconds").value'), '30');
  await evaluate('document.querySelector("#automatic").click()');
  assert.equal(await evaluate('document.querySelector("#intervalSeconds").disabled'), true);
  await evaluate('document.querySelector("#form").requestSubmit()');
  await waitFor('document.querySelector("#status").textContent === "Settings saved"');
  assert.equal(await evaluate('globalThis.__uiData.settings.provider'), 'anthropic');
  assert.equal(await evaluate('globalThis.__uiData.settings.automatic'), false);
  assert.equal(await evaluate('globalThis.__uiData.settings.intervalSeconds'), 30);
  assert.equal(await evaluate('document.querySelector("#supplier")'), null);
  assert.equal(await evaluate('document.querySelectorAll("[name=providerChoice]").length'), 2);
  await screenshot('settings');
  await command('Emulation.setDeviceMetricsOverride', { width: 390, height: 950, deviceScaleFactor: 1, mobile: false }, sessionId);
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
  await screenshot('settings-mobile');
  await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] }, sessionId);
  assert.equal(await evaluate('matchMedia("(prefers-reduced-motion: reduce)").matches'), true);
  for (const [locale, expected, title] of [['en-US', 'en', 'Tabs'], ['zh-CN', 'zh-CN', '标签页'], ['zh-TW', 'zh-CN', '标签页'], ['fr-FR', 'en', 'Tabs']]) {
    await command('Page.navigate', { url: origin + '/popup.html?lang=' + locale }, sessionId);
    await command('Emulation.setDeviceMetricsOverride', { width: 384, height: 600, deviceScaleFactor: 1, mobile: false }, sessionId);
    await waitFor('document.querySelector("#domains .domain-row")');
    assert.equal(await evaluate('document.documentElement.lang'), expected);
    assert.equal(await evaluate('document.querySelector("h1").textContent'), title);
    assert.equal(await evaluate('document.body.scrollHeight <= 600'), true);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true);
    await screenshot('popup-' + locale);
    await command('Page.navigate', { url: origin + '/options.html?lang=' + locale }, sessionId);
    await command('Emulation.setDeviceMetricsOverride', { width: 1100, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);
    await waitFor('document.querySelector("#model")?.value === "example-model"');
    assert.equal(await evaluate('document.documentElement.lang'), expected);
    assert.equal(await evaluate('document.querySelector("#toggle-key").getAttribute("aria-label")'), expected === 'en' ? 'Show API key' : '显示密钥');
    if (expected === 'en') assert.equal(await evaluate('/[\\u3400-\\u9fff]/.test(document.body.innerText)'), false);
    await screenshot('settings-' + locale);
  }
  console.log('UI verified: live tab statistics, domain rows, provider switching, key visibility, scheduling, settings persistence, responsive layout, reduced-motion preference. Screenshots in .artifacts/.');

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
