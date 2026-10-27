const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
 try {
 const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const item={id:1,name:'トマト',qty:'2個',completed:false,addedBy:'検証',assignedTo:null,category:'野菜・果物'};
 const writes=[];
 await page.route('**/api/**',async route=>{
  const req=route.request(),path=new URL(req.url()).pathname;let data={};
  if(path==='/api/me') data={user:{id:'u',username:'検証'},channels:[{id:'a',name:'検証リスト',role:'admin'}]};
  else if(path.endsWith('/shopping-list')) data={total:1,completed:0,familyFeed:[],categories:[{name:item.category,items:[item]}]};
  else if(path.endsWith('/members')) data={members:[{id:'u',username:'検証',role:'admin'}]};
  else if(path.endsWith('/favorites')) data={favorites:[]};
  else if(['POST','PUT'].includes(req.method()) && /\/items(?:\/1)?$/.test(path)) {const payload=req.postDataJSON(); writes.push(payload);Object.assign(item,payload);data={item};}
  else if(path==='/api/events') return route.fulfill({contentType:'text/event-stream',body:': test\n\n'});
  await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(process.env.KAGOPITA_TEST_URL || 'http://127.0.0.1:3001',{waitUntil:'networkidle'});
 await page.locator('.shopping-item').waitFor();await page.locator('#nav-add').tap();
 await page.locator('#inputName').fill('牛乳');
 assert.equal(await page.locator('#inputCategory').inputValue(),'乳製品・チーズ');
 assert.equal(await page.locator('#categoryPickerValue').textContent(),'乳製品・チーズ');
 assert.equal(await page.locator('#categoryOptions [aria-selected="true"]').getAttribute('data-value'),'乳製品・チーズ');
 await page.locator('#inputName').fill('トマト');assert.equal(await page.locator('#inputCategory').inputValue(),'野菜・果物');
 await page.locator('#categoryPickerButton').tap();
 await page.locator('#categoryOptions [data-value="冷凍食品"]').tap();
 await page.locator('#inputName').fill('牛乳');assert.equal(await page.locator('#inputCategory').inputValue(),'冷凍食品');
 await page.locator('#inputName').fill('');await page.locator('#inputName').fill('牛乳');
 assert.equal(await page.locator('#inputCategory').inputValue(),'乳製品・チーズ');
 await page.locator('#customCategory').fill('いつもの売り場');await page.locator('#inputName').fill('トマト');
 assert.equal(await page.locator('#customCategory').inputValue(),'いつもの売り場');
 await page.locator('#customCategory').fill('');assert.equal(await page.locator('#inputCategory').inputValue(),'野菜・果物');
 await page.locator('#inputName').fill('牛乳');await page.locator('#addForm [type="submit"]').tap();
 await page.locator('#view-list').waitFor({state:'visible'});assert.equal(writes.at(-1).category,'乳製品・チーズ');
 await page.locator('.item-edit-button').tap();await page.locator('#itemEditDialog').waitFor({state:'visible'});
 await page.locator('#editName').fill('豆腐');assert.equal(await page.locator('#editCategory').inputValue(),'卵・豆腐・納豆');
 await page.locator('#editCategory').fill('独自カテゴリ');await page.locator('#editName').fill('トマト');
 assert.equal(await page.locator('#editCategory').inputValue(),'独自カテゴリ');
 await page.locator('#saveItemButton').tap();await page.locator('#itemEditDialog').waitFor({state:'hidden'});
 assert.equal(writes.at(-1).category,'独自カテゴリ');
 await page.locator('.item-edit-button').tap();await page.locator('#itemEditDialog').waitFor({state:'visible'});
 await page.locator('#editName').fill('牛乳');assert.equal(await page.locator('#editCategory').inputValue(),'独自カテゴリ');
 await page.locator('#cancelItemEdit').tap();
 await page.locator('#nav-add').tap();await page.locator('#inputName').fill('牛乳');
 for(const language of ['en','ko','zh','es','ja']) {
  await page.evaluate(language=>applyLanguage(language),language);
  await page.locator('#inputName').fill('トマト');await page.locator('#inputName').fill('牛乳');
  assert.equal(await page.locator('#inputCategory').inputValue(),'乳製品・チーズ');
  const expected={en:'Dairy · cheese',ko:'유제품 · 치즈',zh:'乳制品・奶酪',es:'Lácteos · queso',ja:'乳製品・チーズ'};
  assert.equal(await page.locator('#categoryPickerValue').textContent(),expected[language]);
 }
 for(const dark of [false,true]) {
  await page.evaluate(dark=>{document.documentElement.classList.toggle('dark-mode',dark);document.body.classList.toggle('dark-mode',dark)},dark);
  for(const width of [320,390,768]) {
   await page.setViewportSize({width,height:844});
   await page.locator('#inputName').fill('牛乳');await page.locator('#categoryPickerButton').tap();
   await page.locator('#categoryOptions [data-value="乳製品・チーズ"]').tap();
   assert.equal(await page.locator('#inputCategory').inputValue(),'乳製品・チーズ');
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('#inputName').fill('');await page.locator('#inputName').fill('牛乳');
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('#view-add').evaluate(e=>e.getAnimations().forEach(a=>a.finish()));
  await page.screenshot({path:'/tmp/kagopita-category-'+(dark?'dark':'light')+'.png',fullPage:true});
 }
 assert.deepEqual(errors,[]);
 console.log('PASS: live served Add/Edit inference and payloads, manual/custom overrides, reset, preserved saved custom categories, translated labels, touch picker, 320/390/768px both themes, no page errors');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
