const assert=require('node:assert/strict');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),net=require('node:net'),crypto=require('node:crypto');
const {DatabaseSync}=require('node:sqlite');const terms=require('../terms.json');
(async()=>{
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'kagopita-security-'));
 const socket=net.createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));const port=socket.address().port;await new Promise(r=>socket.close(r));const base='http://127.0.0.1:'+port;
 const preload=path.join(directory,'mail.cjs'),mailPath=path.join(directory,'mail.json');
 fs.writeFileSync(preload,`require(${JSON.stringify(require.resolve('nodemailer'))}).createTransport=()=>({sendMail:async mail=>{require('fs').writeFileSync(${JSON.stringify(mailPath)},JSON.stringify(mail));}});`);
 const child=spawn(process.execPath,['-r',preload,'server.js'],{cwd:path.join(__dirname,'..'),env:{...process.env,PORT:String(port),PUBLIC_URL:base,KAGOPITA_DATA_DIR:directory,KAGOPITA_ADMIN_USER_ID:'',KAGOPITA_ADMIN_EMAIL:'',SMTP_USER:'fixture@example.test',SMTP_PASS:'fixture'},stdio:'ignore'});let db;
 const request=async(cookie,url,body,status=200,headers={})=>{
  const response=await fetch(base+url,{method:body===undefined?'GET':'POST',headers:{Cookie:cookie||'','Content-Type':'application/json',...headers},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return {data,cookie:response.headers.get('set-cookie')?.split(';')[0],headers:response.headers};
 };
 try{
  for(let i=0;i<100;i++){try{if((await fetch(base)).ok)break;}catch{}await new Promise(r=>setTimeout(r,50));}
  db=new DatabaseSync(path.join(directory,'kagopita.sqlite'));
  const attack=`' OR 1=1; DROP TABLE users; -- <script>alert(1)</script>`;
  const owner=await request('','/api/account',{username:attack.slice(0,30),termsAccepted:true,termsVersion:terms.version},201);
  assert.ok(db.prepare('SELECT COUNT(*) n FROM users').get().n>=1);
  const salt=crypto.randomBytes(32).toString('hex'),password='Fixture reset password 482';
  db.prepare('UPDATE users SET email=?,email_verified=1,password_salt=?,password_hash=? WHERE id=?').run('owner@example.test',salt,crypto.scryptSync(password,Buffer.from(salt,'hex'),64).toString('hex'),owner.data.user.id);
  await request('','/api/login',{email:attack,password},401);
  await request('','/api/me',undefined,403,{Origin:'https://evil.example'});
  await request('','/api/account',{username:'CSRF',termsAccepted:true,termsVersion:terms.version},403,{'Sec-Fetch-Site':'cross-site'});
  const preflight=await fetch(base+'/api/me',{method:'OPTIONS',headers:{Origin:base}});assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),base);
  const invalid=await fetch(base+'/api/account',{method:'POST',headers:{'Content-Type':'application/json'},body:'{"password":"not-a-secret"'});assert.equal(invalid.status,400);assert.ok(!(await invalid.text()).includes('not-a-secret'));
  await request(owner.cookie,'/api/password-reset/request',{email:'owner@example.test'});
  let mail=JSON.parse(fs.readFileSync(mailPath));assert.match(mail.text,/30分/);assert.ok(!mail.text.includes('1時間'));
  const token=mail.text.match(/reset=([a-f0-9]{64})/)[1];
  const record=db.prepare('SELECT * FROM password_reset_tokens').get();assert.notEqual(record.token_hash,token);assert.ok(record.expires_at-Date.now()>1790000&&record.expires_at-Date.now()<=1800000);
  db.prepare('UPDATE password_reset_tokens SET expires_at=?').run(Date.now()-1);
  await request('','/api/password-reset/complete',{token,password:'New fixture password 537'},400);
  await request('','/api/password-reset/request',{email:'owner@example.test'});
  mail=JSON.parse(fs.readFileSync(mailPath));const next=mail.text.match(/reset=([a-f0-9]{64})/)[1];
  await request('','/api/password-reset/complete',{token:next,password:'New fixture password 537'});
  await request('','/api/password-reset/complete',{token:next,password:'Another fixture password 729'},400);
  await request(owner.cookie,'/api/me',undefined,401);
  const row=db.prepare('SELECT password_hash FROM users WHERE id=?').get(owner.data.user.id);assert.ok(!row.password_hash.includes('New fixture'));
  const plan=db.prepare('EXPLAIN QUERY PLAN SELECT id FROM shopping_items WHERE deleted_at IS NOT NULL AND julianday(deleted_at)<=julianday(?)').all(new Date().toISOString());assert.match(JSON.stringify(plan),/shopping_items_deleted_expiry/);
  assert.equal(fs.statSync(path.join(directory,'kagopita.sqlite')).mode&0o777,0o600);assert.equal(fs.statSync(directory).mode&0o777,0o700);
  const missing=await fetch(base+'/does-not-exist');assert.equal(missing.status,404);assert.match(await missing.text(),/ページが見つかりません/);assert.equal(missing.headers.get('x-content-type-options'),'nosniff');assert.equal(missing.headers.get('x-powered-by'),null);
  console.log('PASS: SQL attack stays data; cross-origin and cross-site rejection; safe malformed JSON; reset token hashed/30-minute expiry/single use; old-session revocation; salted password hash; expiry index query plan; private SQLite; custom 404 and security headers.');
 }finally{if(child.exitCode===null){child.kill();await new Promise(r=>child.once('exit',r));}db?.close();fs.rmSync(directory,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
