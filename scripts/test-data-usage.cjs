const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kagopita-data-usage-'));
  const socket = net.createServer();
  await new Promise(resolve => socket.listen(0, '127.0.0.1', resolve));
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  const base = `http://127.0.0.1:${port}`;
  const child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: String(port), KAGOPITA_DATA_DIR: directory, NODE_ENV: 'test' }, stdio: 'ignore' });
  let browser;
  const raw = (url, encoding, headers = {}) => new Promise((resolve, reject) => {
    http.get(base + url, { headers: { 'Accept-Encoding': encoding, ...headers } }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, bytes: Buffer.concat(chunks).length }));
    }).on('error', reject);
  });
  try {
    let ready = false;
    for (let i = 0; i < 100; i++) {
      try { if ((await fetch(base)).ok) { ready = true; break; } } catch {}
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.ok(ready, 'Isolated server starts');
    const home = await fetch(base), html = await home.text();
    assert.equal(home.headers.get('cache-control'), 'no-cache');
    assert.equal((html.match(/https:\/\/pagead2\.googlesyndication\.com\/pagead\/js\/adsbygoogle\.js\?client=ca-pub-5805938506004625/g) || []).length, 1, 'Original AdSense publisher loader is preserved exactly once');
    const assets = [...html.matchAll(/(?:src|href)="(\/(?:js|css)\/[^"?]+\?v=[a-f0-9]{16})"/g)].map(match => match[1]);
    assert.ok(assets.length > 20, 'All local scripts and styles are fingerprinted');
    let original = 0, compressed = 0;
    for (const asset of assets) {
      const plain = await raw(asset, 'identity'), gzip = await raw(asset, 'gzip');
      original += plain.bytes; compressed += gzip.bytes;
      assert.match(gzip.headers['cache-control'], /immutable/);
      if (plain.bytes >= 1024) assert.equal(gzip.headers['content-encoding'], 'gzip');
      const conditional = await raw(asset, 'identity', { 'If-None-Match': plain.headers.etag });
      assert.equal(conditional.status, 304);
    }
    assert.ok(compressed < original * 0.4, 'Local asset transfer reduced by at least 60%');
    assert.ok(!(await fetch(base + '/js/app.js?v=stale')).headers.get('cache-control').includes('immutable'), 'Unmatched versions cannot get immutable caching');
    assert.equal((await fetch(base + '/sw.js')).headers.get('cache-control'), 'no-cache');
    const account = await fetch(base + '/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Data test', termsAccepted: true, termsVersion: require('../terms.json').version }) });
    assert.equal(account.status, 201);
    const cookie = account.headers.get('set-cookie').split(';')[0];
    const request = async (url, body) => {
      const response = await fetch(base + url, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      assert.ok(response.ok); return response.json();
    };
    const channel = await request('/api/channels', { name: 'Data saving' });
    const stream = await fetch(base + '/api/events', { headers: { Cookie: cookie, 'Accept-Encoding': 'gzip' } });
    assert.equal(stream.headers.get('content-encoding'), null, 'SSE is not buffered by compression');
    await stream.body.cancel();
    browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
    const context = await browser.newContext();
    await context.route('**/*', route => new URL(route.request().url()).origin === base ? route.continue() : route.abort());
    await context.addCookies([{ name: 'kagopita_session', value: cookie.split('=')[1], url: base }]);
    await context.addInitScript(() => {
      const Native = window.EventSource;
      window.EventSource = class extends Native { constructor(...args) { super(...args); window.testStream = this; } };
    });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    let syncs = 0;
    page.on('request', request => { if (new URL(request.url()).pathname === '/api/me') syncs++; });
    await page.goto(base);
    await page.waitForFunction(() => window.testStream?.readyState === 1 && typeof shoppingData !== 'undefined' && shoppingData);
    await page.clock.runFor(1000);
    await page.waitForTimeout(500); await page.clock.runFor(1000); await page.waitForTimeout(500);
    const initial = syncs;
    await page.clock.fastForward(60000); await page.clock.runFor(500);
    assert.equal(syncs, initial, 'Healthy SSE avoids repeated full-list downloads');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
    assert.equal(await page.evaluate(() => testStream.readyState), 2, 'Background tabs close their stream');
    await request(`/api/channels/${channel.id}/items`, { name: 'While away', category: 'Other', qty: '1' });
    await page.clock.fastForward(60000); await page.clock.runFor(500);
    assert.equal(syncs, initial, 'No background list downloads');
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.clock.runFor(1000);
    await page.waitForFunction(() => shoppingData.categories.some(category => category.items.some(item => item.name === 'While away')));
    await page.clock.fastForward(300000); await page.clock.runFor(500);
    assert.ok(syncs > initial, 'Catch-up and periodic safety refresh remain available');
    assert.deepEqual(errors, []);
    console.log(`PASS: local JS/CSS ${original} → ${compressed} bytes (${Math.round((1 - compressed / original) * 100)}% less); fingerprinted caching/304s; AdSense publisher loader preserved; unbuffered SSE; no repeated healthy-stream or background list downloads; resume catch-up.`);
  } finally {
    await browser?.close();
    if (child.exitCode === null) { const stopped = new Promise(resolve => child.once('exit', resolve)); child.kill(); await stopped; }
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
