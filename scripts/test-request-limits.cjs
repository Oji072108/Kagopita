const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), net = require('node:net');
const terms = require('../terms.json');
(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(),'kagopita-rate-'));
  const socket = net.createServer(); await new Promise(r=>socket.listen(0,'127.0.0.1',r));
  const port=socket.address().port; await new Promise(r=>socket.close(r));
  const base='http://127.0.0.1:'+port;
  const child=spawn(process.execPath,['server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),KAGOPITA_DATA_DIR:directory,SMTP_USER:'',SMTP_PASS:''},stdio:'pipe'});
  let logs='';child.stderr.on('data',b=>{logs+=b;});
  const req=async(cookie,url,method='GET',body)=>{
    const response=await fetch(base+url,{method,headers:{Cookie:cookie||'','Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
    return {status:response.status,data:await response.json(),headers:response.headers,cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  const limited=response=>{
    assert.equal(response.status,429);assert.equal(response.data.code,'RATE_LIMITED');
    assert.ok(Number(response.headers.get('Retry-After'))>=1);
    assert.equal(Number(response.headers.get('Retry-After')),response.data.retryAfter);
    assert.equal(response.headers.get('Cache-Control'),'no-store');
  };
  try {
    let ready=false;
    for(let i=0;i<100;i++){try{if((await fetch(base)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,50));}
    assert.ok(ready,logs);
    const account=async username=>{const r=await req('','/api/account','POST',{username,termsAccepted:true,termsVersion:terms.version});assert.equal(r.status,201);return r.cookie;};
    const a=await account('One'), b=await account('Two');
    const setup=async cookie=>{
      const channel=await req(cookie,'/api/channels','POST',{name:'Rate tests'});assert.equal(channel.status,201);
      const root='/api/channels/'+channel.data.id;
      const item=await req(cookie,root+'/items','POST',{name:'Milk',category:'Dairy',qty:'1'});assert.equal(item.status,201);
      return {root,item:root+'/items/'+item.data.item.id};
    };
    const first=await setup(a), second=await setup(b);
    for(let i=0;i<12;i++)assert.equal((await req(a,first.item+'/toggle','PATCH')).status,200);
    limited(await req(a,first.item+'/toggle','PATCH'));
    const state=(await req(a,first.root+'/shopping-list')).data;
    assert.equal(state.categories[0].items[0].completed,false,'Rejected toggle does not change state');
    const other=await req(a,first.root+'/items','POST',{name:'Bread',category:'Dairy',qty:'1'});
    limited(await req(a,first.root+'/items/'+other.data.item.id+'/toggle','PATCH'));
    assert.equal((await req(b,second.item+'/toggle','PATCH')).status,200,'Another user is independent');
    for(let i=0;i<65;i++)assert.equal((await req(a,first.root+'/shopping-list')).status,200,'Reads are not throttled');
    await new Promise(r=>setTimeout(r,5100));
    assert.equal((await req(a,first.item+'/toggle','PATCH')).status,200,'Toggle recovers after cooldown');
    assert.equal((await req(b,'/api/resend-verification','POST',{email:'invalid'})).status,400);
    limited(await req(b,'/api/password-reset/request','POST',{email:'different@example.test'}));
    limited(await req(b,second.root+'/email-invites','POST',{email:'invite@example.test'}));
    let response;
    for(let i=0;i<65;i++){
      response=await req(a,'/api/profile','POST',{username:'Renamed'});
      if(response.status===429)break;
      assert.equal(response.status,200);
    }
    limited(response);
    limited(await req(a,'/api/channels','POST',{name:'Blocked'}));
    assert.equal((await req(a,'/api/me')).data.channels.length,1,'Blocked create has no side effects');
    assert.ok(!logs.includes('ValidationError'),logs);
    console.log('PASS: real API 429/Retry-After; no rejected toggle/create side effects; cross-item/email-path limits; user isolation; read access; cooldown recovery; general write limits.');
  } finally {
    if(child.exitCode===null){child.kill('SIGTERM');await new Promise(r=>child.once('exit',r));}
    fs.rmSync(directory,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
