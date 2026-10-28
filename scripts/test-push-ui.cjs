const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { chromium, devices } = require('playwright');
const terms = require('../terms.json');
(async () => {
  // Execute the actual worker handlers without contacting external push services.
  const handlers = {}, displayed = [], opened = [];
  const worker = { registration: { showNotification: async (title, options) => displayed.push({title,...options}) },
    location: { origin:'https://kagopita.com' }, clients: { matchAll:async()=>[], openWindow:async url=>opened.push(url) },
    addEventListener:(name, fn)=>handlers[name]=fn };
  vm.runInNewContext(fs.readFileSync(require.resolve('../public/sw.js'),'utf8'), {self:worker, URL, console});
  let finished; handlers.push({data:{json:()=>({title:'Item added',body:'Alex added: tomato (10 pieces)',tag:'one'})},waitUntil:promise=>finished=promise}); await finished;
  assert.equal(displayed[0].body,'Alex added: tomato (10 pieces)'); assert.equal(displayed[0].title,'Item added'); assert.equal(displayed[0].tag,'one');
  handlers.push({data:{json:()=>{throw Error('bad json')}},waitUntil:promise=>finished=promise}); await finished;
  assert.ok(displayed[1].body.includes('共有リスト'));
  handlers.notificationclick({notification:{close(){},data:{url:'https://attacker.test'}},waitUntil:promise=>finished=promise});await finished;
  assert.equal(opened[0],'https://kagopita.com/?notifications=1');
  const existing = { url:'https://kagopita.com/', focus:async()=>{}, postMessage:message=>opened.push(message.type) };
  worker.clients.matchAll=async()=>[existing];
  handlers.notificationclick({notification:{close(){}},waitUntil:promise=>finished=promise});await finished;
  assert.equal(opened[1],'kagopita:open-notifications');
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    let screens=0;
    for(const mode of ['android-browser','desktop-browser','ios-browser','android','ios-installed','desktop-installed','blocked','declined','unsupported','insecure']) {
      const context=await browser.newContext(mode.startsWith('desktop') ? {} : {...devices[mode.startsWith('ios') ? 'iPhone 13':'Pixel 7']});
      await context.addInitScript(mode=>{
        let subscription=null;
        const installed=!mode.endsWith('-browser');
        const originalMatchMedia=window.matchMedia.bind(window);
        window.matchMedia=query=>query==='(display-mode: standalone)' ? Object.assign(new EventTarget(), {matches:installed && mode!=='ios-installed',media:query}) : originalMatchMedia(query);
        const endpoint='https://fcm.googleapis.com/fcm/send/ui-fixture';
        const registration={pushManager:{
          getSubscription:async()=>subscription,
          subscribe:async()=>{
            window.pushSubscribes=(window.pushSubscribes||0)+1;
            subscription={endpoint,toJSON:()=>({endpoint,keys:{p256dh:'fixture',auth:'fixture'}}),
              unsubscribe:async()=>{subscription=null;return true}};
            return subscription;
          }
        },getNotifications:async()=>[]};
        const sw=new EventTarget(); sw.register=async()=>registration; sw.ready=Promise.resolve(registration); sw.getRegistration=async()=>registration;
        Object.defineProperty(navigator,'serviceWorker',{value:sw,configurable:true});
        Object.defineProperty(navigator,'standalone',{value:mode==='ios-installed',configurable:true});
        Object.defineProperty(window,'PushManager',{value:function(){},configurable:true});
        if(mode==='unsupported') delete window.PushManager;
        if(mode==='insecure') Object.defineProperty(window,'isSecureContext',{value:false});
        let permission=mode==='blocked'?'denied':'default';
        window.fixturePermission=value=>{permission=value;window.fixtureAllow=true;};
        Object.defineProperty(window,'Notification',{value:{ get permission(){return permission;},
          requestPermission:()=>{window.permissionRequests=(window.permissionRequests||0)+1; window.permissionHadGesture=navigator.userActivation.isActive;permission=mode==='declined' && !window.fixtureAllow ? 'denied' : 'granted';return Promise.resolve(permission);}
        },configurable:true});
      },mode);
      const page=await context.newPage(); const errors=[]; let enabled=false, tests=0, deviceLanguage=null, pushRequests=0;
      page.on('pageerror',error=>errors.push(error.message));
      await page.route('https://pagead2.googlesyndication.com/**',route=>route.fulfill({contentType:'text/javascript',body:''}));
      await page.route('**/api/**',async route=>{
        const url=new URL(route.request().url()).pathname; let data={};
        if(url.startsWith('/api/push/')) pushRequests++;
        if(url==='/api/events') return route.fulfill({contentType:'text/event-stream',body:': fixture\n\n'});
        if(url==='/api/terms') data={...terms,notify:false};
        if(url==='/api/me') data={user:{id:'u',username:'Test'},channels:[{id:'a',name:'買い物',role:'owner'}]};
        if(url.endsWith('/shopping-list')) data={total:0,completed:0,familyFeed:[],categories:[]};
        if(url.endsWith('/notifications')) data={notifications:[],unreadCount:0,total:0,page:1,totalPages:1,latestId:0};
        if(url==='/api/push/config') data={publicKey:'B'+ 'a'.repeat(86)};
        if(url==='/api/push/status') {data={enabled};if(enabled) deviceLanguage=route.request().postDataJSON().language;}
        if(url==='/api/push/subscriptions') {enabled=route.request().method()!=='DELETE';data={enabled};if(enabled) deviceLanguage=route.request().postDataJSON().language;}
        if(url==='/api/push/test') {tests++;data={queued:true};}
        return route.fulfill({json:data});
      });
      await page.goto(process.env.KAGOPITA_TEST_URL || 'http://127.0.0.1:3001',{waitUntil:'networkidle'});
      await page.evaluate(()=>switchTab('account'));
      if(mode.endsWith('-browser')) {
        assert.equal(await page.locator('#pushSettings').isVisible(),false,mode+' hides account push settings');
        await page.locator('#nav-menu').click();
        assert.equal(await page.locator('#pushMenuButton').isVisible(),false,mode+' hides menu push settings');
        await page.evaluate(()=>{
          document.getElementById('pushToggle').dispatchEvent(new Event('click'));
          document.getElementById('pushOfferEnable').dispatchEvent(new Event('click'));
          window.dispatchEvent(new Event('focus'));
          document.dispatchEvent(new Event('kagopita:idle'));
        });
        await page.waitForTimeout(1200);
        assert.equal(await page.locator('#pushPermissionDialog').isVisible(),false,mode+' never offers push');
        assert.equal(await page.evaluate(()=>window.permissionRequests||0),0,mode+' never requests permission');
        assert.equal(pushRequests,0,mode+' never accesses push API');
        assert.deepEqual(errors,[],mode+' JavaScript errors');
        await context.close();
        continue;
      }
      await page.locator('#pushSettings').waitFor({state:'visible'});
      assert.equal(await page.evaluate(()=>window.permissionRequests||0),0,'No automatic permission prompt');
      if(['android','ios-installed','desktop-installed'].includes(mode)) {
        await page.locator('#pushToggle').waitFor({state:'visible'});
        await page.waitForFunction(()=>!document.getElementById('pushToggle').disabled);
        await page.locator('#pushPermissionDialog').waitFor({state:'visible'});
        assert.equal(await page.evaluate(()=>window.permissionRequests||0),0,'Pre-prompt does not request native permission');
        if(mode==='android') {
          await page.locator('#pushOfferLater').click();
          await page.reload({waitUntil:'networkidle'});
          await page.waitForTimeout(1100);
          assert.equal(await page.locator('#pushPermissionDialog').isVisible(),false,'Later choice persists');
          await page.locator('#nav-menu').click();
          await page.locator('#pushMenuButton').click();
          await page.locator('#pushToggle').click();
        } else await page.locator('#pushOfferEnable').click();
        await page.waitForFunction(()=>document.getElementById('pushToggle').getAttribute('aria-pressed')==='true');
        assert.equal(await page.evaluate(()=>window.permissionRequests),1);
        assert.equal(await page.evaluate(()=>window.permissionHadGesture),true,'Permission requested directly from tap');
        await page.locator('#pushTest').click();assert.equal(tests,1);
        for(const dark of [false,true]) for(const width of [320,390,768,1280]) {
          await page.setViewportSize({width,height:844});
          await page.evaluate(dark=>{document.documentElement.classList.toggle('dark-mode',dark);document.body.classList.toggle('dark-mode',dark);},dark);
          for(const lang of ['ja','en','ko','zh','es']) {
            await page.evaluate(lang=>{localStorage.setItem('kagopita-language',lang);applyLanguage(lang);},lang);
            assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),mode+' layout overflow');screens++;
          }
        }
        for(let i=0;i<50 && deviceLanguage!=='es';i++) await page.waitForTimeout(50);
        assert.equal(deviceLanguage,'es','Language selection synchronizes existing subscribed device');
        await page.locator('#pushToggle').click();
        await page.waitForFunction(()=>document.getElementById('pushToggle').getAttribute('aria-pressed')==='false');
        assert.equal(enabled,false);
        assert.equal(await page.locator('#pushTest').isVisible(),false);
      } else {
        if(mode==='declined') {
          await page.locator('#pushPermissionDialog').waitFor({state:'visible'});
          await page.locator('#pushOfferEnable').click();
          await page.waitForFunction(()=>Notification.permission==='denied');
        }
        assert.equal(await page.locator('#pushToggle').isDisabled(),true);
        const status=await page.locator('#pushStatus').textContent();
        assert.ok(status.length>10);
        await page.locator('#nav-menu').click();
        await page.locator('#pushMenuButton').click();
        await page.locator('#pushSettings').waitFor({state:'visible'});
        assert.equal(await page.locator('#pushPermissionDialog').isVisible(),false);
        if(['blocked','declined'].includes(mode)) {
          assert.equal(await page.locator('#pushPermissionHelp').isVisible(),true,'Blocked permission has recovery instructions');
          await page.evaluate(()=>window.fixturePermission('default'));
          await page.locator('#pushRecheck').click();
          await page.waitForFunction(()=>!document.getElementById('pushToggle').disabled);
          await page.locator('#pushToggle').click();
          await page.waitForFunction(()=>document.getElementById('pushToggle').getAttribute('aria-pressed')==='true');
        }
      }
      assert.deepEqual(errors,[],mode+' JavaScript errors');
      await context.close();
    }
    console.log('PASS: actual service-worker display, malformed payload and safe click handlers; Installed Android/iOS/desktop opt-in/off/test and permission user gesture; browser push controls, prompts and API calls absent; blocked/unsupported/insecure states; '+screens+' responsive theme/language layouts. Includes consent, remembered decline and hamburger-menu permission recovery. Push/browser APIs mocked; physical delivery not verified.');
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
