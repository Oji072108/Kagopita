const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const original=require('../terms.json');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let terms=structuredClone(original), signedIn=false, seen=terms.version, payload=null, upgradePayload=null, guestPayload=null, joinPayload=null, account=false;
  await page.route('**/api/**',async r=>{
   const pathname=new URL(r.request().url()).pathname;
   if(pathname==='/api/terms')return r.fulfill({json:{...terms,notify:signedIn&&seen!==terms.version}});
   if(pathname==='/api/terms/seen'){seen=r.request().postDataJSON().version;return r.fulfill({json:{ok:true}});}
   if(pathname==='/api/register'){payload=r.request().postDataJSON();return r.fulfill({status:201,json:{email:payload.email,pendingVerification:true}});}
   if(pathname==='/api/account/credentials'){upgradePayload=r.request().postDataJSON();return r.fulfill({json:{email:upgradePayload.email,emailVerified:false}});}
   if(pathname==='/api/account'){guestPayload=r.request().postDataJSON();return r.fulfill({status:400,json:{error:'Test request captured'}});}
   if(pathname==='/api/session'){joinPayload=r.request().postDataJSON();return r.fulfill({status:400,json:{error:'Test request captured'}});}
   if(!signedIn)return r.fulfill({status:401,json:{error:'Sign in again.'}});
   let data={};
   if(pathname==='/api/me')data={user:{id:'u',username:'Test',email:account?'test@example.invalid':null,emailVerified:account},channels:[{id:'a',name:'Groceries',role:'owner'}]};
   if(pathname.endsWith('/shopping-list'))data={total:0,completed:0,familyFeed:[],categories:[]};
   if(pathname.endsWith('/members'))data={members:[]};
   if(pathname.endsWith('/favorites'))data={favorites:[]};
   if(pathname==='/api/events')return r.fulfill({contentType:'text/event-stream',body:': test\n\n'});
   return r.fulfill({json:data});
  });
  await page.goto(process.env.KAGOPITA_TEST_URL||'http://127.0.0.1:3001',{waitUntil:'networkidle'});
  await page.locator('#welcomeAccountForm').waitFor();
  assert.equal(await page.locator('#welcomeAccountForm [type="submit"]').isDisabled(),true);
  assert.equal(await page.locator('#welcomeAccountForm .terms-consent').count(),1);
  for(const [mode,form] of [['guest','welcomeAccountForm'],['join','welcomeJoinForm']]){
   if (await page.locator(`[data-welcome-mode="${mode}"]`).isEnabled()) await page.locator(`[data-welcome-mode="${mode}"]`).tap();
   assert.equal(await page.locator(`[data-welcome-mode="${mode}"]`).isDisabled(),true,'The selected tab cannot be pressed again');
   assert.equal(await page.locator('[data-welcome-mode]:enabled').count(),2,'Other tabs remain available');
   await page.evaluate(() => { const original=window.showWelcomeMode;window.repeatedTabCalls=0;window.showWelcomeMode=mode=>{window.repeatedTabCalls++;return original(mode);}; });
   await page.locator(`[data-welcome-mode="${mode}"]`).evaluate(e=>{e.click();e.dispatchEvent(new MouseEvent('click',{bubbles:true}));});
   assert.equal(await page.evaluate(()=>window.repeatedTabCalls),0,'Repeated selected-tab taps do not rerun the form transition');
   const button=page.locator(`#${form} [type="submit"]`);assert.equal(await button.isDisabled(),true);
   await page.locator('#'+form).evaluate(e=>e.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   assert.equal(mode==='guest'?guestPayload:joinPayload,null,'Cannot bypass consent by submitting the form');
   await page.locator(`[data-terms-consent="${mode}"] .terms-open`).tap();await page.locator('#termsDialog').waitFor();
   await page.locator('#termsDocument').evaluate(e=>e.scrollTo(0,e.scrollHeight));await page.locator('#termsReadDone').click();
   assert.equal(await button.isDisabled(),true,'Reading alone is not consent');
   await page.locator(`#${mode}TermsAccepted`).check();
   if(mode==='guest')await page.locator('#welcomeAccountName').fill('Guest');
   else {await page.locator('#welcomeJoinName').fill('Invited guest');await page.locator('#welcomeInviteCode').fill('TESTCODE');}
   await button.tap();await page.locator(mode==='guest'?'#welcomeAccountMessage':'#welcomeJoinMessage').filter({hasText:'Test request captured'}).waitFor();
   const captured=mode==='guest'?guestPayload:joinPayload;assert.equal(captured.termsAccepted,true);assert.equal(captured.termsVersion,terms.version);
  }
  const boxes=await page.locator('[data-welcome-mode]').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
  assert.equal(boxes[0].y,boxes[1].y);assert.equal(boxes[1].y,boxes[2].y,'Compact tabs, not stacked cards');
  await page.locator('[data-welcome-mode="account"]').tap();
  const submit=page.locator('#welcomeRegisterForm [type="submit"]'),checkbox=page.locator('#registerTermsAccepted');
  assert.equal(await submit.isDisabled(),true);assert.equal(await checkbox.isDisabled(),true);
  const open=()=>page.locator('[data-terms-consent="register"] .terms-open').tap();
  await open();await page.locator('#termsDialog').waitFor();
  assert.equal(await page.locator('#termsReadDone').isDisabled(),true);
  await page.keyboard.press('Escape');assert.equal(await checkbox.isDisabled(),true);
  for(const language of ['ja','en','ko','zh','es']){
   await page.evaluate(lang=>applyLanguage(lang),language);
   await open();await page.locator('#termsDialog').waitFor();
   const content=language==='ja'?terms:terms.translations[language];
   assert.equal(await page.locator('#termsTitle').innerText(),content.title);
   assert.deepEqual(await page.locator('#termsDocument h3').allTextContents(),content.sections.map(s=>s.heading));
   assert.deepEqual(await page.locator('#termsDocument p').allTextContents(),content.sections.map(s=>s.body));
   assert.equal(await page.locator('#termsVersion').count(),0);
   assert.equal(await page.locator('#termsDialog').innerText().then(t=>t.includes(terms.version)),false);
   assert.equal(await page.locator('#termsReadDone').isDisabled(),true);
   await page.locator('#termsDocument').evaluate(e=>e.scrollTo(0,e.scrollHeight));await page.waitForFunction(()=>!document.querySelector('#termsReadDone').disabled);
   if(language==='en')await page.screenshot({path:'/tmp/kagopita-terms-english.png',animations:'disabled'});
   // Switching language while open rebuilds the document and starts at the top.
   const next=language==='ja'?'en':'ja';await page.evaluate(lang=>applyLanguage(lang),next);
   const nextContent=next==='ja'?terms:terms.translations[next];
   await page.waitForFunction(title=>document.querySelector('#termsTitle').textContent===title,nextContent.title);
   assert.equal(await page.locator('#termsDocument').evaluate(e=>e.scrollTop),0);assert.equal(await page.locator('#termsReadDone').isDisabled(),true);
   await page.locator('#termsClose').tap();
  }
  await page.evaluate(()=>applyLanguage('ja'));
  for(const width of [320,390,768])for(const dark of [false,true]){
   await page.setViewportSize({width,height:844});const toggle=page.locator('[data-theme-toggle]');
   if(await toggle.getAttribute('aria-checked')!==String(dark))await toggle.tap();
   await open();await page.locator('#termsDialog').waitFor();
   assert.equal(await page.locator('#termsReadDone').isDisabled(),true,'Every opening starts at the beginning');
   assert.equal(await page.locator('#termsDocument').evaluate(e=>e.scrollTop),0);
   const box=await page.locator('#termsDialog').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=width&&box.y>=0&&box.y+box.height<=844);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   if(width===390)await page.screenshot({path:`/tmp/kagopita-terms-${dark?'dark':'light'}.png`,animations:'disabled'});
   await page.locator('#termsDocument').evaluate(e=>e.scrollTo(0,e.scrollHeight));
   await page.waitForFunction(()=>!document.querySelector('#termsReadDone').disabled);
   await page.locator('#termsReadDone').tap();assert.equal(await checkbox.isChecked(),false,'Reading is not acceptance');
   await checkbox.check();assert.equal(await submit.isEnabled(),true);
   await checkbox.uncheck();assert.equal(await submit.isDisabled(),true);
  }
  await checkbox.check();
  await page.locator('#welcomeRegisterName').fill('Test');await page.locator('#welcomeRegisterEmail').fill('test@example.invalid');await page.locator('#welcomeRegisterPassword').fill('test-password-123');
  terms={...terms,version:'test-v2'};
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(()=>document.querySelector('#registerTermsAccepted').disabled);
  assert.equal(await checkbox.isChecked(),false);assert.equal(await submit.isDisabled(),true);
  await open();await page.locator('#termsDialog').waitFor();await page.locator('#termsDocument').evaluate(e=>e.scrollTo(0,e.scrollHeight));await page.locator('#termsReadDone').click();await checkbox.check();await submit.tap();
  await page.locator('#welcomeVerifyForm').waitFor();assert.equal(payload.termsVersion,terms.version);assert.equal(payload.termsAccepted,true);
  signedIn=true;
  for(const isAccount of [false,true]){
   account=isAccount;seen='old';await page.reload({waitUntil:'networkidle'});
   await page.locator('#termsUpdateNotice').waitFor();
   for(const language of ['ja','en','ko','zh','es']){
    await page.evaluate(lang=>applyLanguage(lang),language);
    const expected=language==='ja'?terms.summary:terms.translations[language].summary;
    await page.waitForFunction(summary=>document.querySelector('#termsUpdateSummary').textContent.endsWith(summary),expected);
   }
   await page.evaluate(()=>applyLanguage('ja'));await page.locator('#termsUpdateRead').tap();assert.equal(await page.locator('#termsReadDone').isVisible(),false,'Updates do not force consent');
   await page.locator('#termsClose').tap();await page.locator('#termsUpdateDismiss').tap();await page.waitForFunction(()=>document.querySelector('#termsUpdateNotice').classList.contains('hidden'));
   await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('#termsUpdateNotice').isVisible(),false);
   terms={...terms,version:isAccount?'test-v4':'test-v3'};
   await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.locator('#termsUpdateNotice').waitFor();
   await page.locator('#nav-menu').tap();assert.equal(await page.locator('#navigationDialog .navigation-close').count(),0);await page.keyboard.press('Escape');
   if(!isAccount){await page.locator('#nav-account').tap();await page.locator('#credentialsForm').waitFor();assert.equal(await page.locator('#credentialsForm [type="submit"]').isDisabled(),true);assert.equal(await page.locator('#credentialsTermsAccepted').isDisabled(),true);
    await page.locator('[data-terms-consent="credentials"] .terms-open').tap();await page.locator('#termsDialog').waitFor();
    await page.locator('#termsDocument').evaluate(e=>e.scrollTo(0,e.scrollHeight));await page.locator('#termsReadDone').click();await page.locator('#credentialsTermsAccepted').check();
    await page.locator('#accountEmail').fill('upgrade@example.invalid');await page.locator('#accountPassword').fill('test-password-123');await page.locator('#credentialsForm [type="submit"]').tap();await page.locator('#accountVerificationForm').waitFor();
    assert.equal(upgradePayload.termsAccepted,true);assert.equal(upgradePayload.termsVersion,terms.version);}
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: read-to-end + explicit consent; early exit/unchecked/stale consent blocked; accepted version sent; guest/invite creation requires explicit consent; complete translations and live switching work in five languages; version display removed; compact tabs restored; update notices for guests/accounts persist, reappear for next version, and do not force acceptance; menu X removed; mobile dialog bounds in both themes.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
