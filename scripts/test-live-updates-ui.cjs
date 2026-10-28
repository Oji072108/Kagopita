const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const net=require('node:net');
const {chromium}=require('playwright');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kagopita-live-'));
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));
 const port=socket.address().port;await new Promise(r=>socket.close(r));
 const base=`http://127.0.0.1:${port}`;
 let child,browser;
 const start=async()=>{
  child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),KAGOPITA_DATA_DIR:directory,NODE_ENV:'test'},stdio:['ignore','ignore','ignore']});
  for(let i=0;i<100;i++){try{if((await fetch(base)).ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}
  throw Error('Server startup failed');
 };
 const stop=async()=>{if(child&&child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done;}};
 try{
  await start();
  async function request(cookie,url,method='GET',body){
   const r=await fetch(base+url,{method,headers:{Cookie:cookie||'','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
   const data=await r.json();assert.ok(r.ok,`${method} ${url}: ${JSON.stringify(data)}`);
   return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};
  }
  const account=name=>request('','/api/account','POST',{username:name,termsAccepted:true,termsVersion:require('../terms.json').version});
  const owner=await account('Owner'),member=await account('Member'),outsider=await account('Outsider');
  const {data:channel}=await request(owner.cookie,'/api/channels','POST',{name:'Realtime groceries'});
  const root=`/api/channels/${channel.id}`;
  const invite=await request(owner.cookie,root+'/invites','POST',{});
  await request(member.cookie,'/api/invites/accept','POST',{invite:invite.data.inviteCode});
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const errors=[];
  const open=async(cookie,noEvents=false)=>{
   const context=await browser.newContext();
   await context.addCookies([{name:'kagopita_session',value:cookie.split('=')[1],url:base}]);
   if(noEvents)await context.addInitScript(()=>{window.EventSource=undefined;});
   else await context.addInitScript(()=>{const Native=window.EventSource;window.EventSource=class extends Native{constructor(...args){super(...args);window.testStream=this;}};});
   const page=await context.newPage();if(noEvents)await page.clock.install();page.on('pageerror',e=>errors.push(e.message));
   await page.goto(base);await page.waitForFunction(()=>typeof currentUser!=='undefined'&&currentUser);
   if(!noEvents)await page.waitForFunction(()=>window.testStream?.readyState===1);
   return page;
  };
  const a=await open(owner.cookie),b=await open(member.cookie),other=await open(outsider.cookie);
  let navigations=0;b.on('framenavigated',frame=>{if(frame===b.mainFrame())navigations++;});
  const add=async(name)=> (await request(owner.cookie,root+'/items','POST',{name,category:'Other',qty:'1'})).data.item;
  const has=async(page,name)=>page.waitForFunction(name=>shoppingData?.categories.some(c=>c.items.some(i=>i.name===name)),name,{timeout:5000});
  const item=await add('Live milk');await has(b,'Live milk');await has(a,'Live milk');
  assert.equal(await other.evaluate(()=>currentChannelId),null,'Other users cannot see this list');
  await request(owner.cookie,root+`/items/${item.id}/toggle`,'PATCH');
  await b.waitForFunction(id=>shoppingData.categories.some(c=>c.items.some(i=>i.id===id&&i.completed)),item.id,{timeout:5000});
  await request(owner.cookie,root+`/items/${item.id}`,'PUT',{name:'Edited milk',category:'Other',qty:'2'});await has(b,'Edited milk');
  await request(owner.cookie,root+`/items/${item.id}`,'DELETE');
  await b.waitForFunction(id=>shoppingData.deletedItems.some(i=>i.id===id),item.id,{timeout:5000});
  await request(owner.cookie,root+`/items/${item.id}/restore`,'POST');await has(b,'Edited milk');
  await b.evaluate(()=>switchTab('add'));
  await b.locator('#inputName').fill('Unfinished draft');
  await request(owner.cookie,root+`/items/${item.id}/favorite`,'PUT');
  await b.waitForFunction(()=>document.querySelector('#favoritesContainer .favorite-name')?.textContent.includes('Edited'),null,{timeout:5000});
  assert.equal(await b.locator('#inputName').inputValue(),'Unfinished draft');
  await b.evaluate(()=>switchTab('members'));
  await b.evaluate(()=>{window.liveMemberNode=document.querySelector('#membersContainer').firstElementChild;KagopitaDialogs.notice('Live updates wait for this dialog');});
  const invite2=await request(owner.cookie,root+'/invites','POST',{});
  const newcomer=await account('New member');await request(newcomer.cookie,'/api/invites/accept','POST',{invite:invite2.data.inviteCode});
  await b.waitForTimeout(300);
  assert.equal(await b.evaluate(()=>window.liveMemberNode.isConnected),true,'Live refresh preserves the dialog focus target');
  await b.locator('#actionDialogSubmit').click();
  await b.waitForFunction(()=>document.querySelector('#membersContainer').textContent.includes('New member'),null,{timeout:5000});
  await b.context().setOffline(true);await add('Offline change');await b.context().setOffline(false);await has(b,'Offline change');
  await stop();await start();await b.waitForFunction(()=>window.testStream?.readyState===1,null,{timeout:10000});
  await add('After restart');await has(b,'After restart');
  const fallback=await open(member.cookie,true);
  await fallback.waitForTimeout(250);await add('Polling change');await fallback.clock.fastForward(15000);await fallback.clock.runFor(300);await has(fallback,'Polling change');
  await request(owner.cookie,root+'/archive','PATCH',{archived:true});
  await b.waitForFunction(()=>currentChannelId===null,null,{timeout:5000});
  assert.equal(await b.locator('#nav-add').isVisible(),false);
  assert.equal(navigations,0,'All updates happen without reloading the page');
  assert.deepEqual(errors,[]);
  console.log('PASS: real SSE between separate users; add/edit/check/delete/restore, favorites and members; draft preserved; offline/reconnect and server restart catch-up; polling without EventSource; archive navigation; private list isolation; no reloads or browser errors.');
 }finally{await browser?.close();await stop();fs.rmSync(directory,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1);});
