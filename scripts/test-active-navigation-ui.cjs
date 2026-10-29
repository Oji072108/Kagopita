const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const terms = require('../terms.json');
(async () => {
  const browser = await chromium.launch({headless:true, args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    // Keep the fixture stream connected; a finite route response would repeatedly
    // reconnect and legitimately trigger catch-up reads during the spam check.
    await page.addInitScript(() => {
      window.EventSource = class extends EventTarget {
        close() {}
      };
    });
    const errors = [], requests = [];
    let role = 'owner';
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/api/**', async route => {
      const p = new URL(route.request().url()).pathname;
      requests.push(p);
      let data = {};
      if (p === '/api/events') return route.fulfill({contentType:'text/event-stream',body:': fixture\n\n'});
      if (p === '/api/terms') data = {...terms,notify:false};
      if (p === '/api/notifications') data = {notifications:[],unreadCount:0,totalPages:1};
      if (p === '/api/me') data = {user:{id:'u',username:'Test'},channels:[{id:'a',name:'Groceries',role}]};
      if (p.endsWith('/shopping-list')) data = {total:0,completed:0,familyFeed:[],categories:[]};
      if (p.endsWith('/members')) data = {members:[]};
      if (p.endsWith('/favorites')) data = {favorites:[]};
      await route.fulfill({json:data});
    });
    await page.goto(process.env.KAGOPITA_TEST_URL || 'http://127.0.0.1:3001');
    await page.waitForFunction(() => currentChannelId && !KagopitaActions.busy);
    for (const width of [320,390,768]) for (const dark of [false,true]) {
      await page.setViewportSize({width,height:844});
      await page.evaluate(dark => document.documentElement.classList.toggle('dark-mode',dark), dark);
      for (const [tab, id] of [['channels','shortcut-left'],['members','shortcut-right'],['account','nav-account'],['list','nav-list'],['add','nav-add']]) {
        await page.locator('#'+id).tap();
        await page.locator('#view-'+tab).waitFor({state:'visible'});
        await page.waitForFunction(() => !KagopitaActions.busy);
        const button = page.locator('#'+id);
        assert.equal(await button.isDisabled(),true,tab+' is disabled');
        assert.equal(await button.getAttribute('aria-current'),'page');
        assert.equal(await button.evaluate(e => getComputedStyle(e).opacity),'1','Active highlight remains visible');
        // EventSource may reconnect independently of navigation.
        const navigationReads = () => requests.filter(p => /\/(shopping-list|members|favorites|me)$/.test(p)).length;
        const before = navigationReads();
        const box = await button.boundingBox();
        for (let i=0;i<6;i++) await page.touchscreen.tap(box.x+box.width/2,box.y+box.height/2);
        await button.evaluate(e => {document.activeElement?.blur();e.click();e.focus();});
        await page.keyboard.press('Enter'); await page.keyboard.press('Space');
        assert.equal(navigationReads(),before,'Selected destination triggers no navigation reads');
        await page.evaluate(() => refreshChannels());
        assert.equal(await button.isDisabled(),true,'Refresh retains lock');
        const menu = page.locator('[data-menu-tab="'+tab+'"]');
        assert.equal(await menu.isDisabled(),true,'Menu destination also disabled');
        assert.equal(await page.locator('#nav-account').isDisabled(),tab==='account');
      }
    }
    await page.evaluate(() => {
      localStorage.setItem('kagopita-shortcuts',JSON.stringify(['account','members']));
      renderNavigationShortcuts();
    });
    await page.locator('#nav-account').tap();
    assert.equal(await page.locator('#shortcut-left').isDisabled(),true,'Duplicate shortcut is disabled');
    await page.locator('#nav-list').tap();
    assert.equal(await page.locator('#nav-account').isEnabled(),true,'Previous tab re-enabled');
    role = 'member'; await page.evaluate(() => refreshChannels());
    assert.equal(await page.locator('#nav-add').isDisabled(),true,'Read-only permission preserved');
    assert.deepEqual(errors,[]);
    console.log('PASS: active tabs reject repeated taps/keyboard/programmatic clicks; refresh, duplicate shortcuts, re-enabling and permissions; 3 widths, both themes.');
  } finally {await browser.close();}
})().catch(error => {console.error(error);process.exitCode=1;});
