const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { chromium, devices } = require('playwright');
(async () => {
 const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'kagopita-pwa-'));
 const listener = net.createServer(); await new Promise(r => listener.listen(0, '127.0.0.1', r));
 const port = listener.address().port; await new Promise(r => listener.close(r));
 const base = `http://127.0.0.1:${port}`;
 let child, browser;
 try {
  child = spawn(process.execPath, ['server.js'], { cwd: path.join(__dirname, '..'), env: { ...process.env, PORT: String(port), KAGOPITA_DATA_DIR: temporary, NODE_ENV: 'test' }, stdio: ['ignore', 'ignore', 'ignore'] });
  let ready = false;
  for (let i = 0; i < 100; i++) { try { if ((await fetch(base)).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 50)); }
  assert.ok(ready, 'Temporary Express server started');
  const response = await fetch(base + '/manifest.webmanifest');
  assert.ok(response.headers.get('content-type').includes('manifest+json'));
  const manifest = await response.json();
  assert.equal(manifest.name, 'Kagopita (カゴピタ)'); assert.equal(manifest.start_url, '/'); assert.equal(manifest.display, 'standalone'); assert.equal(manifest.scope, '/');
  for (const size of [192, 512]) {
   const icon = manifest.icons.find(i => i.sizes === `${size}x${size}`); assert.ok(icon);
   const png = Buffer.from(await (await fetch(base + icon.src)).arrayBuffer());
   assert.equal(png.subarray(1, 4).toString(), 'PNG'); assert.equal(png.readUInt32BE(16), size); assert.equal(png.readUInt32BE(20), size);
  }
  assert.equal((await fetch(base + '/sw.js')).headers.get('cache-control'), 'no-cache');
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const errors = [];
  async function pageFor(options = {}, setup) {
   const context = await browser.newContext(options);
   if (setup) await context.addInitScript(setup);
   const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
   await page.goto(base); await page.waitForFunction(() => typeof window.applyLanguage === 'function');
   return page;
  }
  const fakePrompt = async (page, outcome = 'dismissed', fail = false) => page.evaluate(({ outcome, fail }) => {
   const event = new Event('beforeinstallprompt', { cancelable: true });
   event.prompt = async () => { window.promptCalls = (window.promptCalls || 0) + 1; if (fail) throw Error('Prompt expired'); };
   event.userChoice = Promise.resolve({ outcome }); window.dispatchEvent(event);
   return event.defaultPrevented;
  }, { outcome, fail });
  const android = await pageFor(devices['Pixel 7']);
  assert.equal(await android.locator('#pwaInstallButton').isVisible(), false);
  assert.equal(await fakePrompt(android), true);
  await android.evaluate(() => applyLanguage('en'));
  assert.equal(await android.locator('#pwaInstallButton').innerText(), 'Install Kagopita');
  await android.locator('#pwaInstallButton').tap();
  await android.waitForFunction(() => document.querySelector('#pwaInstall').classList.contains('hidden'));
  assert.equal(await android.evaluate(() => window.promptCalls), 1);
  await fakePrompt(android, 'dismissed', true); await android.locator('#pwaInstallButton').tap();
  await android.waitForFunction(() => document.querySelector('#pwaInstall').classList.contains('hidden'));
  await fakePrompt(android, 'accepted'); await android.locator('#pwaInstallButton').tap();
  await android.waitForFunction(() => document.querySelector('#pwaInstall').classList.contains('hidden'));
  await fakePrompt(android); assert.equal(await android.locator('#pwaInstallButton').isVisible(), false);
  await android.context().close();
  const installed = await pageFor(devices['Pixel 7']);
  await fakePrompt(installed); await installed.evaluate(() => window.dispatchEvent(new Event('appinstalled')));
  assert.equal(await installed.locator('#pwaInstallButton').isVisible(), false); await installed.context().close();
  const iosOptions = [devices['iPhone 13'], { ...devices['iPad Pro 11'], userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15' }];
  for (const options of iosOptions) {
   const page = await pageFor(options, () => Object.defineProperty(navigator, 'maxTouchPoints', { value: 5 }));
   assert.equal(await page.locator('#pwaInstallButton').isVisible(), true, JSON.stringify(await page.evaluate(()=>({ua:navigator.userAgent,touch:navigator.maxTouchPoints,mode:matchMedia('(display-mode: standalone)').matches,html:document.querySelector('#pwaInstall').outerHTML})))+JSON.stringify(errors));
   assert.equal(await fakePrompt(page), false, 'No Android prompt handling on iOS');
   await page.locator('#pwaInstallButton').tap();
   assert.equal(await page.locator('#pwaInstallDialog li').count(), 5);
   assert.ok((await page.locator('#pwaInstallDescription').innerText()).includes('Safari'));
   assert.equal(await page.locator('#pwaInstallDialog img, #pwaInstallDialog svg, #pwaInstallDialog canvas').count(), 0);
   await page.evaluate(() => applyLanguage('en'));
   assert.equal(await page.locator('#pwaInstallDialog li').first().innerText(), 'Open kagopita.com in Safari.');
   assert.ok((await page.locator('#pwaInstallDescription').innerText()).includes('manually'));
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('#pwaInstallButton').evaluate(e => e === document.activeElement), true);
   await page.evaluate(() => applyLanguage('ja')); await page.locator('#pwaInstallButton').tap();
   assert.equal(await page.locator('#pwaInstallDialog li').first().innerText(), 'Safariでkagopita.comを開きます。');
   for (const width of [320, 390, 768]) {
    await page.setViewportSize({ width, height: 700 });
    const box = await page.locator('#pwaInstallDialog').boundingBox();
    assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= 0 && box.y + box.height <= 701);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
   }
   await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
   await page.screenshot({ path: '/tmp/kagopita-pwa-ios.png', animations: 'disabled' });
   await page.locator('#pwaInstallClose').tap(); assert.equal(await page.locator('#pwaInstallDialog').isVisible(), false);
   await page.context().close();
  }
  for (const options of [devices['Pixel 7'], devices['iPhone 13']]) {
   const page = await pageFor(options, () => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = query => query === '(display-mode: standalone)' ? { matches: true, addEventListener() {} } : original(query);
   });
   await fakePrompt(page); assert.equal(await page.locator('#pwaInstallButton').isVisible(), false); await page.context().close();
  }
  const safariStandalone = await pageFor(devices['iPhone 13'], () => Object.defineProperty(navigator, 'standalone', { value: true }));
  assert.equal(await safariStandalone.locator('#pwaInstallButton').isVisible(), false); await safariStandalone.context().close();
  const desktop = await pageFor(); await fakePrompt(desktop);
  assert.equal(await desktop.locator('#pwaInstallButton').isVisible(), false);
  await desktop.evaluate(async () => { await navigator.serviceWorker.ready; if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true })); });
  const client = await desktop.context().newCDPSession(desktop);
  const appManifest = await client.send('Page.getAppManifest'); assert.deepEqual(appManifest.errors, []);
  const auth = await fetch(base + '/api/account', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: 'Private PWA user', termsAccepted: true, termsVersion: require('../terms.json').version }) });
  assert.equal(auth.status, 201); const cookie = auth.headers.get('set-cookie').split(';')[0];
  await desktop.context().addCookies([{ name: 'kagopita_session', value: cookie.split('=')[1], url: base }]);
  const me = await desktop.evaluate(async () => (await fetch('/api/me')).json()); assert.equal(me.user.username, 'Private PWA user');
  await desktop.reload();
  const cached = await desktop.evaluate(async () => (await Promise.all((await caches.keys()).map(async key => (await (await caches.open(key)).keys()).map(r => new URL(r.url).pathname)))).flat().sort());
  assert.deepEqual(cached, ['/icons/pwa-192.png', '/icons/pwa-512.png', '/offline.html']);
  await desktop.context().setOffline(true);
  assert.equal(await desktop.evaluate(async () => { try { await fetch('/api/me'); return false; } catch { return true; } }), true, 'No offline cached private API response');
  await desktop.reload({ waitUntil: 'domcontentloaded' }); assert.ok((await desktop.locator('body').innerText()).includes("You're offline"));
  assert.equal((await desktop.locator('body').innerText()).includes('Private PWA user'), false);
  await desktop.context().setOffline(false); await desktop.goto(base); await desktop.locator('#pwaInstallButton').waitFor({ state: 'attached' });
  assert.deepEqual(errors, []);
  console.log('PASS: Android prompt eligibility/accept/decline/error; iOS and desktop-UA iPad instructions in JA/EN; keyboard close and mobile bounds; standalone/appinstalled hiding; desktop hidden; manifest/icons/worker; no cached private APIs or pages; offline recovery. Browser emulation only, not physical devices.');
 } finally {
  await browser?.close();
  if (child && child.exitCode === null) { const stopped = new Promise(r => child.once('exit', r)); child.kill(); await stopped; }
  fs.rmSync(temporary, { recursive: true, force: true });
 }
})().catch(error => { console.error(error); process.exit(1); });
