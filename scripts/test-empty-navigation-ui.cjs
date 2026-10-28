const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const terms=require('../terms.json');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  let channels=[];const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/api/**',async r=>{
   const path=new URL(r.request().url()).pathname;
   if(path==='/api/events')return r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'});
   let data={};
   if(path==='/api/terms')data={...terms,notify:false};
   if(path==='/api/me')data={user:{id:'u',username:'Test'},channels};
   if(path==='/api/channels'&&r.request().method()==='POST') {channels=[{id:'a',name:r.request().postDataJSON().name,role:'owner'}];data={id:'a'};}
   if(path==='/api/invites/accept'){channels=[{id:'b',name:'Joined list',role:'editor'}];data={channelId:'b'};}
   if(path.endsWith('/shopping-list'))data={total:0,completed:0,familyFeed:[],categories:[]};
   if(path.endsWith('/members'))data={members:[]};
   if(path.endsWith('/favorites'))data={favorites:[]};
   return r.fulfill({json:data});
  });
  await page.goto(process.env.KAGOPITA_TEST_URL||'http://127.0.0.1:3001',{waitUntil:'networkidle'});
  const empty=async()=>{
   await page.locator('#view-channels').waitFor();
   assert.equal(await page.locator('#nav-list').isVisible(),false);
   assert.equal(await page.locator('#shortcut-right').isVisible(),false);
   assert.equal(await page.locator('.bottom-nav .nav-item:visible').count(),2);
   assert.equal(await page.locator('#nav-add').isVisible(),false);
   assert.equal(await page.locator('#nav-add').isDisabled(),true);
   await page.locator('#nav-menu').tap();
   assert.equal(await page.locator('[data-menu-tab="list"]').isVisible(),false);
   assert.equal(await page.locator('#nav-members').isVisible(),false);
   await page.keyboard.press('Escape');
   const boxes=await page.locator('.bottom-nav .nav-item:visible').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().toJSON()));
   assert.ok(boxes.every(b=>Math.abs(b.width-boxes[0].width)<1));
   const gap=await page.locator('.bottom-nav-links').evaluate(e=>parseFloat(getComputedStyle(e).columnGap));
   assert.ok(Math.abs(boxes[1].right-boxes[0].left-(boxes[0].width*2+gap))<2,`No empty navigation slots: ${JSON.stringify(boxes)}`);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  };
  for(const width of [320,390,768]){
   await page.setViewportSize({width,height:844});await empty();
  }
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:'/tmp/kagopita-empty-navigation.png'});
  await page.locator('#channelName').fill('Groceries');
  await page.locator('#createChannelForm [type="submit"]').tap();
  await page.locator('#view-list').waitFor();
  assert.equal(await page.locator('.bottom-nav .nav-item:visible').count(),5);
  assert.equal(await page.locator('#nav-add').isVisible(),true);
  assert.equal(await page.locator('#nav-add').isEnabled(),true);
  await page.locator('#nav-add').tap();await page.locator('#view-add').waitFor();
  await page.locator('#shortcut-right').tap();await page.locator('#view-members').waitFor();
  channels=[];await page.evaluate(()=>refreshChannels(null));await empty();
  await page.locator('[data-list-access="join"]').tap();
  await page.locator('#channelInvite').fill('TESTCODE');
  await page.locator('#joinChannelForm [type="submit"]').tap();
  await page.locator('#view-list').waitFor();
  assert.equal(await page.locator('#nav-list').isVisible(),true);
  assert.equal(await page.locator('#nav-add').isVisible(),true);
  assert.equal(await page.locator('#nav-add').isEnabled(),true);
  assert.equal(await page.locator('#shortcut-right').isVisible(),true);
  channels=[{...channels[0],archivedAt:'2026-10-28'}];await page.evaluate(()=>refreshChannels(null));await empty();
  await page.evaluate(()=>{localStorage.setItem('kagopita-shortcuts',JSON.stringify(['members','channels']));renderNavigationShortcuts();});
  assert.equal(await page.locator('#shortcut-left').isVisible(),false);
  assert.equal(await page.locator('#shortcut-right').isVisible(),true);
  await page.locator('#nav-account').tap();await page.locator('#view-account').waitFor();
  assert.deepEqual(errors,[]);
  console.log('PASS: empty navigation at 320/390/768px, compact spacing, menu visibility, create/join restoration, last-list removal, archived-only lists, custom shortcuts, account access; no browser errors');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exit(1);});
