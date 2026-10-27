const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,colorScheme:'dark'});
  const page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let authenticated=false,expired=false,delayMe=true,releaseMe;
  const route=async r=>{
   const path=new URL(r.request().url()).pathname;
   if(path==='/api/events')return r.fulfill({contentType:'text/event-stream',body:': test\n\n'});
   if(path==='/api/me'&&delayMe)await new Promise(resolve=>releaseMe=resolve);
   if(!authenticated||expired)return r.fulfill({status:401,contentType:'application/json',body:'{"error":"Sign in again."}'});
   let data={};
   if(path==='/api/me')data={user:{id:'u',username:'Guest'},channels:[{id:'a',name:'Groceries',role:'admin'}]};
   else if(path.endsWith('/shopping-list'))data={total:0,completed:0,familyFeed:[],categories:[]};
   else if(path.endsWith('/members'))data={members:[]};
   else if(path.endsWith('/favorites'))data={favorites:[]};
   await r.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  };
  await context.route('**/api/**',route);
  await page.goto(process.env.KAGOPITA_TEST_URL||'http://127.0.0.1:3001',{waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>typeof openNavigationMenu==='function');
  assert.equal(await page.locator('#nav-menu').isVisible(),false,'No menu before auth is known');
  await page.evaluate(()=>openNavigationMenu());assert.equal(await page.locator('#navigationDialog').getAttribute('aria-hidden'),'true');
  await page.waitForFunction(()=>document.querySelector('[data-theme-toggle]'));
  delayMe=false;releaseMe();await page.locator('#welcomeAccountForm').waitFor();
  const toggle=page.locator('[data-theme-toggle]');
  assert.equal(await toggle.getAttribute('role'),'switch');assert.equal(await toggle.getAttribute('aria-checked'),'true','Default follows system dark');
  assert.equal(await toggle.evaluate(e=>e.closest('.header-actions')!==null),true);
  for(const lang of ['ja','en','ko','zh','es'])for(const width of [320,390,768]){
   await page.setViewportSize({width,height:844});await page.evaluate(lang=>applyLanguage(lang),lang);
   assert.equal(await page.locator('#nav-menu').isVisible(),false);
   const r=await toggle.boundingBox();assert.ok(r.width>=44&&r.height>=44&&r.x>=0&&r.x+r.width<=width);
   await toggle.tap();assert.equal(await toggle.getAttribute('aria-checked'),'false');
   await toggle.tap();assert.equal(await toggle.getAttribute('aria-checked'),'true');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
   if(lang==='en')assert.equal(await toggle.getAttribute('aria-label'),'Dark mode');
  }
  await toggle.focus();await page.keyboard.press('Space');assert.equal(await toggle.getAttribute('aria-checked'),'false');
  await page.reload({waitUntil:'networkidle'});assert.equal(await toggle.getAttribute('aria-checked'),'false','Theme survives reload');
  await page.emulateMedia({colorScheme:'dark'});assert.equal(await toggle.getAttribute('aria-checked'),'false','Explicit selection overrides system');
  authenticated=true;await page.reload({waitUntil:'networkidle'});await page.locator('#nav-menu').waitFor();
  for(const width of [320,390,768]){
   await page.setViewportSize({width,height:844});
   for(const dark of [false,true]){
    if((await toggle.getAttribute('aria-checked'))!==String(dark))await toggle.tap();
    const boxes=await page.locator('.header > .brand, #nav-menu, .header-actions').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.ok(boxes[i].right<=boxes[j].left||boxes[j].right<=boxes[i].left,'Header controls must not overlap');
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
   }
  }
  await page.setViewportSize({width:390,height:844});
  for(const dark of [false,true]){
   if((await toggle.getAttribute('aria-checked'))!==String(dark))await toggle.tap();
   await page.screenshot({path:`/tmp/kagopita-theme-${dark?'dark':'light'}.png`,animations:'disabled'});
  }
  await page.emulateMedia({reducedMotion:'reduce'});assert.equal(await page.locator('.theme-toggle-thumb').evaluate(e=>getComputedStyle(e).transitionDuration),'0s');
  const second=await context.newPage();await second.goto(page.url(),{waitUntil:'networkidle'});
  await toggle.tap();await second.waitForFunction(()=>document.documentElement.classList.contains('dark-mode')===false);
  await page.locator('#nav-menu').tap();await page.waitForFunction(()=>document.querySelector('#navigationDialog').classList.contains('is-open'));
  expired=true;
  await page.evaluate(async()=>{try{await api('/api/me')}catch{}});
  assert.equal(await page.locator('#nav-menu').isVisible(),false);assert.equal(await page.locator('#navigationDialog').getAttribute('aria-hidden'),'true');
  await page.locator('#welcomeLoginForm').waitFor();assert.equal(await page.locator('.bottom-nav').isVisible(),false);
  await page.evaluate(()=>openNavigationMenu());assert.equal(await page.locator('#navigationDialog').getAttribute('aria-hidden'),'true');
  assert.deepEqual(errors,[]);
  console.log('PASS: signed-out/loading/expired-session navigation guards; authenticated guests retain menu; theme touch and keyboard, five-language labels, persistence, system preference, cross-tab sync, reduced motion; header fits 320/390/768px in both themes');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
