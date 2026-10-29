const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const terms=require('../terms.json');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.EventSource=class extends EventTarget{close(){}};});
  let deleted=[],role='owner';
  await page.route('**/api/**',async route=>{
   const request=route.request(),p=new URL(request.url()).pathname;let data={};
   if(request.method()!=='GET'){writes.push(p);if(p.endsWith('/restore')||p.endsWith('/permanent'))deleted=[];}
   if(p==='/api/me')data={user:{id:'u',username:'Test'},channels:[{id:'a',name:'Groceries',role}]};
   if(p==='/api/terms')data={...terms,notify:false};
   if(p==='/api/notifications')data={notifications:[],unreadCount:0,totalPages:1};
   if(p.endsWith('/members'))data={members:[{id:'u',username:'Test',role}]};
   if(p.endsWith('/shopping-list'))data={total:0,completed:0,categories:[],familyFeed:[],deletedItems:deleted,serverNow:new Date().toISOString()};
   await route.fulfill({json:data});
  });
  await page.goto(process.env.KAGOPITA_TEST_URL||'http://127.0.0.1:3001');
  await page.waitForFunction(()=>currentChannelId);
  assert.equal(await page.locator('#deletedItemsDetails').isVisible(),false,'Empty section hidden');
  deleted=[{id:1,name:'Long <script> grocery item',qty:'1',deletedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+86400000).toISOString()}];
  await page.evaluate(()=>loadShoppingList());await page.locator('#deletedItemsDetails summary').tap();
  for(const width of [320,390,768])for(const dark of [false,true])for(const language of ['ja','en','ko','zh','es']){
   await page.setViewportSize({width,height:844});
   await page.evaluate(({dark,language})=>{document.documentElement.classList.toggle('dark-mode',dark);applyLanguage(language);},{dark,language});
   for(const selector of ['.deleted-restore-button','.deleted-permanent-button']){
    const box=await page.locator(selector).boundingBox();assert.ok(box.height>=44 && box.width>=44,'Tap target');
   }
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No overflow');
   assert.equal(await page.locator('#deletedItemsList script').count(),0,'User text is escaped');
   if(width===390&&language==='ja')await page.screenshot({path:'/tmp/deleted-items-'+dark+'.png',animations:'disabled'});
  }
  await page.evaluate(()=>applyLanguage('en'));
  await page.locator('.deleted-permanent-button').tap();await page.locator('#actionDialog').waitFor({state:'visible'});
  assert.match(await page.locator('#actionDialogBody').textContent(),/cannot be undone/);
  await page.locator('#actionDialogCancel').tap();assert.equal(writes.length,0,'Cancel does not delete');
  await page.locator('.deleted-restore-button').tap();await page.locator('#deletedItemsDetails').waitFor({state:'hidden'});
  assert.ok(writes.some(p=>p.endsWith('/restore')));
  deleted=[{id:2,name:'Delete me',qty:'1',expiresAt:new Date(Date.now()+86400000).toISOString()}];
  await page.evaluate(()=>loadShoppingList());await page.locator('#deletedItemsDetails summary').tap();
  await page.locator('.deleted-permanent-button').tap();await page.locator('#actionDialogSubmit').tap();
  await page.locator('#deletedItemsDetails').waitFor({state:'hidden'});assert.ok(writes.some(p=>p.endsWith('/permanent')));
  deleted=[{id:3,name:'Expiring',qty:'1',expiresAt:new Date(Date.now()+86400000).toISOString()}];
  await page.evaluate(()=>loadShoppingList());
  await page.locator('#deletedItemsDetails summary').tap();
  await page.clock.install({time:new Date('2026-10-29T00:00:00Z')});await page.clock.pauseAt(new Date('2026-10-29T00:00:01Z'));
  await page.evaluate(()=>{deletedClockOffset=0;renderDeletedItems([{id:4,name:'Clock',qty:'1',expiresAt:new Date(Date.now()+61000).toISOString()}]);});
  assert.match(await page.locator('.deleted-item-expiry').textContent(),/0h 2m/);
  await page.clock.runFor(30001);assert.match(await page.locator('.deleted-item-expiry').textContent(),/shortly/);
  await page.clock.runFor(31001);assert.equal(await page.locator('#deletedItemsDetails').isVisible(),false,'Last expiry hides panel without requests');
  await page.evaluate(()=>{renderDeletedItems([{id:5,name:'Hidden',qty:'1',expiresAt:new Date(Date.now()+86400000).toISOString()}]);});
  role='member';await page.evaluate(()=>refreshChannels());assert.equal(await page.locator('#deletedItemsDetails').isVisible(),false,'Read-only user cannot see management controls');
  assert.deepEqual(errors,[]);
  console.log('PASS: 30 responsive deleted-item layouts; restore; permanent-delete confirm/cancel; safe text; local countdown and expiry; empty panel hides; read-only visibility.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
