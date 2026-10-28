const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
try{
const originals=[{id:1,name:'牛乳',qty:'1本',category:'乳製品・チーズ',addedBy:'Alice',assignedTo:null,notes:'明治のやつ'},{id:2,name:'tissues',qty:'2個',category:'日用品',addedBy:'Bob',assignedTo:null},{id:3,name:'お米2キロ',qty:'2kg',category:'調味料・乾物',addedBy:'Alice',assignedTo:null}];
const items=structuredClone(originals), writes=[],errors=[];
async function viewer(language){
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
 await context.addInitScript(language=>localStorage.setItem('kagopita-language',language),language);
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/api/**',async route=>{
 const req=route.request(),path=new URL(req.url()).pathname;let data={};
 if(path==='/api/me')data={user:{id:language,username:language},channels:[{id:'shared',name:'Shared',role:'owner'}]};
 else if(path.endsWith('/shopping-list'))data={total:items.length,completed:0,familyFeed:[],categories:[...new Set(items.map(i=>i.category))].map(name=>({name,items:items.filter(i=>i.category===name)})),deletedItems:[{id:99,name:'牛乳',qty:'2本'}]};
 else if(path.endsWith('/members'))data={members:[]};
 else if(path.endsWith('/favorites'))data={favorites:[{id:5,name:'牛乳',qty:'2本',category:'乳製品・チーズ'}]};
 else if(req.method()==='POST' && path.endsWith('/items')){const body=req.postDataJSON();writes.push(body);const item={id:items.length+1,...body,addedBy:language};items.push(item);data={item}}
 else if(path==='/api/events')return route.fulfill({contentType:'text/event-stream',body:': test\n\n'});
 await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
 });
 await page.goto(process.env.KAGOPITA_TEST_URL || 'http://127.0.0.1:3001',{waitUntil:'networkidle'});await page.locator('.shopping-item').first().waitFor();return page;
}
const ja=await viewer('ja'), en=await viewer('en');
assert.match(await ja.locator('.item-name').first().innerText(),/牛乳.*1本/);
assert.match(await en.locator('.item-name').first().innerText(),/milk.*1 bottle/);
assert.match(await ja.locator('.item-name').nth(1).innerText(),/ティッシュ.*2個/);
assert.match(await en.locator('.item-name').nth(2).innerText(),/rice2kg.*2kg/);
assert.equal(await en.locator('.item-note').textContent(),'明治のやつ');
await en.locator('#searchDetails > summary').tap();await en.locator('#itemSearch').fill('milk');assert.equal(await en.locator('.shopping-item').count(),1);
await en.locator('#itemSearch').fill('牛乳');assert.equal(await en.locator('.shopping-item').count(),1);
await en.locator('#itemSearch').fill('');
await en.locator('.item-edit-button').first().tap();await en.locator('#itemEditDialog').waitFor({state:'visible'});
assert.equal(await en.locator('#editName').inputValue(),'牛乳');assert.equal(await en.locator('#editQty').inputValue(),'1本');await en.locator('#cancelItemEdit').tap();
for(const [language,name,quantity] of [['ko','우유','1병'],['zh','牛奶','1瓶'],['es','leche','1 botella'],['en','milk','1 bottle'],['ja','牛乳','1本']]){
 await en.evaluate(lang=>applyLanguage(lang),language);
 await en.waitForFunction(({name,quantity})=>{const e=document.querySelector('.item-name');return e.textContent.includes(name)&&e.textContent.includes(quantity)},{name,quantity});
 assert.ok(await en.locator('[data-shopping-name]').allTextContents().then(texts=>texts.includes(name)));
 await openAdd(en);
 await en.waitForFunction(name=>document.querySelector('.favorite-name')?.textContent===name,name);
 await en.locator('#inputName').fill(name);assert.equal(await en.locator('#inputCategory').inputValue(),'乳製品・チーズ');
 await en.waitForFunction(quantity=>document.querySelector('#inputQtyPreview').textContent.includes(quantity),quantity);
 await en.locator('#nav-list').tap();
}
assert.deepEqual(items,originals);assert.equal(writes.length,0);
await en.evaluate(()=>applyLanguage('es'));await openAdd(en);await en.locator('#inputName').fill('leche');await en.locator('#inputQty').fill('2');
assert.equal(await en.locator('#inputQtyPreview').textContent(),'→ 2 botellas');
await en.locator('#addForm [type="submit"]').tap();await en.locator('#view-list').waitFor({state:'visible'});
assert.equal(writes[0].name,'leche');assert.equal(writes[0].qty,'2本');assert.equal(writes[0].category,'乳製品・チーズ');
await ja.reload({waitUntil:'networkidle'});await ja.locator('.shopping-item').first().waitFor();assert.match(await ja.locator('.shopping-item').allTextContents().then(x=>x.join(' ')),/牛乳.*2本/);
for(const dark of [false,true])for(const width of [320,390,768]){
 await en.setViewportSize({width,height:844});await en.evaluate(dark=>{document.documentElement.classList.toggle('dark-mode',dark);document.body.classList.toggle('dark-mode',dark)},dark);
 assert.ok(await en.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}
await en.setViewportSize({width:390,height:844});await en.screenshot({path:'/tmp/kagopita-multilingual-es.png',fullPage:true});
assert.deepEqual(errors,[]);console.log('PASS: concurrent JA/EN viewers, five-language item/favorite/counter switching, cross-language search, original edit values, untouched notes, multilingual add serialization, shared reload and both-theme responsive layout');
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});

// The selected Add tab is deliberately disabled; only navigate when leaving another tab.
async function openAdd(page) {
  const button = page.locator('#nav-add');
  if (await button.isDisabled()) assert.equal(await button.getAttribute('aria-current'), 'page');
  else await button.tap();
}
