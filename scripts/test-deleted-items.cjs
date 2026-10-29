const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net');
const {DatabaseSync}=require('node:sqlite');
const terms=require('../terms.json');
(async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kagopita-deleted-api-'));
  const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
  const base='http://127.0.0.1:'+port;
  let child,db;
  const start=async()=>{
    child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),KAGOPITA_DATA_DIR:directory},stdio:'ignore'});
    for(let i=0;i<100;i++){try{if((await fetch(base)).ok)return;}catch{}await new Promise(r=>setTimeout(r,50));}throw Error('Startup failed');
  };
  const stop=async()=>{if(child&&child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}};
  const req=async(cookie,url,method='GET',body,status=200)=>{
    const r=await fetch(base+url,{method,headers:{Cookie:cookie||'','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};
  };
  try{
    await start();db=new DatabaseSync(path.join(directory,'kagopita.sqlite'));
    const account=async username=>req('','/api/account','POST',{username,termsAccepted:true,termsVersion:terms.version},201);
    const owner=await account('Owner'),editor=await account('Editor'),member=await account('Member'),outsider=await account('Outsider');
    const channel=(await req(owner.cookie,'/api/channels','POST',{name:'Recycle bin'},201)).data;
    const root='/api/channels/'+channel.id;
    for(const user of [editor,member]){
      const invite=(await req(owner.cookie,root+'/invites','POST',{})).data;
      await req(user.cookie,'/api/invites/accept','POST',{invite:invite.inviteCode});
    }
    await req(owner.cookie,root+'/members/'+editor.data.user.id+'/role','PATCH',{role:'editor'});
    const add=async()=>root+'/items/'+(await req(owner.cookie,root+'/items','POST',{name:'Milk',category:'Dairy',qty:'2',notes:'Keep',price:100},201)).data.item.id;
    let item=await add();await req(owner.cookie,item,'DELETE');
    const deleted=(await req(owner.cookie,root+'/shopping-list')).data;
    assert.equal(Date.parse(deleted.deletedItems[0].expiresAt)-Date.parse(deleted.deletedItems[0].deletedAt),86400000);
    assert.ok(deleted.serverNow);
    await req(member.cookie,item+'/restore','POST',{},403);
    await req(member.cookie,item+'/permanent','DELETE',undefined,403);
    await req(outsider.cookie,item+'/permanent','DELETE',undefined,403);
    await req(editor.cookie,item+'/restore','POST');
    let restored=(await req(owner.cookie,root+'/shopping-list')).data;
    assert.equal(restored.deletedItems.length,0);assert.equal(restored.categories[0].items[0].notes,'Keep');
    await req(owner.cookie,item+'/permanent','DELETE',undefined,404);
    await req(owner.cookie,item,'DELETE');await req(editor.cookie,item+'/permanent','DELETE');
    await req(owner.cookie,item+'/restore','POST',{},404);
    assert.equal(db.prepare('SELECT id FROM shopping_items WHERE id=?').get(Number(item.split('/').at(-1))),undefined);
    item=await add();await req(owner.cookie,item,'DELETE');
    await req(owner.cookie,root+'/archive','PATCH',{archived:true});
    await req(owner.cookie,item+'/permanent','DELETE',undefined,409);
    await req(owner.cookie,root+'/archive','PATCH',{archived:false});
    db.prepare('UPDATE shopping_items SET deleted_at=? WHERE id=?').run(new Date(Date.now()-86400001).toISOString(),Number(item.split('/').at(-1)));
    await req(owner.cookie,item+'/restore','POST',{},404);
    assert.equal((await req(owner.cookie,root+'/shopping-list')).data.deletedItems.length,0);
    item=await add();await req(owner.cookie,item,'DELETE');
    await stop();db.prepare('UPDATE shopping_items SET deleted_at=? WHERE id=?').run(new Date(Date.now()-86400001).toISOString(),Number(item.split('/').at(-1)));
    await start();assert.equal(db.prepare('SELECT id FROM shopping_items WHERE id=?').get(Number(item.split('/').at(-1))),undefined,'Restart purges overdue items');
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    console.log('PASS: expiry timestamps; owner/editor recovery and permanent deletion; member/outsider denial; active/archived protection; expired restore blocked; startup cleanup; database integrity.');
  }finally{await stop();db?.close();fs.rmSync(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
