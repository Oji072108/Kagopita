const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {mock}=require('node:test');
const {createAdminMonitor}=require('../admin');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kagopita-monitor-'));
 const mail=[],push=[];let failed=false;
 const db={prepare:()=>({get:()=>{if(failed)throw Error('sensitive-token-must-not-leak');return {'1':1};}})};
 const monitor=createAdminMonitor({db,dataDirectory:directory,ownerId:'owner',ownerEmail:'owner@example.test',
  mailer:{sendMail:async message=>mail.push(message)},sessionToken:()=>'',verifyPassword:async()=>true,pushAlert:(id,incident)=>{push.push({id,incident});return 1;}});
 const settle=()=>new Promise(r=>setImmediate(r));
 try{
  assert.ok(monitor.isOwner({id:'owner',email:'owner@example.test',emailVerified:true}));
  for(const user of [{id:'other',email:'owner@example.test',emailVerified:true},{id:'owner',email:'owner@example.test',emailVerified:false},{id:'owner',email:'changed@example.test',emailVerified:true}])assert.equal(monitor.isOwner(user),false);
  monitor.critical('test','Fixed safe summary');await settle();assert.equal(mail.length,1);assert.equal(push[0].id,'owner');
  monitor.critical('test','Fixed safe summary');await settle();assert.equal(mail.length,1,'Repeated critical incident is deduplicated');
  assert.equal(monitor.snapshot().incidents[0].count,2);assert.equal(mail[0].to,'owner@example.test');
  failed=true;assert.equal(monitor.sample().status,'critical');await settle();
  assert.equal(mail.length,2,'DB outage still sends through independent mail transport');
  assert.ok(!JSON.stringify(monitor.snapshot()).includes('sensitive-token-must-not-leak'));
  failed=false;monitor.sample();assert.ok(monitor.snapshot().incidents.find(i=>i.code==='database').resolvedAt);
  for(let i=0;i<10;i++){
    const response=new(require('node:events').EventEmitter)();response.statusCode=401;
    monitor.observe({path:'/api/login',method:'POST',body:{password:'never-log-this-password'}},response,()=>{});response.emit('finish');
  }
  await settle();assert.equal(mail.length,3,'Login failure spike generates one private alert');
  assert.ok(!JSON.stringify(monitor.snapshot()).includes('never-log-this-password'));
  monitor.stop();assert.ok(fs.statSync(path.join(directory,'admin-monitor.json')).mode&0o600);
  const disabled=createAdminMonitor({db,dataDirectory:directory,sessionToken:()=>'',pushAlert:()=>{throw Error('unexpected');}});
  disabled.critical('x','safe');assert.equal(disabled.snapshot().incidents.length,0);disabled.stop();
  console.log('PASS: immutable verified owner identity; alert-only recipient; critical deduplication; DB-failure fallback; redacted summaries; recovery; private persistence; unconfigured fail-closed.');
 }finally{monitor.stop();fs.rmSync(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
