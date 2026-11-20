// Render the existing vector identity at exact Chrome icon sizes using a temporary browser profile.
import { createServer } from 'node:http';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const chromePath = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const profile = mkdtempSync(join(tmpdir(), 'autotab-browser-'));
let browser;
let socket;
let server;

try {
  server = createServer((request, response) => {
    const pathname = new URL(request.url, 'http://localhost').pathname;
    const name = pathname.slice(1) || 'popup.html';
    if (!/^[a-zA-Z0-9_./-]+$/.test(name) || name.includes('..')) { response.writeHead(404); response.end(); return; }
    const types = { html: 'text/html', css: 'text/css', js: 'application/javascript', woff2: 'font/woff2', svg: 'image/svg+xml' };
    response.setHeader('Content-Type', types[name.split('.').pop()] || 'text/plain');
    try {
      let content = readFileSync('extension/' + name);
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
  await command('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } }, sessionId);
  for (const size of [16, 32, 48, 128, 512]) {
    await command('Emulation.setDeviceMetricsOverride', { width: size, height: size, deviceScaleFactor: 1, mobile: false }, sessionId);
    await command('Page.navigate', { url: origin + '/icons/icon.svg' }, sessionId);
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await command('Runtime.evaluate', { expression: 'document.documentElement.tagName === "svg" && document.readyState === "complete"', returnByValue: true }, sessionId);
      if (result.result.value) break;
      if (attempt === 99) throw new Error('SVG load timeout');
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    await new Promise(resolve => setTimeout(resolve, 80));
    const result = await command('Page.captureScreenshot', { format: 'png' }, sessionId);
    writeFileSync('extension/icons/icon-' + size + '.png', Buffer.from(result.data, 'base64'));
  }
  console.log('Rendered transparent PNG icons at 16, 32, 48, 128 and 512 pixels.');

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
