const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const {spawn} = require('node:child_process');
const {DatabaseSync} = require('node:sqlite');
(async () => {
 const root=path.resolve(__dirname,'..'), fixture=fs.mkdtempSync(path.join(os.tmpdir(),'kagopita-terms-'));
 let child,db;
 try {
  for(const name of ['server.js','database.js','terms.js','terms.json','realtime.js','recurring.js','notifications.js'])fs.copyFileSync(path.join(root,name),path.join(fixture,name));
  for(const name of ['node_modules','routes','public'])fs.symlinkSync(path.join(root,name),path.join(fixture,name),'dir');
  fs.writeFileSync(path.join(fixture,'mail-stub.cjs'),`const fs=require('node:fs'); require('nodemailer').createTransport=()=>({sendMail:async mail=>{if(fs.existsSync('fail-mail'))throw Error('Test mail failure');fs.writeFileSync('mail.json',JSON.stringify(mail));return {};}});`);
  const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));
  const base=`http://127.0.0.1:${port}`;
  child=spawn(process.execPath,['-r','./mail-stub.cjs','server.js'],{cwd:fixture,env:{...process.env,PORT:String(port),KAGOPITA_DATA_DIR:path.join(fixture,'data'),SMTP_USER:'test@example.invalid',SMTP_PASS:'test',NODE_ENV:'test'},stdio:['ignore','ignore','ignore']});
  for(let i=0;i<100;i++){try{if((await fetch(base+'/api/terms')).ok)break;}catch{}await new Promise(r=>setTimeout(r,50));}
  async function req(url,body,cookie='',status=200){const response=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',Cookie:cookie},body:body===undefined?undefined:JSON.stringify(body)});const data=await response.json();assert.equal(response.status,status,`${url}: ${JSON.stringify(data)}`);return {data,cookie:response.headers.get('set-cookie')?.split(';')[0]};}
  const terms=(await req('/api/terms')).data;
  assert.equal(terms.notify,false);
  const values={username:'Test',email:'register@example.invalid',password:'test-password-123'};
  for(const consent of [{},{termsAccepted:false,termsVersion:terms.version},{termsAccepted:'true',termsVersion:terms.version},{termsAccepted:true,termsVersion:'old'}])assert.equal((await req('/api/register',{...values,...consent},'',400)).data.code,'TERMS_ACCEPTANCE_REQUIRED');
  const acceptance={termsAccepted:true,termsVersion:terms.version};
  await req('/api/register',{...values,...acceptance},'',201);
  db=new DatabaseSync(path.join(fixture,'data/kagopita.sqlite'));
  const registered=db.prepare('SELECT * FROM users WHERE email = ?').get(values.email);
  assert.equal(registered.terms_accepted_version,terms.version);assert.ok(Date.parse(registered.terms_accepted_at));
  const mail=JSON.parse(fs.readFileSync(path.join(fixture,'mail.json'))),code=mail.text.match(/確認コード：(\d{6})/)[1];
  const account=(await req('/api/verify-email',{email:values.email,code})).cookie;assert.ok(account);
  await req('/api/account',{username:'Guest'},'',400);
  await req('/api/account',{username:'Guest',termsAccepted:true,termsVersion:'old'},'',400);
  const guest=await req('/api/account',{username:'Guest',...acceptance},'',201);
  assert.equal((await req('/api/terms',undefined,guest.cookie)).data.notify,false);
  assert.equal(db.prepare('SELECT terms_accepted_version FROM users WHERE id = ?').get(guest.data.user.id).terms_accepted_version,terms.version);
  await req('/api/account/credentials',{email:'upgrade@example.invalid',password:values.password},guest.cookie,400);
  await req('/api/account/credentials',{email:'upgrade@example.invalid',password:values.password,...acceptance},guest.cookie);
  assert.equal(db.prepare('SELECT terms_accepted_version FROM users WHERE id = ?').get(guest.data.user.id).terms_accepted_version,terms.version);
  const plainGuest=await req('/api/account',{username:'Plain guest',...acceptance},'',201);
  const channel=await req('/api/channels',{name:'Invite test'},guest.cookie,201);
  const invite=await req(`/api/channels/${channel.data.id}/invites`,{},guest.cookie);
  const inviteValues={username:'Invited guest',invite:invite.data.inviteCode};
  await req('/api/session',inviteValues,'',400);
  await req('/api/session',{...inviteValues,termsAccepted:true,termsVersion:'old'},'',400);
  await req('/api/session',inviteValues,'kagopita_session=expired',400);
  const joined=await req('/api/session',{...inviteValues,...acceptance});
  const invitedUser=(await req('/api/me',undefined,joined.cookie)).data.user;
  assert.equal(db.prepare('SELECT terms_accepted_version FROM users WHERE id = ?').get(invitedUser.id).terms_accepted_version,terms.version);
  const secondInvite=await req(`/api/channels/${channel.data.id}/invites`,{},guest.cookie);
  await req('/api/session',{username:'Existing account',invite:secondInvite.data.inviteCode},account);

  const updated={...terms,version:'test-v2',summary:'Test update'};fs.writeFileSync(path.join(fixture,'terms.json'),JSON.stringify(updated));
  for(const cookie of [account,guest.cookie,plainGuest.cookie]){
   assert.equal((await req('/api/terms',undefined,cookie)).data.notify,true);
   await req('/api/terms/seen',{version:terms.version},cookie,409);
   await req('/api/terms/seen',{version:updated.version},cookie);
   assert.equal((await req('/api/terms',undefined,cookie)).data.notify,false);
  }
  assert.equal(db.prepare('SELECT terms_accepted_version FROM users WHERE id = ?').get(plainGuest.data.user.id).terms_accepted_version,terms.version,'Dismissal never changes guest consent');
  assert.equal(db.prepare('SELECT terms_accepted_version FROM users WHERE id = ?').get(registered.id).terms_accepted_version,terms.version,'Dismissal never changes account consent');
  await req('/api/terms/seen',{version:updated.version},'',401);
  await req('/api/register',{...values,email:'stale@example.invalid',...acceptance},'',400);
  fs.writeFileSync(path.join(fixture,'fail-mail'),'yes');
  await req('/api/register',{...values,email:'failure@example.invalid',termsAccepted:true,termsVersion:updated.version},'',502);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM users WHERE email = ?').get('failure@example.invalid').n,0);
  await req('/api/account/credentials',{email:'failure-upgrade@example.invalid',password:values.password,termsAccepted:true,termsVersion:updated.version},plainGuest.cookie,502);
  const failed=db.prepare('SELECT email, terms_accepted_version FROM users WHERE id = ?').get(plainGuest.data.user.id);assert.equal(failed.email,null);assert.equal(failed.terms_accepted_version,terms.version);
  console.log('PASS: registration/upgrade consent enforced, version/time persisted; guest and anonymous invite creation require consent; existing invite sessions are exempt; live version updates notify accounts and guests; dismissal persists separately; stale consent rejected; failed email rolls back; all data and email isolated.');
 } finally {if(db)db.close();if(child&&child.exitCode===null){const stopped=new Promise(r=>child.once('exit',r));child.kill();await stopped;}fs.rmSync(fixture,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exit(1)});
