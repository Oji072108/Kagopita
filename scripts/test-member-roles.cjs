const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const net = require('node:net');
const {DatabaseSync} = require('node:sqlite');
const {chromium} = require('playwright');
(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'kagopita-roles-'));
  // A real legacy schema verifies the constrained-column migration as well as data preservation.
  const legacy = new DatabaseSync(path.join(directory, 'kagopita.sqlite'));
  legacy.exec(`CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE channels (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE channel_members (channel_id TEXT NOT NULL REFERENCES channels(id), user_id TEXT NOT NULL REFERENCES users(id),
      role TEXT NOT NULL CHECK(role IN ('admin','member')), joined_at TEXT NOT NULL, PRIMARY KEY(channel_id,user_id));
    INSERT INTO users VALUES ('legacy-owner','Legacy owner','2020'),('legacy-member','Legacy member','2020');
    INSERT INTO channels VALUES ('legacy','Legacy list','2020');
    INSERT INTO channel_members VALUES ('legacy','legacy-owner','admin','2020'),('legacy','legacy-member','member','2020');`);
  legacy.close();
  const socket = net.createServer(); await new Promise(r => socket.listen(0,'127.0.0.1',r));
  const port = socket.address().port; await new Promise(r => socket.close(r));
  const base = `http://127.0.0.1:${port}`;
  let child, browser;
  const start = async () => {
    child = spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'), env:{...process.env,PORT:String(port),KAGOPITA_DATA_DIR:directory,NODE_ENV:'test'},stdio:'ignore'});
    for(let i=0;i<100;i++) { try {if((await fetch(base)).ok)return;}catch{} await new Promise(r=>setTimeout(r,50)); }
    throw Error('Server failed to start');
  };
  const stop = async () => { if(child && child.exitCode === null) { child.kill('SIGTERM'); await new Promise(r=>child.once('exit',r)); } };
  const request = async (cookie,url,method='GET',body,expected=200) => {
    if(url==='/api/account'&&method==='POST') body={...body,termsAccepted:true,termsVersion:require('../terms.json').version};
    const response=await fetch(base+url,{method,headers:{Cookie:cookie||'','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    assert.equal(response.status,expected,`${method} ${url}: ${await response.clone().text()}`);
    return {data:await response.json(),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  try {
    await start();
    const db=new DatabaseSync(path.join(directory,'kagopita.sqlite'));
    assert.deepEqual(db.prepare('SELECT role FROM channel_members WHERE channel_id = ? ORDER BY user_id').all('legacy').map(r=>r.role),['editor','owner']);
    db.close();
    const account=async username=>request('','/api/account','POST',{username},201);
    const owner=await account('Owner'), editor=await account('Editor'), viewer=await account('<Viewer>'), outsider=await account('Outsider');
    const {data:channel}=await request(owner.cookie,'/api/channels','POST',{name:'Shared groceries'},201);
    assert.equal(channel.role,'owner');
    const root=`/api/channels/${channel.id}`;
    for(const user of [editor,viewer]) {
      const {data:invite}=await request(owner.cookie,root+'/invites','POST',{});
      await request(user.cookie,'/api/invites/accept','POST',{invite:invite.inviteCode});
    }
    assert.equal((await request(editor.cookie,root+'/members')).data.members.find(m=>m.id===editor.data.user.id).role,'member','New joins default to member');
    await request(owner.cookie,root+`/members/${editor.data.user.id}/role`,'PATCH',{role:'editor'});
    const roleUrl=root+`/members/${viewer.data.user.id}/role`;
    await request(owner.cookie,roleUrl,'PATCH',{role:'member'});
    await request(editor.cookie,roleUrl,'PATCH',{role:'owner'},403);
    await request(viewer.cookie,roleUrl,'PATCH',{role:'editor'},403);
    await request(outsider.cookie,roleUrl,'PATCH',{role:'member'},403);
    await request(owner.cookie,roleUrl,'PATCH',{role:'bad'},400);
    await request(owner.cookie,root+`/members/${owner.data.user.id}/role`,'PATCH',{role:'member'},400);
    await request(owner.cookie,root+`/members/${outsider.data.user.id}/role`,'PATCH',{role:'member'},404);
    const values={name:'Milk',category:'Dairy',qty:'2',notes:'Keep chilled',price:200};
    const {data:created}=await request(editor.cookie,root+'/items','POST',values,201);
    const item=root+`/items/${created.item.id}`;
    for(const [method,url,body] of [
      ['POST',root+'/items',values],['PUT',item,values],['DELETE',item],
      ['PUT',item+'/favorite'],['DELETE',item+'/favorite'],['POST',item+'/restore'],
      ['POST',root+'/favorites/1/add'],['DELETE',root+'/favorites/1'],
      ['POST',root+'/invites',{}],['PATCH',root+'/archive',{archived:true}],
      ['DELETE',root+`/members/${editor.data.user.id}`],['POST',root+'/complete',{}]
    ]) await request(viewer.cookie,url,method,body,403);
    const inbox=async user=>(await request(user.cookie,'/api/notifications')).data;
    assert.equal((await inbox(editor)).notifications.length,0,'Actor receives no self notification');
    assert.equal((await inbox(owner)).unreadCount,1);
    assert.equal((await inbox(viewer)).notifications[0].action,'added');
    assert.equal((await inbox(outsider)).notifications.length,0);
    await request(viewer.cookie,item+'/toggle','PATCH');
    let list=(await request(viewer.cookie,root+'/shopping-list')).data;
    assert.equal(list.categories[0].items[0].completed,true);
    assert.equal((await inbox(editor)).notifications[0].action,'completed');
    await request(editor.cookie,item,'PUT',{...values,name:'Oat milk'});
    await request(editor.cookie,item,'DELETE'); await request(editor.cookie,item+'/restore','POST');
    assert.deepEqual((await inbox(viewer)).notifications.map(n=>n.action),['restored','deleted','edited','added']);
    const latest=(await inbox(viewer)).notifications[0].id;
    await request(viewer.cookie,'/api/notifications/read','POST',{throughId:latest});
    assert.equal((await inbox(viewer)).unreadCount,0);
    assert.ok((await inbox(owner)).unreadCount>0,'Read state is per user');
    await stop(); await start();
    assert.equal((await inbox(viewer)).unreadCount,0,'Read state survives restart');
    assert.equal((await inbox(viewer)).notifications.length,0,'Cleared inbox stays empty after restart');
    browser=await chromium.launch({headless:true,args:['--no-sandbox']});
    const errors=[];
    const open=async user=>{
      const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,reducedMotion:'reduce'});
      await context.addCookies([{name:'kagopita_session',value:user.cookie.split('=')[1],url:base}]);
      const page=await context.newPage(); page.on('pageerror',e=>errors.push(e.message));
      await page.goto(base); await page.waitForFunction(()=>currentChannelId);
      await page.evaluate(()=>applyLanguage('en')); return page;
    };
    const v=await open(viewer), o=await open(owner);
    await o.evaluate(async()=>{await switchTab('add'); await refreshChannels();});
    assert.equal(await o.locator('#nav-add').isDisabled(),true,'Refresh cannot re-enable the selected Add tab');
    await o.evaluate(()=>switchTab('list'));
    assert.equal(await v.locator('#nav-add').isDisabled(),true);
    assert.equal(await v.locator('.item-edit-button').count(),0);
    assert.equal(await v.locator('.delete-button').count(),0);
    await v.locator('.check-button').click();
    await v.waitForFunction(()=>document.querySelector('.check-button')?.getAttribute('aria-pressed')==='true');
    await o.evaluate(()=>switchTab('members'));
    const selector=o.locator('.member-row').filter({hasText:'<Viewer>'}).locator('select');
    const roleTrigger = selector.locator('..').locator('.custom-select-trigger');
    await roleTrigger.click();
    await o.evaluate(()=>loadMembers());
    assert.equal(await roleTrigger.getAttribute('aria-expanded'),'true','Live refresh preserves an open role picker');
    await o.screenshot({path:'/tmp/kagopita-picker-open.png'});
    await selector.locator('..').getByRole('option',{name:'Editor',exact:true}).click();
    await v.waitForFunction(()=>!document.querySelector('#nav-add').disabled);
    await v.locator('.item-edit-button').waitFor();
    assert.equal(await v.locator('.item-edit-button').count(),1);
    await o.waitForFunction(()=>!window.KagopitaActions.busy);
    await roleTrigger.click();
    await selector.locator('..').getByRole('option').first().click();
    await v.waitForFunction(()=>document.querySelector('#nav-add').disabled && !document.querySelector('.item-edit-button'));
    await request(editor.cookie,item,'PUT',{...values,name:'Live milk change'});
    await v.waitForFunction(()=>!document.querySelector('#notificationCount').classList.contains('hidden'));
    await v.locator('#notificationsButton').click();
    await v.locator('#notificationsList').getByText(/Live milk change/).waitFor();
    assert.equal(await v.locator('#notificationsDialog script').count(),0);
    for(const width of [320,390,768]) for(const language of ['ja','en','ko','zh','es']) for(const dark of [false,true]) {
      await v.setViewportSize({width,height:844});
      await v.evaluate(({language,dark})=>{applyLanguage(language);document.documentElement.classList.toggle('dark-mode',dark);},{language,dark});
      assert.ok(await v.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width} ${language} ${dark}: no page overflow`);
      const bounds=await v.locator('#notificationsDialog').boundingBox();
      assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width+1,'Inbox fits mobile viewport');
      if(width===390 && language==='en') await v.screenshot({path:`/tmp/kagopita-notifications-${dark?'dark':'light'}.png`});
    }
    await o.evaluate(()=>applyLanguage('en'));
    await o.screenshot({path:'/tmp/kagopita-member-roles.png'});
    await v.locator('#readNotifications').click();
    await v.waitForFunction(()=>document.querySelector('#notificationCount').classList.contains('hidden'));
    await v.reload(); await v.waitForFunction(()=>currentChannelId);
    assert.equal(await v.locator('#notificationCount').isVisible(),false,'Read state survives browser reload');
    assert.deepEqual(errors,[]);
    // Server pagination covers more than two pages; clearing is scoped and preserves new arrivals.
    for(let i=0;i<24;i++) await request(editor.cookie,item,'PUT',{...values,name:`Paged ${i}`});
    await v.evaluate(()=>applyLanguage('en'));
    await v.locator('#notificationsButton').click();
    await v.waitForFunction(()=>document.querySelector('#notificationsPage').textContent==='1 / 3');
    assert.equal(await v.locator('.notification-entry').count(),10);
    await v.locator('#notificationsNext').click();
    await v.waitForFunction(()=>document.querySelector('#notificationsPage').textContent==='2 / 3');
    await v.locator('#notificationsNext').click();
    await v.waitForFunction(()=>document.querySelector('#notificationsPage').textContent==='3 / 3');
    assert.equal(await v.locator('#notificationsNext').isDisabled(),true);
    for(const dark of [false,true]) {
      await v.setViewportSize({width:390,height:844});
      await v.evaluate(dark=>document.documentElement.classList.toggle('dark-mode',dark),dark);
      await v.screenshot({path:`/tmp/kagopita-inbox-paged-${dark?'dark':'light'}.png`,animations:'disabled'});
    }
    await v.waitForFunction(()=>!window.KagopitaActions.busy);
    await v.locator('#notificationsButton').click();
    assert.equal(await v.locator('#notificationsButton').getAttribute('aria-expanded'),'false');
    await v.locator('#notificationsButton').click(); await v.keyboard.press('Escape');
    assert.equal(await v.locator('#notificationsButton').getAttribute('aria-expanded'),'false');
    const first=(await inbox(viewer));
    assert.equal(first.notifications.length,10); assert.equal(first.totalPages,3);
    const second=(await request(viewer.cookie,'/api/notifications?page=2')).data;
    const third=(await request(viewer.cookie,'/api/notifications?page=3')).data;
    assert.equal(second.notifications.length,10); assert.ok(third.notifications.length>0);
    assert.equal(new Set([...first.notifications,...second.notifications,...third.notifications].map(n=>n.id)).size,first.total);
    await request(editor.cookie,item,'PUT',{...values,name:'Arrived during clearing'});
    await request(viewer.cookie,'/api/notifications/read','POST',{throughId:first.latestId});
    assert.equal((await inbox(viewer)).total,1,'New arrival survives clearing older notifications');
    await request(owner.cookie,root+`/members/${editor.data.user.id}/role`,'PATCH',{role:'admin'});
    await request(editor.cookie,roleUrl,'PATCH',{role:'editor'});
    await request(editor.cookie,roleUrl,'PATCH',{role:'admin'},403);
    await request(editor.cookie,root+`/members/${owner.data.user.id}/role`,'PATCH',{role:'member'},403);
    await request(editor.cookie,root+`/members/${owner.data.user.id}`,'DELETE',undefined,403);
    await request(owner.cookie,root+`/members/${outsider.data.user.id}/role`,'PATCH',{role:'owner'},400);
    // Administrators leaving never deletes or transfers the creator's list.

    await request(editor.cookie,root+'/membership','DELETE');
    assert.equal((await request(owner.cookie,root+'/members')).data.members.find(m=>m.id===owner.data.user.id).role,'owner');
    await request(owner.cookie,root+'/membership','DELETE');
    await request(viewer.cookie,root+'/members','GET',undefined,403);
    assert.equal((await inbox(viewer)).notifications.length,0,'Creator departure deletes list notifications');
    const {data:deletable}=await request(owner.cookie,'/api/channels','POST',{name:'Account removal'},201);
    const {data:guestInvite}=await request(owner.cookie,`/api/channels/${deletable.id}/invites`,'POST',{});
    const guest=await request('','/api/session','POST',{username:'New guest',invite:guestInvite.inviteCode,termsAccepted:true,termsVersion:require('../terms.json').version});
    assert.equal(guest.data.role,'member','Guest invite joins also default to member');
    await request(owner.cookie,'/api/account','DELETE');
    const check=new DatabaseSync(path.join(directory,'kagopita.sqlite'));
    assert.equal(check.prepare('SELECT id FROM channels WHERE id = ?').get(deletable.id),undefined);
    assert.equal(check.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    assert.deepEqual(check.prepare('PRAGMA foreign_key_check').all(),[]); check.close();
    console.log('PASS: legacy migration; role validation, member-only checks, editor writes, creator deletion and administrator protections; notification privacy/clear/pagination/persistence; real SSE permission updates and inbox; 30 mobile/language/theme inbox layouts; no browser errors.');
  } finally { await browser?.close(); await stop(); fs.rmSync(directory,{recursive:true,force:true}); }
})().catch(error=>{console.error(error);process.exitCode=1;});
