/* All accounts, keys and delivery captures are isolated; no real push service is contacted. */
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const net = require('node:net');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const root = path.join(__dirname, '..'), temp = fs.mkdtempSync(path.join(os.tmpdir(), 'kagopita-push-'));
  const capture = path.join(temp, 'sent.jsonl'), failure = path.join(temp, 'failure.json');
  const preload = path.join(temp, 'preload.cjs');
  fs.writeFileSync(preload, `const fs = require('fs');
    const wp = require(${JSON.stringify(require.resolve('web-push'))});
    wp.sendNotification = async (subscription, payload, options) => {
      const request = wp.generateRequestDetails(subscription, payload, options);
      if (!request.headers.Authorization || request.body.toString().includes('共有リスト')) throw Error('Push must be authenticated and encrypted');
      const failure = ${JSON.stringify(failure)};
      if (fs.existsSync(failure)) { const code = JSON.parse(fs.readFileSync(failure)).code; if (code) { const error = Error('simulated'); error.statusCode = code; throw error; } }
      fs.appendFileSync(${JSON.stringify(capture)}, JSON.stringify({ endpoint:subscription.endpoint, payload:JSON.parse(payload), encrypted:true }) + '\\n');
      return {statusCode:201};
    };`);
  const listener = net.createServer();
  await new Promise(resolve => listener.listen(0, '127.0.0.1', resolve));
  const port = listener.address().port; await new Promise(resolve => listener.close(resolve));
  const base = 'http://127.0.0.1:' + port;
  let child, db;
  const boot = async () => {
    child = spawn(process.execPath, ['--require', preload, 'server.js'], {cwd:root,
      env:{...process.env, PORT:String(port), KAGOPITA_DATA_DIR:temp, PUBLIC_URL:base, NODE_ENV:'test'}, stdio:'ignore'});
    for (let i=0;i<100;i++) { try { if ((await fetch(base)).ok) return; } catch {} await delay(50); }
    throw Error('server readiness');
  };
  const stop = async () => { if (child && child.exitCode === null) { child.kill(); await new Promise(resolve => child.once('exit',resolve)); } };
  const request = async (cookie, url, method='GET', body, expected=200, origin) => {
    const response = await fetch(base+url,{method,headers:{Cookie:cookie||'', 'Content-Type':'application/json', ...(origin ? {Origin:origin}: {})},body: body===undefined?undefined:JSON.stringify(body)});
    const text = await response.text(); assert.equal(response.status,expected,url+': '+text);
    return {data:JSON.parse(text),cookie:response.headers.get('set-cookie')?.split(';')[0]};
  };
  const subscription = n => { const curve=crypto.createECDH('prime256v1'); return {endpoint:'https://fcm.googleapis.com/fcm/send/isolated-device-'+n,
    keys:{p256dh:curve.generateKeys().toString('base64url'),auth:crypto.randomBytes(16).toString('base64url')}}; };
  const sent = () => fs.existsSync(capture) ? fs.readFileSync(capture,'utf8').trim().split('\n').filter(Boolean).map(JSON.parse) : [];
  const waitFor = async fn => { for(let i=0;i<120;i++){ if(fn()) return; await delay(100); } throw Error('delivery timeout'); };
  try {
    await boot(); db = new DatabaseSync(path.join(temp,'kagopita.sqlite')); db.exec('PRAGMA busy_timeout=5000');
    await request('', '/api/push/config','GET',undefined,401);
    const terms=require('../terms.json');
    const account=async username => request('','/api/account','POST',{username,termsAccepted:true,termsVersion:terms.version},201);
    const a=await account('作成者'), b=await account('メンバー'), outsider=await account('別のリスト');
    const secondToken=crypto.randomBytes(32).toString('hex');
    const secondHash=crypto.createHash('sha256').update(secondToken).digest('hex');
    db.prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').run(secondHash,b.data.user.id,Date.now()+3600000);
    const b2={...b,cookie:'kagopita_session='+secondToken};
    const {data:channel}=await request(a.cookie,'/api/channels','POST',{name:'端末通知テスト'},201);
    const {data:invite}=await request(a.cookie,'/api/channels/'+channel.id+'/invites','POST',{});
    await request(b.cookie,'/api/invites/accept','POST',{invite:invite.inviteCode});
    const actor=subscription('actor'), first=subscription(1), second=subscription(2), outside=subscription('outsider');
    const key=(await request(b.cookie,'/api/push/config')).data.publicKey;
    assert.equal(Buffer.from(key,'base64url').length,65);
    for(const [user,sub] of [[a,actor],[b,first],[b2,second],[outsider,outside]])
      await request(user.cookie,'/api/push/subscriptions','POST',{subscription:sub,language:user===b?'en':user===b2?'es':'ja'},201,base);
    await request(b.cookie,'/api/push/subscriptions','POST',{subscription:first,language:'en'},201);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM push_devices').get().n,4,'idempotent devices');
    const invalid=[{...first,endpoint:'https://127.0.0.1/private'}, {...first,endpoint:'https://fcm.googleapis.com.attacker.test/send'},
      {...first,endpoint:'http://fcm.googleapis.com/send'}, {...first,endpoint:'https://fcm.googleapis.com:444/send'}, {...first,keys:{p256dh:'bad',auth:'bad'}}];
    for(const sub of invalid) await request(b.cookie,'/api/push/subscriptions','POST',{subscription:sub},400);
    await request(b.cookie,'/api/push/subscriptions','POST',{subscription:first},403,'https://other.example');
    await request(outsider.cookie,'/api/push/test','POST',{endpoint:first.endpoint},404);
    await request(outsider.cookie,'/api/push/subscriptions','DELETE',{endpoint:first.endpoint});
    assert.equal((await request(b.cookie,'/api/push/status','POST',{endpoint:first.endpoint})).data.enabled,true);
    const add = name => request(a.cookie,'/api/channels/'+channel.id+'/items','POST',{name,category:'その他',qty:'10個'},201);
    await add('トマト'); await waitFor(()=>sent().length===2);
    assert.deepEqual(new Set(sent().map(x=>x.endpoint)),new Set([first.endpoint,second.endpoint]));
    assert.ok(sent().every(x=>x.encrypted));
    assert.equal(sent().find(x=>x.endpoint===first.endpoint).payload.body,'作成者 added: tomato (10 pieces)');
    assert.equal(sent().find(x=>x.endpoint===second.endpoint).payload.body,'作成者 añadió: tomate (10 unidades)');
    assert.equal(sent().find(x=>x.endpoint===first.endpoint).payload.title,'Item added');
    await request(outsider.cookie,'/api/push/status','POST',{endpoint:first.endpoint,language:'ko'});
    assert.equal(db.prepare('SELECT language FROM push_devices WHERE endpoint=?').get(first.endpoint).language,'en','Outsider cannot change device language');
    await request(b.cookie,'/api/push/status','POST',{endpoint:first.endpoint,language:'ko'});
    assert.equal(db.prepare('SELECT language FROM push_devices WHERE endpoint=?').get(first.endpoint).language,'ko');
    await request(b.cookie,'/api/push/status','POST',{endpoint:first.endpoint,language:'en'});
    // Repeated registration must preserve queued jobs, and the queue survives restart.
    fs.writeFileSync(failure,JSON.stringify({code:503})); await add('パン');
    await waitFor(()=>db.prepare('SELECT COUNT(*) n FROM push_queue WHERE attempts > 0').get().n===2);
    await request(b.cookie,'/api/push/subscriptions','POST',{subscription:first,language:'en'},201);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM push_queue').get().n,2);
    await stop(); db.exec('ALTER TABLE push_devices DROP COLUMN language'); await boot();
    assert.equal(db.prepare('SELECT language FROM push_devices WHERE endpoint=?').get(first.endpoint).language,'ja','Old-device schema migrates without losing subscriptions or jobs');
    assert.equal((await request(b.cookie,'/api/push/config')).data.publicKey,key,'stable VAPID keys across restart');
    fs.unlinkSync(failure); db.prepare('UPDATE push_queue SET next_at=0').run(); await waitFor(()=>sent().length===4);
    // Gone endpoints are removed, not retried indefinitely.
    fs.writeFileSync(failure,JSON.stringify({code:410})); await add('卵');
    await waitFor(()=>db.prepare('SELECT COUNT(*) n FROM push_devices WHERE user_id=?').get(b.data.user.id).n===0);
    fs.unlinkSync(failure);
    await request(b.cookie,'/api/push/subscriptions','POST',{subscription:first,language:'en'},201);
    await request(b2.cookie,'/api/push/subscriptions','POST',{subscription:second},201);
    await request(b.cookie,'/api/push/test','POST',{endpoint:first.endpoint},202);
    await request(b.cookie,'/api/push/test','POST',{endpoint:first.endpoint},429);
    await waitFor(()=>sent().length===5);
    // Removing a member also cancels their pending notifications.
    fs.writeFileSync(failure,JSON.stringify({code:503})); await add('米');
    await request(a.cookie,'/api/channels/'+channel.id+'/members/'+b.data.user.id,'DELETE');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM push_queue WHERE notification_id IS NOT NULL').get().n,0);
    // Browser/account transfer clears queued jobs and only follows the explicitly opted-in account.
    fs.unlinkSync(failure);
    await request(outsider.cookie,'/api/push/subscriptions','POST',{subscription:first,language:'en'},201);
    assert.equal((await request(b.cookie,'/api/push/status','POST',{endpoint:first.endpoint})).data.enabled,false);
    await request(b.cookie,'/api/logout','POST');
    assert.equal(db.prepare('SELECT COUNT(*) n FROM push_devices WHERE user_id=?').get(b.data.user.id).n,1,'Logging out one device preserves the other session');
    await request(b2.cookie,'/api/push/test','POST',{endpoint:second.endpoint},202);
    await waitFor(()=>sent().length===6);
    db.prepare('UPDATE sessions SET expires_at=0 WHERE token_hash=?').run(secondHash);
    await waitFor(()=>db.prepare('SELECT COUNT(*) n FROM push_devices WHERE user_id=?').get(b.data.user.id).n===0);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM push_devices WHERE endpoint=?').get(first.endpoint).n,1);
    await request(outsider.cookie,'/api/push/subscriptions','DELETE',{endpoint:first.endpoint});
    assert.equal(db.prepare('SELECT COUNT(*) n FROM push_devices WHERE endpoint=?').get(first.endpoint).n,0);
    assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(),[]);
    assert.equal(db.prepare('PRAGMA integrity_check').get().integrity_check,'ok');
    assert.equal(fs.statSync(path.join(temp,'web-push-vapid.json')).mode & 0o777,0o600);
    console.log('PASS: detailed per-device English/Spanish payloads, language synchronization/isolation, old-schema migration, encrypted two-device fanout, actor/outsider isolation, auth/origin/SSRF validation, idempotency, durable retry and VAPID persistence, 410 cleanup, test rate limit, member removal, logout, account transfer, unsubscribe, SQLite integrity.');
  } finally { await stop(); db?.close(); fs.rmSync(temp,{recursive:true,force:true}); }
})().catch(error=>{console.error(error);process.exitCode=1;});
