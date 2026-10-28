const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const terms = require('../terms.json');
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let writes = 0, release, completed = false, holdReads = false;
    const pendingReads = [];
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/events') return route.fulfill({ contentType: 'text/event-stream', body: ': test\n\n' });
      let data = {};
      if (path === '/api/terms') data = { ...terms, notify: false };
      if (path === '/api/me') data = { user: { id: 'u', username: 'Test' }, channels: [{ id: 'a', name: 'Groceries', role: 'owner' }] };
      if (path.endsWith('/shopping-list')) data = { total: 1, completed: Number(completed), familyFeed: [], categories: [{ name: '野菜・果物', items: [{ id: 1, name: 'トマト', qty: '2個', addedBy: 'Test', completed, category: '野菜・果物' }] }] };
      if (path.endsWith('/members')) data = { members: [{ id: 'u', username: 'Test', role: 'owner' }] };
      if (path.endsWith('/favorites')) data = { favorites: [] };
      if (path.endsWith('/toggle')) {
        writes++;
        await new Promise(resolve => { release = resolve; });
        completed = !completed;
      }
      if (holdReads && (path.endsWith('/shopping-list') || path.endsWith('/members'))) await new Promise(resolve => pendingReads.push(resolve));
      try { await route.fulfill({ json: data }); } catch { /* Expected aborted request. */ }
    });
    await page.goto(process.env.KAGOPITA_TEST_URL || 'http://127.0.0.1:3001', { waitUntil: 'networkidle' });
    await page.locator('.shopping-item').waitFor();
    await page.evaluate(() => { localStorage.setItem('kagopita-language', 'en'); applyLanguage('en'); KagopitaLiveUpdates.stop(); });
    const check = page.locator('.check-button');
    const box = await check.boundingBox();
    await check.click();
    await page.locator('#actionLoadingDialog').waitFor();
    assert.equal(await page.locator('.check-button').getAttribute('aria-busy'), 'true');
    assert.match(await page.locator('#actionLoadingDialog').innerText(), /Working/);
    for (let i = 0; i < 8; i++) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.keyboard.press('Escape');
    await page.keyboard.press('Enter');
    await page.evaluate(() => {
      document.querySelector('.check-button').click();
      document.querySelector('#addForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      document.querySelector('#nav-add').click();
    });
    assert.equal(writes, 1, 'Mouse, keyboard, programmatic click and submit cannot duplicate actions');
    assert.equal(await page.locator('#view-list').isVisible(), true, 'Navigation is locked');
    assert.equal(await page.locator('#actionLoadingDialog').isVisible(), true, 'Escape cannot dismiss lock');
    await page.screenshot({ path: '/tmp/kagopita-loading-light.png' });
    await page.evaluate(() => document.documentElement.classList.add('dark-mode'));
    await page.screenshot({ path: '/tmp/kagopita-loading-dark.png' });
    release();
    await page.waitForFunction(() => !KagopitaActions.busy);
    assert.equal(await page.locator('.check-button').getAttribute('aria-busy'), null);
    assert.equal(await page.locator('.check-button.checked').count(), 1);
    holdReads = true;
    await page.locator('#nav-list').click();
    assert.equal(await page.evaluate(() => KagopitaActions.busy), false, 'List navigation has no loading lock');
    await page.locator('#shortcut-right').click();
    await page.locator('#view-members').waitFor();
    assert.equal(await page.evaluate(() => KagopitaActions.busy), false, 'Members navigation has no loading lock');
    assert.equal(await page.locator('#actionLoadingDialog').isVisible(), false);
    await page.locator('#nav-menu').click();
    await page.locator('#navigationDialog').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    holdReads = false;
    pendingReads.splice(0).forEach(resolve => resolve());
    await page.locator('#nav-add').click();
    await page.locator('#view-add').waitFor();
    await page.waitForFunction(() => !KagopitaActions.busy);
    await page.locator('#inputName').fill('Draft kept after timeout');

    // Exercise the actual 30-second wall-clock deadline, including abort delivery.
    const started = Date.now();
    await page.evaluate(() => {
      window.loadingResult = null;
      window.loadingAborted = false;
      KagopitaActions.request(signal => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => { window.loadingAborted = true; reject(signal.reason); });
      }), { foreground: true }).catch(error => { window.loadingResult = { name: error.name, message: error.message }; });
    });
    await page.waitForFunction(() => window.loadingResult, null, { timeout: 40000 });
    assert.ok(Date.now() - started >= 29500, 'Deadline does not fire early');
    assert.equal(await page.evaluate(() => loadingAborted), true);
    assert.equal(await page.evaluate(() => loadingResult.name), 'TimeoutError');
    await page.waitForFunction(() => !KagopitaActions.busy);
    await page.locator('#actionRequestError').waitFor();
    assert.match(await page.locator('#actionRequestError').innerText(), /30 seconds/);
    assert.equal(await page.locator('#inputName').inputValue(), 'Draft kept after timeout');
    await page.locator('#nav-list').click();
    await page.locator('#view-list').waitFor();
    await page.waitForFunction(() => !KagopitaActions.busy);

    // Virtual time covers slow response bodies, background timeouts and total
    // deadlines across chained calls without adding several minutes to the suite.
    await page.clock.install();
    await page.evaluate(() => {
      window.bodyResult = null;
      window.bodyRelease = null;
      const original = window.fetch;
      window.fetch = (url, options) => url === '/test-hanging-body'
        ? Promise.resolve({ ok: true, json: () => new Promise(resolve => { window.bodyRelease = resolve; }) }) : original(url, options);
      api('/test-hanging-body').catch(error => { window.bodyResult = error.name; });
    });
    assert.equal(await page.evaluate(() => KagopitaActions.busy), false, 'Background requests never lock the UI');
    await page.clock.fastForward(30001);
    await page.waitForFunction(() => bodyResult === 'TimeoutError');
    await page.evaluate(() => bodyRelease({ late: true }));
    assert.equal(await page.evaluate(() => bodyResult), 'TimeoutError', 'A late response cannot complete a canceled request');
    await page.evaluate(() => {
      window.chainResult = null;
      window.chainSignal = null;
      window.chainRelease = null;
      KagopitaActions.request(() => new Promise(resolve => { window.chainRelease = resolve; }), { foreground: true })
        .then(() => KagopitaActions.request(signal => { window.chainSignal = signal; return new Promise(() => {}); }, { foreground: true }))
        .catch(error => { window.chainResult = error.name; });
    });
    await page.clock.fastForward(20000);
    await page.evaluate(() => chainRelease());
    await page.waitForFunction(() => chainSignal !== null);
    await page.clock.fastForward(10001);
    await page.waitForFunction(() => chainResult === 'TimeoutError');
    assert.equal(await page.evaluate(() => chainSignal.aborted), true, 'Chained calls share the original deadline');
    await page.clock.fastForward(10);
    assert.equal(await page.evaluate(() => KagopitaActions.busy), false);
    assert.deepEqual(errors, []);
    console.log('PASS: loading spinner, global mouse/keyboard/submit lock, single mutation, List/Members navigation without loading or lock, state/focus cleanup, real 30s abort/error and retry, draft preservation, hanging JSON deadline, background non-blocking timeout, chained total deadline.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
