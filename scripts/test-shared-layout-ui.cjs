const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
(async()=>{
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH,args:['--no-sandbox']});
try{
const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true});const errors=[],writes=[];page.on('pageerror',e=>errors.push(e.message));
let channels=[{id:'a',name:'Weekend groceries',role:'admin'},{id:'b',name:'Family essentials',role:'member'},{id:'z',name:'Holiday shopping',role:'admin',archivedAt:'2026-10-01'}];
await page.addInitScript(()=>localStorage.setItem('kagopita-language','en'));
await page.route('**/api/**',async r=>{
const req=r.request(),path=new URL(req.url()).pathname;let data={};
if(path==='/api/me')data={user:{id:'u',username:'Test'},channels};
else if(path.endsWith('/shopping-list'))data={total:0,completed:0,familyFeed:[],categories:[]};
else if(path.endsWith('/members'))data={members:[]};
else if(path.endsWith('/favorites'))data={favorites:[]};
else if(path==='/api/events')return r.fulfill({contentType:'text/event-stream',body:': test\n\n'});
else if(req.method()!=='GET'){
 const body=req.postData()?req.postDataJSON():{};writes.push({path,method:req.method(),body});
 const id=path.split('/')[3];
 if(path.endsWith('/duplicate')){data={id:'copy'};channels.push({id:'copy',name:'Copy',role:'admin'})}
 else if(path.endsWith('/archive'))channels.find(c=>c.id===id).archivedAt=body.archived?'2026-10-27':null;
 else if(path==='/api/channels'){data={id:'new'};channels.push({id:'new',name:body.name,role:'admin'})}
 else if(path==='/api/invites/accept'){data={channelId:'joined'};channels.push({id:'joined',name:'Joined',role:'member'})}
}
await r.fulfill({contentType:'application/json',body:JSON.stringify(data)});
});
await page.goto(process.env.KAGOPITA_TEST_URL || 'http://127.0.0.1:3001',{waitUntil:'networkidle'});await page.locator('#shortcut-left').tap();await page.locator('#view-channels').waitFor({state:'visible'});
assert.equal(await page.locator('#joinedChannelsList .managed-list-row').count(),2);
assert.equal(await page.locator('#joinedChannelsList .managed-list-row').nth(0).locator('.list-management-actions button').count(),2);
assert.equal(await page.locator('#joinedChannelsList .managed-list-row').nth(1).locator('.list-management-actions button').count(),1);
assert.equal(await page.locator('#createChannelForm').isVisible(),true);assert.equal(await page.locator('#joinChannelForm').isVisible(),false);
await page.locator('#joinListTab').tap();await page.locator('#channelInvite').fill('ABCD1234');await page.locator('#createListTab').tap();await page.locator('#joinListTab').tap();assert.equal(await page.locator('#channelInvite').inputValue(),'ABCD1234');
await page.locator('#joinListTab').press('ArrowLeft');assert.equal(await page.locator('#createListTab').getAttribute('aria-selected'),'true');
for(const language of ['ja','en','ko','zh','es']){
await page.evaluate(language=>applyLanguage(language),language);
for(const dark of [false,true])for(const width of [320,390,768]){
await page.setViewportSize({width,height:844});await page.evaluate(d=>{document.documentElement.classList.toggle('dark-mode',d);document.body.classList.toggle('dark-mode',d)},dark);
assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
for(const selector of ['#createListTab','#joinListTab','#joinedChannelsList .list-management-actions button'])assert.ok(await page.locator(selector).evaluateAll(es=>es.every(e=>e.getBoundingClientRect().height>=44)));
}
}
await page.evaluate(()=>applyLanguage('en'));await page.setViewportSize({width:390,height:844});
await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:'/tmp/kagopita-shared-new-dark.png',fullPage:true,animations:'disabled'});
await page.evaluate(()=>{document.documentElement.classList.remove('dark-mode');document.body.classList.remove('dark-mode')});
await page.screenshot({path:'/tmp/kagopita-shared-new-light.png',fullPage:true,animations:'disabled'});
await page.locator('#joinedChannelsList .managed-list-row').nth(1).locator('.joined-channel-button').tap();await page.locator('#view-list').waitFor({state:'visible'});
await page.locator('#shortcut-left').tap();assert.match(await page.locator('.is-current .joined-channel-name').textContent(),/Family/);
await page.locator('#joinedChannelsList .managed-list-row').first().getByRole('button',{name:'Duplicate: Weekend groceries'}).tap();await page.locator('#view-list').waitFor({state:'visible'});assert.equal(writes.at(-1).path,'/api/channels/a/duplicate');
await page.locator('#shortcut-left').tap();await page.getByRole('button',{name:'Archive: Weekend groceries',exact:true}).tap();await page.waitForFunction(()=>!Array.from(document.querySelectorAll('#joinedChannelsList .joined-channel-name')).some(e=>e.textContent==='Weekend groceries'));
await page.locator('#archivedListsDetails > summary').tap();await page.getByRole('button',{name:'Unarchive: Weekend groceries',exact:true}).tap();await page.waitForFunction(()=>Array.from(document.querySelectorAll('#joinedChannelsList .joined-channel-name')).some(e=>e.textContent==='Weekend groceries'));
await page.locator('#channelName').fill('Weekly');await page.locator('#createChannelForm [type="submit"]').tap();await page.locator('#view-list').waitFor({state:'visible'});assert.equal(writes.at(-1).body.name,'Weekly');
await page.locator('#shortcut-left').tap();await page.locator('#joinListTab').tap();await page.locator('#channelInvite').fill('ABCD1234');await page.locator('#joinChannelForm [type="submit"]').tap();await page.locator('#view-list').waitFor({state:'visible'});assert.equal(writes.at(-1).body.invite,'ABCD1234');
assert.deepEqual(errors,[]);console.log('PASS: five-language 320/390/768 layouts in both themes, 44px actions, tab touch/keyboard and value preservation, list switch, duplicate, archive/unarchive, create and join');
}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
