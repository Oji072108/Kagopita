const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright');
const terms = require('../terms.json');

// Exercise real shared screens, long content and translated mobile layouts.
(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage({ ...devices['iPhone 13'], reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**', async route => {
      const path = new URL(route.request().url()).pathname;
      if (path === '/api/events') return route.fulfill({ contentType: 'text/event-stream', body: ': fixture\n\n' });
      let data = {};
      if (path === '/api/terms') data = { ...terms, notify: false };
      if (path === '/api/me') data = { user: { id: 'u', username: 'Test' }, channels: [{ id: 'a', name: '週末の買い物・みんなで使う共有リスト', role: 'owner' }] };
      if (path.endsWith('/shopping-list')) data = { total: 1, completed: 0, familyFeed: [], categories: [{ name: '野菜・果物', items: [{ id: 1, name: 'トマト', qty: '2個', addedBy: 'Test', completed: false, category: '野菜・果物' }] }] };
      if (path.endsWith('/members')) data = { members: [{ id: 'u', username: 'Test', role: 'owner' }] };
      if (path.endsWith('/favorites')) data = { favorites: [] };
      return route.fulfill({ json: data });
    });
    await page.goto(process.env.KAGOPITA_TEST_URL || 'http://127.0.0.1:3001', { waitUntil: 'networkidle' });
    await page.locator('.shopping-item').waitFor();
    let layouts = 0;
    for (const dark of [false, true]) {
      await page.evaluate(dark => {
        document.documentElement.classList.toggle('dark-mode', dark);
        document.body.classList.toggle('dark-mode', dark);
      }, dark);
      for (const language of ['ja', 'en', 'ko', 'zh', 'es']) {
        await page.evaluate(language => { localStorage.setItem('kagopita-language', language); applyLanguage(language); }, language);
        for (const width of [320, 390, 768, 1280]) {
          await page.setViewportSize({ width, height: 844 });
          for (const tab of ['list', 'add', 'channels', 'members', 'complete', 'account']) {
            await page.evaluate(tab => switchTab(tab), tab);
            await page.locator(`#view-${tab}`).waitFor();
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Overflow: ${dark}/${language}/${width}/${tab}`);
            if (language === 'en' && width === 390) await page.screenshot({ path: `/tmp/kagopita-polish-${tab}-${dark ? 'dark' : 'light'}.png` });
            layouts++;
          }
          await page.locator('#nav-menu').click();
          await page.locator('#pwaInstallButton').waitFor({ state: 'visible' });
          await page.locator('#pwaInstallButton').scrollIntoViewIfNeeded();
          const box = await page.locator('#pwaInstallButton').boundingBox();
          assert.ok(box.x >= 0 && box.x + box.width <= width && box.height >= 44, 'Install menu entry stays touch-friendly');
          if (language === 'en' && width === 390) await page.screenshot({ path: `/tmp/kagopita-polish-menu-${dark ? 'dark' : 'light'}.png` });
          await page.locator('#pwaInstallButton').click();
          await page.keyboard.press('Tab');
          assert.notEqual(await page.locator('#pwaInstallClose').evaluate(e => getComputedStyle(e).outlineStyle), 'none');
          await page.evaluate(() => document.querySelector('#nav-menu').focus());
          assert.ok(await page.evaluate(() => document.querySelector('#pwaInstallDialog').contains(document.activeElement)), 'Background controls cannot steal modal focus');
          await page.keyboard.press('Escape');
          await page.waitForFunction(() => document.activeElement.id === 'pwaInstallButton');
          await page.keyboard.press('Escape');
          await page.waitForFunction(() => document.activeElement.id === 'nav-menu');
        }
      }
    }
    assert.deepEqual(errors, []);
    console.log(`PASS: ${layouts} screen/theme/language/viewport combinations; menu installation entry, modal focus containment and Escape return; no horizontal overflow or JS errors. Emulated browser only.`);
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
