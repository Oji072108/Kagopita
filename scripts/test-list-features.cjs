const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const {DatabaseSync} = require('node:sqlite');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kagopita-features-'));
 const listener=net.createServer(); await new Promise(r=>listener.listen(0,'127.0.0.1',r));
 const port=listener.address().port;await new Promise(r=>listener.close(r));
 const base=`http://127.0.0.1:${port}`;
 let child, db, browser;
 const start=async()=>{
  child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),KAGOPITA_DATA_DIR:directory,NODE_ENV:'test'},stdio:['ignore','ignore','inherit']});
  for(let i=0;i<100;i++) {try{if((await fetch(base)).ok)return;}catch{} await new Promise(r=>setTimeout(r,50));}throw Error('Server startup failed');
 };
 const stop=async()=>{if(child && child.exitCode===null){const exited=new Promise(r=>child.once('exit',r));child.kill();await exited;}};
 try {
  await start();
  async function request(cookie,url,method='GET',body,expected=200){
   if (url === '/api/account' && method === 'POST') body = {...body, termsAccepted: true, termsVersion: require('../terms.json').version};
   const response=await fetch(base+url,{method,headers:{Cookie:cookie||'','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
   const data=await response.json();assert.equal(response.status,expected,`${method} ${url}: ${JSON.stringify(data)}`);
   return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  }
  const owner=await request('','/api/account','POST',{username:'管理者'},201);
  const member=await request('','/api/account','POST',{username:'メンバー'},201);
  const outsider=await request('','/api/account','POST',{username:'部外者'},201);
  const {data:channel}=await request(owner.cookie,'/api/channels','POST',{name:'週末'},201);
  const root=`/api/channels/${channel.id}`;
  const {data:invite}=await request(owner.cookie,root+'/invites','POST',{});
  await request(member.cookie,'/api/invites/accept','POST',{invite:invite.inviteCode});
  await request(owner.cookie,root+`/members/${member.data.user.id}/role`,'PATCH',{role:'editor'});
  const values={name:'牛乳',qty:'2本',category:'乳製品',notes:'低脂肪\n2本でこの価格',price:398,recurrence:'weekly',assignedTo:member.data.user.id};
  const {data:created}=await request(owner.cookie,root+'/items','POST',values,201);
  const url=root+`/items/${created.item.id}`;
  const list=async()=> (await request(owner.cookie,root+'/shopping-list')).data;
  const first=data=>data.categories.flatMap(c=>c.items)[0];
  assert.equal(first(await list()).notes,values.notes);assert.equal(first(await list()).price,398);
  await request(member.cookie,url,'PUT',{...values,notes:'編集しました',price:0});
  assert.equal(first(await list()).price,0);
  await request(member.cookie,url,'PUT',{name:values.name,qty:values.qty,category:values.category,assignedTo:values.assignedTo});
  assert.equal(first(await list()).notes,'編集しました');assert.equal(first(await list()).recurrence,'weekly');
  for(const bad of [{notes:'x'.repeat(1001)},{price:-1},{price:1.2},{price:'100'},{recurrence:'hourly'}]) await request(owner.cookie,url,'PUT',{...values,...bad},400);
  await request(outsider.cookie,url+'/restore','POST',{},403);
  await request(member.cookie,url+'/toggle','PATCH');
  let item=first(await list());assert.equal(item.completed,true);assert.ok(item.nextDueAt);
  db=new DatabaseSync(path.join(directory,'kagopita.sqlite'));
  db.prepare('UPDATE shopping_items SET next_due_at = ? WHERE id = ?').run('2000-01-01T00:00:00.000Z',item.id);
  item=first(await list());assert.equal(item.completed,false);assert.equal(item.nextDueAt,null);
  assert.equal((await list()).total,1); // no duplicate occurrence on repeated reads
  await request(owner.cookie,url+'/favorite','PUT');
  const favorite=(await request(owner.cookie,root+'/favorites')).data.favorites[0];
  await request(owner.cookie,root+`/favorites/${favorite.id}/add`,'POST',{},201);
  await request(owner.cookie,root+`/favorites/${favorite.id}`,'DELETE');
  await request(owner.cookie,url,'DELETE');
  let state=await list();assert.equal(state.total,1);assert.equal(state.deletedItems[0].notes,'編集しました');
  await request(owner.cookie,url,'PUT',values,404);await request(owner.cookie,url+'/toggle','PATCH',{},404);
  const {data:copy}=await request(member.cookie,root+'/duplicate','POST',{},201);
  const copyRoot=`/api/channels/${copy.id}`;
  let copied=(await request(member.cookie,copyRoot+'/shopping-list')).data;
  assert.equal(copied.total,1);assert.equal(copied.deletedItems.length,0);
  assert.equal((await request(member.cookie,copyRoot+'/members')).data.members.length,1);
  await request(owner.cookie,copyRoot+'/shopping-list','GET',undefined,403);
  await request(owner.cookie,url+'/restore','POST');
  assert.equal(first(await list()).notes,'編集しました');assert.equal((await list()).deletedItems.length,0);
  const {data:fullCopy}=await request(owner.cookie,root+'/duplicate','POST',{name:'複製テスト'},201);
  copied=(await request(owner.cookie,`/api/channels/${fullCopy.id}/shopping-list`)).data;
  assert.equal(copied.total,2);const copiedRecurring=copied.categories.flatMap(c=>c.items).find(i=>i.recurrence==='weekly');
  assert.equal(copiedRecurring.notes,'編集しました');assert.equal(copiedRecurring.price,0);assert.equal(copiedRecurring.assignedTo,null);assert.equal(copiedRecurring.completed,false);
  await request(member.cookie,root+'/archive','PATCH',{archived:true},403);
  await request(owner.cookie,root+'/archive','PATCH',{archived:true});
  await request(owner.cookie,url+'/toggle','PATCH',{},409);await request(owner.cookie,root+'/items','POST',values,409);
  assert.ok((await request(member.cookie,'/api/me')).data.channels.find(c=>c.id===channel.id).archivedAt);
  db.prepare('UPDATE shopping_items SET completed=1, next_due_at=? WHERE id=?').run('2000-01-01T00:00:00.000Z',item.id);
  assert.equal(first(await list()).completed,true); // archived recurrence is paused
  await request(owner.cookie,root+'/archive','PATCH',{archived:false});assert.equal(first(await list()).completed,false);
  for(const recurrence of ['daily','weekly','monthly']) {
   await request(owner.cookie,url,'PUT',{...values,recurrence});await request(owner.cookie,url+'/toggle','PATCH');
   const next=first(await list()).nextDueAt;assert.ok(new Date(next)>new Date());
   await request(owner.cookie,url+'/toggle','PATCH');
  }
  await request(owner.cookie,url,'PUT',{...values,recurrence:'none',notes:'保存確認'});
  await stop();await start();assert.equal(first(await list()).notes,'保存確認');
  // Month-end clamping uses the last valid day, never spills into a later month.
  const result=require('node:child_process').execFileSync(process.execPath,['-e',`const assert=require('node:assert/strict');const {nextDue}=require('./recurring');assert.equal(nextDue('monthly',new Date('2026-01-31T12:00:00Z')),'2026-02-28T12:00:00.000Z');assert.equal(nextDue('weekly',new Date('2026-01-01T12:00:00Z')),'2026-01-08T12:00:00.000Z');`],{cwd:path.join(__dirname,'..'),env:{...process.env,KAGOPITA_DATA_DIR:directory},stdio:'pipe'});
  console.log('PASS: item details, validation, preserved fields, soft-delete/restore, duplicate isolation, archive permissions, recurrence renew/pause/month-end, restart persistence');
  if(process.env.KAGOPITA_BROWSER_TEST==='1') {
   const {chromium}=require('playwright-core');
   browser=await chromium.launch({headless:true,executablePath:process.env.PW_EXECUTABLE_PATH,args:['--no-sandbox']});
   const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
   await context.addCookies([{name:'kagopita_session',value:owner.cookie.split('=')[1],url:base}]);
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base,{waitUntil:'networkidle'});await page.locator('.shopping-item').first().waitFor();
   // Select original list, exercise real form serialization and restore via touch.
   await page.locator('#shortcut-left').tap();
   await page.locator('.joined-channel-button').filter({has:page.locator('.joined-channel-name',{hasText:'週末'})}).tap();
   await openAdd(page);assert.equal(await page.locator('#inputDetails').getAttribute('open'),null);
   await page.locator('#inputName').fill('トマト');await page.locator('#inputQty').fill('3');
   await page.locator('#inputDetails > summary').tap();await page.locator('#inputNotes').fill('小さいもの');await page.locator('#inputPrice').fill('200');
   await page.locator('#inputRecurrence-trigger').tap();await page.locator('#inputRecurrence-options button').filter({hasText:'毎日'}).tap();
   await page.locator('#addForm [type=submit]').tap();await page.locator('#view-list').waitFor({state:'visible'});
   let row=page.locator('.shopping-item').filter({hasText:'トマト'});assert.ok((await row.textContent()).includes('小さいもの'));
   await row.locator('.item-edit-button').tap();await page.locator('#itemEditDialog').waitFor({state:'visible'});
   assert.equal(await page.locator('#editQty').inputValue(),'3個');assert.equal(await page.locator('#editPrice').inputValue(),'200');
   assert.equal(await page.locator('#editDetails').getAttribute('open'),null);
   await page.locator('#editDetails > summary').tap();
   await page.locator('#editNotes').fill('赤いもの');await page.locator('#saveItemButton').tap();await page.locator('#itemEditDialog').waitFor({state:'hidden'});
   row=page.locator('.shopping-item').filter({hasText:'トマト'});await row.locator('.delete-button').tap();
   await page.locator('#deletedItemsDetails > summary').tap();await page.locator('.deleted-item-row').filter({hasText:'トマト'}).getByRole('button').tap();
   await page.locator('.shopping-item').filter({hasText:'赤いもの'}).waitFor();
   await page.locator('#shortcut-left').tap();
   const managed=page.locator('.managed-list-row').filter({has:page.locator('.joined-channel-name',{hasText:'週末'})});
   await managed.locator('button[aria-label^="アーカイブ:"]').tap();
   await page.locator('#archivedListsDetails > summary').tap();
   await page.locator('#archivedChannelsList .managed-list-row').filter({hasText:'週末'}).locator('button[aria-label^="アーカイブを解除:"]').tap();
   await page.locator('#joinedChannelsList .managed-list-row').filter({hasText:'週末'}).locator('button[aria-label^="複製:"]').tap();
   await page.locator('#view-list').waitFor({state:'visible'});
   assert.equal(await page.locator('.shopping-item').filter({hasText:'トマト'}).count(),1);
   for(const theme of ['light','dark'])for(const width of [320,390,768]){
    await page.setViewportSize({width,height:844});await page.evaluate(t=>{document.documentElement.classList.toggle('dark-mode',t==='dark');document.body.classList.toggle('dark-mode',t==='dark');},theme);
    await page.locator('.shopping-item').filter({hasText:'トマト'}).locator('.item-edit-button').tap();await page.locator('#itemEditDialog').waitFor({state:'visible'});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    const bounds=await page.locator('#itemEditDialog').boundingBox();assert.ok(bounds.x>=0 && bounds.y>=0 && bounds.x+bounds.width<=width);
    await page.locator('#saveItemButton').scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/kagopita-features-${theme}-${width}.png`});
    await page.locator('#editDetails > summary').tap();
    await page.locator('#saveItemButton').scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/kagopita-features-expanded-${theme}-${width}.png`});
    await page.locator('#cancelItemEdit').tap();
   }
   for(const locale of ['en','ko','zh','es','ja']){await page.evaluate(locale=>applyLanguage(locale),locale);await openAdd(page);assert.ok(await page.locator('#inputDetails > summary').textContent());}
   assert.deepEqual(errors,[]);await browser.close();browser=null;
   console.log('PASS: real API touch flows: add/edit details, restore, archive/unarchive, duplicate, both-theme 320/390/768px, translations, no page errors');
  }
 }finally{if(browser)await browser.close();if(db)db.close();await stop();fs.rmSync(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});

// The selected Add tab is deliberately disabled; only navigate when leaving another tab.
async function openAdd(page) {
  const button = page.locator('#nav-add');
  if (await button.isDisabled()) assert.equal(await button.getAttribute('aria-current'), 'page');
  else await button.tap();
}
