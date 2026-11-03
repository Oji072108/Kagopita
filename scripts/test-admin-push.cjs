const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kagopita-admin-push-'));
process.env.KAGOPITA_DATA_DIR=directory;process.env.KAGOPITA_ADMIN_USER_ID='owner';process.env.KAGOPITA_ADMIN_EMAIL='owner@example.test';
const {db,createSession,sessionHash,now}=require('../database');
const sent=[];require('web-push').sendNotification=async(subscription,payload,options)=>sent.push({subscription,payload:JSON.parse(payload),options});
const push=require('../push');
(async()=>{try{
 for(const id of ['owner','other']){
  db.prepare('INSERT INTO users(id,username,email,email_verified,created_at) VALUES (?,?,?,1,?)').run(id,id,id+'@example.test',now());
  const session=createSession(id);
  db.prepare('INSERT INTO push_devices(endpoint,p256dh,auth,session_hash,user_id,created_at) VALUES (?,?,?,?,?,?)').run('https://fcm.googleapis.com/'+id,'fixture','fixture',sessionHash(session.token),id,Date.now());
 }
 const incident={id:'incident',title:'Critical alert',body:'Fixed safe summary'};
 assert.equal(push.enqueueAdminAlert('other',incident),0);assert.equal(push.enqueueAdminAlert('owner',incident),1);
 await push.flush();assert.equal(sent.length,1);assert.match(sent[0].subscription.endpoint,/owner$/);assert.equal(sent[0].payload.url,'/admin');assert.equal(sent[0].options.urgency,'high');
 push.enqueueAdminAlert('owner',incident);db.prepare('UPDATE users SET email_verified=0 WHERE id=?').run('owner');await push.flush();assert.equal(sent.length,1,'Recheck ownership before delivery');
 db.prepare('UPDATE users SET email_verified=1 WHERE id=?').run('owner');push.enqueueAdminAlert('owner',incident);
 db.prepare('UPDATE push_devices SET user_id=?,session_hash=? WHERE user_id=?').run('other',db.prepare('SELECT token_hash FROM sessions WHERE user_id=?').get('other').token_hash,'owner');
 await push.flush();assert.equal(sent.length,1,'Transferred device cannot receive admin alert');
 console.log('PASS: admin push goes only to verified configured owner; high-priority admin destination; queued ownership recheck; transferred-device isolation.');
}finally{db.close();fs.rmSync(directory,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
