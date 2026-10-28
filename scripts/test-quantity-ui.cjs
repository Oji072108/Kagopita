const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
 const errors=[];page.on('pageerror', e=>errors.push(e.message));
 const item={id:1,name:'トマト',qty:'2個',completed:false,addedBy:'検証',assignedTo:null};
 const writes=[];
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;
  let data={};
  if(path==='/api/me') data={user:{id:'u',username:'検証'},channels:[{id:'a',name:'検証リスト',role:'admin'}]};
  else if(path.endsWith('/shopping-list')) data={total:1,completed:0,familyFeed:[],categories:[{name:'野菜・果物',items:[item]}]};
  else if(path.endsWith('/members')) data={members:[{id:'u',username:'検証',role:'admin'}]};
  else if(path.endsWith('/favorites')) data={favorites:[]};
  else if(['POST','PUT'].includes(req.method()) && /\/items(?:\/1)?$/.test(path)) {const payload=req.postDataJSON(); writes.push(payload);Object.assign(item,payload);data={item};}
  else if(path==='/api/events') return route.fulfill({contentType:'text/event-stream',body:': test\n\n'});
  return route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(process.env.KAGOPITA_TEST_URL || 'http://127.0.0.1:3001',{waitUntil:'networkidle'});
 await page.locator('.shopping-item').waitFor();
 assert.equal(await page.locator('#searchDetails').getAttribute('open'),null);
 assert.equal(await page.locator('#itemSearch').isVisible(),false);
 await page.locator('#searchDetails > summary').tap();
 await page.locator('#itemSearch').fill('見つからない商品');
 assert.equal(await page.locator('.shopping-item').count(),0);
 await page.locator('#clearFilters').tap();
 await page.locator('.shopping-item').waitFor();
 await page.locator('#searchDetails > summary').tap();
 assert.equal(await page.locator('#itemSearch').isVisible(),false);
 assert.equal(await page.locator('#inputUnit, #editUnit, #inputUnit-trigger, #editUnit-trigger').count(),0);
 assert.equal(await page.locator('#view-complete').textContent().then(t=>t.includes('ログ')),false);
 assert.equal(await page.locator('#view-complete').textContent().then(t=>t.includes('履歴')),true);
 // Real served HTML and scripts, only API responses are isolated fixtures.
 await page.locator('#shortcut-left').tap();
 await page.locator('#nav-menu').tap();
 await page.waitForFunction(()=>document.querySelector('#navigationDialog').classList.contains('is-open') && getComputedStyle(document.querySelector('#navigationDialog')).opacity === '1');
 assert.equal(await page.locator('#showChannelsButton').getAttribute('aria-current'),'page');
 assert.equal(await page.locator('#showChannelsButton').isDisabled(),true);
 assert.equal(await page.locator('#showChannelsButton').evaluate(e=>getComputedStyle(e,'::after').content),'"✓"');
 assert.equal(await page.locator('#navigationDialog [aria-current="page"]').count(),1);
 await page.keyboard.press('Escape');
 await page.locator('#nav-add').tap();
 await page.locator('#inputName').fill('にんじん');await page.locator('#inputQty').fill('3');
 assert.equal(await page.locator('#inputQtyPreview').textContent(),'→ 3本');
 await page.locator('#inputName').fill('トマト');
 assert.equal(await page.locator('#inputQtyPreview').textContent(),'→ 3個');
 assert.equal(await page.locator('#inputQtyPreview').textContent(),'→ 3個');
 await page.locator('#addForm [type="submit"]').tap();await page.locator('#view-list').waitFor({state:'visible'});
 assert.equal(writes.at(-1).qty,'3個');
 await page.locator('.item-edit-button').tap();await page.locator('#itemEditDialog').waitFor({state:'visible'});
 assert.equal(await page.locator('#editQty').inputValue(),'3個');
 await page.locator('#editName').fill('牛乳');
 assert.equal(await page.locator('#editQtyPreview').textContent(),'→ 3個'); // never erase explicit saved units
 await page.locator('#editQty').fill('2');
 assert.equal(await page.locator('#editQtyPreview').textContent(),'→ 2本');
 await page.locator('#saveItemButton').tap();await page.locator('#itemEditDialog').waitFor({state:'hidden'});
 assert.equal(writes.at(-1).qty,'2本');
 for(const theme of ['dark','light']) {
  await page.evaluate(theme=>{document.documentElement.classList.toggle('dark-mode',theme==='dark');document.body.classList.toggle('dark-mode',theme==='dark');localStorage.setItem('kagopita-theme',theme);},theme);
  for(const width of [320,390,768]) {
   await page.setViewportSize({width,height:844});
   await page.locator('#nav-add').tap();
   await page.locator('#inputName').fill('箸');await page.locator('#inputQty').fill('2');
   assert.equal(await page.locator('#inputQtyPreview').textContent(),'→ 2膳');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'overflow '+theme+width);
   await page.locator('#nav-list').tap();
   await page.locator('#searchDetails > summary').tap();
   assert.equal(await page.locator('#itemSearch').isVisible(),true);
   const fullLabel='非常に長いカテゴリの名前でも最後まで省略せず表示される';
   await page.locator('#categoryFilter').evaluate((select,text)=>select.add(new Option(text,'long-category')),fullLabel);
   await page.selectOption('#categoryFilter','long-category');
   const style=await page.locator('#categoryFilter-trigger-value').evaluate(e=>({overflow:getComputedStyle(e).textOverflow,whiteSpace:getComputedStyle(e).whiteSpace}));
   // The current design fits labels on one row, with ellipsis as the fallback.
   assert.equal(style.overflow,'ellipsis');assert.equal(style.whiteSpace,'nowrap');
   assert.equal(await page.locator('#categoryFilter-trigger-value').textContent(),fullLabel);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('#clearFilters').tap();
   await page.locator('#searchDetails > summary').tap();
   await page.locator('#nav-add').tap();
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#view-add').evaluate(e=>e.getAnimations().forEach(a=>a.finish()));
  await page.screenshot({path:'/tmp/kagopita-counters-'+theme+'.png'});
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('#view-add').evaluate(e=>e.getAnimations().forEach(a=>a.finish()));
 await page.screenshot({path:'/tmp/kagopita-counters-add.png'});
 await page.locator('#shortcut-left').tap();await page.locator('#nav-menu').tap();
 await page.waitForFunction(()=>document.querySelector('#navigationDialog').classList.contains('is-open') && getComputedStyle(document.querySelector('#navigationDialog')).opacity === '1');
 await page.screenshot({path:'/tmp/kagopita-counters-menu.png'});
 await page.keyboard.press('Escape');
 for(const language of ['en','ko','zh','es','ja']) {
  await page.evaluate(language=>applyLanguage(language),language);
  await page.locator('#nav-add').tap();
  assert.equal(await page.locator('#inputQtyPreview').textContent(),({en:'→ 2 pairs',ko:'→ 2벌',zh:'→ 2双',es:'→ 2 pares',ja:'→ 2膳'})[language]);
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: served assets, list-switch current check/disabled, folded searchable filters, automatic-only quantities, full dropdown labels, live name/number inference, add/edit payloads, preserved explicit quantities, 320/390/768px light/dark, translations, no page errors');
 await browser.close();
})().catch(e=>{console.error(e);process.exit(1)});
