const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
 const browser = await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  const page = await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const errors=[],native=[],writes=[];
  page.on('pageerror', e=>errors.push(e.message));
  page.on('dialog', async d=>{native.push(d.type());await d.dismiss()});
  let failKick=false, delayKick=false, releaseKick;
  const person='Family <img src=x onerror=alert(1)> $&';
  await page.route('**/api/**', async route=>{
   const req=route.request(), path=new URL(req.url()).pathname;
   let data={};
   if(path==='/api/events')return route.fulfill({contentType:'text/event-stream',body:': fixture\n\n'});
   if(req.method()!=='GET'){
    writes.push({path,method:req.method()});
    if(path.endsWith('/members/m')){
     if(delayKick)await new Promise(r=>releaseKick=r);
     if(failKick)return route.fulfill({status:500,contentType:'application/json',body:JSON.stringify({error:'Please try again.'})});
    }
   }
   if(path==='/api/me')data={user:{id:'u',username:'Test',email:'test@example.com',emailVerified:true},channels:[{id:'a',name:'Family groceries',role:'owner'}]};
   else if(path.endsWith('/members'))data={members:[{id:'u',username:'Test',role:'owner'},{id:'m',username:person,role:'editor'}]};
   else if(path.endsWith('/shopping-list'))data={total:1,completed:1,categories:[{name:'野菜・果物',items:[{id:1,name:'りんご',qty:'1個',completed:true}]}],familyFeed:[]};
   else if(path.endsWith('/favorites'))data={favorites:[]};
   await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
  });
  await page.goto(process.env.KAGOPITA_TEST_URL||'http://127.0.0.1:3001',{waitUntil:'networkidle'});
  await page.locator('.shopping-item').waitFor();
  const dialog=page.locator('#actionDialog');
  const cancel=page.locator('#actionDialogCancel'),submit=page.locator('#actionDialogSubmit');
  const assertFit=async()=>{
   assert.ok(await dialog.evaluate(e=>{const r=e.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&r.top>=0&&r.bottom<=innerHeight&&e.scrollWidth<=e.clientWidth}));
   assert.ok(await submit.evaluate(e=>e.offsetHeight>=44));
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth));
  };
  const touch = async selector => {
   const target=page.locator(selector);
   await target.evaluate(e=>e.scrollIntoView({block:'center',behavior:'instant'}));
   await target.tap();
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),'Page must not expand the layout viewport');
  };
  const colors={};
  for(const dark of [false,true]){
   await page.evaluate(d=>{document.documentElement.classList.toggle('dark-mode',d);document.body.classList.toggle('dark-mode',d)},dark);
   for(const language of ['ja','en','ko','zh','es'])for(const width of [320,390,768]){
    console.log('Checking',dark?'dark':'light',language,width);
    await page.setViewportSize({width,height:844});
    await page.evaluate(async lang=>{applyLanguage(lang);await switchTab('members')},language);
    await page.locator('#view-members').evaluate(e=>Promise.all(e.getAnimations().map(animation=>animation.finished)));
    const kick=page.locator('.kick-button');
    assert.ok(await kick.evaluate(e=>e.offsetHeight>=44));
    await kick.tap();await dialog.waitFor();
    assert.match(await page.locator('#actionDialogBody').textContent(),/Family <img/);
    assert.equal(await dialog.locator('img').count(),0);
    assert.equal(await cancel.evaluate(e=>e===document.activeElement),true);
    assert.equal(await dialog.evaluate(e=>e.matches(':modal')),true);
    await assertFit();
    if(language==='en'&&width===390){
     assert.equal(await page.locator('#actionDialogTitle').textContent(),'Remove this member?');
     assert.equal(await cancel.textContent(),'Cancel');
     colors[dark]={kick:await kick.evaluate(e=>getComputedStyle(e).backgroundColor)};
     await page.screenshot({path:`/tmp/kagopita-dialog-${dark?'dark':'light'}.png`,animations:'disabled'});
    }
    await cancel.tap();await dialog.waitFor({state:'hidden'});
    assert.equal(await kick.evaluate(e=>e===document.activeElement),true);
    await page.evaluate(()=>switchTab('account'));await touch('#deleteAccountButton');await assertFit();
    if(language==='en'&&width===390){
     colors[dark].delete=await page.locator('#deleteAccountButton').evaluate(e=>getComputedStyle(e).backgroundColor);
     assert.equal(await submit.textContent(),'Delete account');
    }
    await cancel.tap();
    await touch('#leaveGroup');await assertFit();
    if(language==='en')assert.equal(await page.locator('#actionDialogTitle').textContent(),'Leave this list?');
    await cancel.tap();
    await page.evaluate(()=>switchTab('complete'));await page.locator('#view-complete button').first().tap();await assertFit();await cancel.tap();
   }
  }
  assert.notEqual(colors.false.kick,colors.true.kick);assert.notEqual(colors.false.delete,colors.true.delete);
  assert.equal(writes.length,0,'Cancellation must never issue a destructive request');
  await page.setViewportSize({width:390,height:844});await page.evaluate(async()=>{applyLanguage('en');await switchTab('members')});
  await page.locator('.kick-button').tap();await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(writes.length,0);
  await page.locator('.kick-button').tap();await page.mouse.click(2,2);await dialog.waitFor({state:'hidden'});assert.equal(writes.length,0);
  failKick=true;
  await page.locator('.kick-button').tap();await submit.tap();await page.locator('#actionDialogError').getByText('Please try again.',{exact:true}).waitFor();
  assert.equal(await dialog.isVisible(),true);assert.equal(await submit.isEnabled(),true);assert.equal(writes.length,1);
  failKick=false;delayKick=true;await submit.tap();await page.waitForFunction(()=>document.querySelector('#actionDialog').getAttribute('aria-busy')==='true');
  assert.equal(await submit.isDisabled(),true);assert.equal(await cancel.isDisabled(),true);
  await page.keyboard.press('Escape');assert.equal(await dialog.isVisible(),true);
  await page.waitForTimeout(50);releaseKick();await dialog.waitFor({state:'hidden'});assert.equal(writes.length,2);delayKick=false;
  await page.evaluate(()=>{KagopitaDialogs.notice('A test error.');KagopitaDialogs.notice('Second notice.')});
  await page.locator('#actionDialogBody').getByText('A test error.',{exact:true}).waitFor();
  assert.equal(await cancel.isVisible(),false);await submit.tap();
  await page.locator('#actionDialogBody').getByText('Second notice.',{exact:true}).waitFor();await submit.tap();await dialog.waitFor({state:'hidden'});
  await page.evaluate(()=>switchTab('complete'));await page.locator('#view-complete button').first().tap();await submit.tap();await dialog.waitFor({state:'hidden'});
  assert.deepEqual(writes.at(-1),{path:'/api/channels/a/complete',method:'POST'});
  await page.evaluate(()=>switchTab('account'));await touch('#leaveGroup');await submit.tap();await dialog.waitFor({state:'hidden'});
  assert.deepEqual(writes.at(-1),{path:'/api/channels/a/membership',method:'DELETE'});
  await page.evaluate(()=>switchTab('account'));await touch('#deleteAccountButton');await submit.tap();await page.waitForLoadState('networkidle');
  assert.deepEqual(writes.at(-1),{path:'/api/account',method:'DELETE'});
  assert.deepEqual(native,[]);assert.deepEqual(errors,[]);
  console.log('PASS: custom confirmations in five languages, both themes at 320/390/768px; themed destructive colors; focus, Escape/backdrop cancellation, queued notices, safe names, error/retry, busy guards, member/list/leave/account requests; no native dialogs or page errors');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
