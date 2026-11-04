const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const v8 = require('node:v8');
const { monitorEventLoopDelay } = require('node:perf_hooks');
const { rateLimit } = require('express-rate-limit');

const ADMIN_TTL = 15 * 60 * 1000;
const ALERT_COOLDOWN = 10 * 60 * 1000;

function createAdminMonitor({db, dataDirectory, ownerId, ownerEmail, mailer, verifyPassword, sessionToken, pushAlert}) {
  const configured = Boolean(ownerId && ownerEmail);
  const statePath = path.join(dataDirectory, 'admin-monitor.json');
  const state = {incidents:[], logins:[]};
  if (configured) {
    try {
      const saved = JSON.parse(fs.readFileSync(statePath,'utf8'));
      state.incidents = Array.isArray(saved.incidents) ? saved.incidents.slice(-100) : [];
      state.logins = Array.isArray(saved.logins) ? saved.logins.slice(-200) : [];
    } catch {}
  }
  const grants = new Map(), clients = new Set(), failures = [], authFailures = [];
  const totals = {requests:0, errors:0, loginSuccess:0, loginFailure:0, adminDenied:0};
  let timer, dirty = false, heapStrikes = 0, emission;
  const lag = monitorEventLoopDelay({resolution:20});
  const hash = value => crypto.createHash('sha256').update(value).digest('hex');
  const isOwner = user => Boolean(configured && user?.id === ownerId && user.emailVerified && user.email?.toLowerCase() === ownerEmail.toLowerCase());
  function persist() {
    if (!configured || !dirty) return;
    try {
      const temporary = statePath + '.tmp';
      fs.writeFileSync(temporary, JSON.stringify(state), {mode:0o600});
      fs.renameSync(temporary,statePath);dirty=false;
    } catch {}
  }
  function alertStatus(incident) {
    return {email:incident.emailDelivery || 'not-sent',push:incident.pushDelivery || 'not-sent'};
  }
  async function deliver(incident, test = false) {
    if (!configured || incident.delivering) return;
    incident.delivering=true;incident.lastAttempt=Date.now();
    const title = test ? 'カゴピタ管理：通知テスト' : 'カゴピタ：重大な障害を検出';
    const body = `${incident.summary}\n${new Date(incident.lastSeen).toISOString()}\n管理画面で状態を確認してください。`;
    try {
      try { incident.pushDelivery = pushAlert(ownerId,{id:incident.id,title,body}) > 0 ? 'queued' : 'no-device'; }
      catch { incident.pushDelivery='failed'; }
      if (!mailer) incident.emailDelivery='not-configured';
      else {
        let deadline;
        try {
          await Promise.race([
            mailer.sendMail({from:process.env.SMTP_FROM || process.env.SMTP_USER,to:ownerEmail,subject:title,text:body}),
            new Promise((_,reject)=>{deadline=setTimeout(()=>reject(Error('timeout')),20000);deadline.unref();})
          ]);
          incident.emailDelivery='sent';
        } catch { incident.emailDelivery='failed'; }
        finally {clearTimeout(deadline);}
      }
    } finally {
      incident.delivering=false;dirty=true;persist();emit();
    }
    return alertStatus(incident);
  }
  function critical(code, summary) {
    if (!configured) return;
    let incident=state.incidents.find(x=>x.code===code&&!x.resolvedAt);
    if (!incident) {
      incident={id:crypto.randomUUID(),code,summary,openedAt:Date.now(),lastSeen:Date.now(),count:0};
      state.incidents.push(incident);state.incidents=state.incidents.slice(-100);
    }
    incident.lastSeen=Date.now();incident.count++;dirty=true;persist();
    if (!incident.lastAttempt || Date.now()-incident.lastAttempt>=ALERT_COOLDOWN) void deliver(incident);
    emit();
  }
  function resolve(code) {
    for(const incident of state.incidents)if(incident.code===code&&!incident.resolvedAt){incident.resolvedAt=Date.now();dirty=true;}
  }
  function health() {
    let database='ok',diskFree=null,diskTotal=null;
    try {db.prepare('SELECT 1').get();} catch {database='failed';}
    try {const s=fs.statfsSync(dataDirectory);diskFree=s.bavail*s.bsize;diskTotal=s.blocks*s.bsize;}catch{}
    const memory=process.memoryUsage(),heapLimit=v8.getHeapStatistics().heap_size_limit;
    const diskCritical=diskFree!==null && (diskFree<100*1024*1024 || diskFree/diskTotal<0.02);
    return {status:database==='ok'&&!diskCritical?'ok':'critical',database,diskFree,diskTotal,
      uptimeSeconds:Math.floor(process.uptime()),rss:memory.rss,heapUsed:memory.heapUsed,heapLimit,
      eventLoopP99Ms:Math.round((lag.percentile(99)||0)/1e6),checkedAt:Date.now()};
  }
  function sample() {
    const current=health();
    if(current.database!=='ok')critical('database','データベースの応答を確認できません。');else resolve('database');
    if(current.diskFree!==null&&(current.diskFree<100*1024*1024||current.diskFree/current.diskTotal<0.02))critical('disk','サーバーの保存領域が残りわずかです。');else resolve('disk');
    heapStrikes=current.heapUsed/current.heapLimit>.9?heapStrikes+1:0;
    if(heapStrikes>=3)critical('memory','アプリのメモリ使用量が継続して上限に近づいています。');else if(!heapStrikes)resolve('memory');
    while(failures.length&&failures[0]<Date.now()-60000)failures.shift();
    if(failures.length>=5)critical('http-errors','1分間に5件以上のサーバーエラーを検出しました。');else if(!failures.length)resolve('http-errors');
    while(authFailures.length&&authFailures[0]<Date.now()-60000)authFailures.shift();
    if(!authFailures.length)resolve('login-failures');
    for(const i of state.incidents)if(!i.resolvedAt&&!i.acknowledgedAt&&i.emailDelivery==='failed'&&Date.now()-(i.lastAttempt||0)>=ALERT_COOLDOWN)void deliver(i);
    state.logins=state.logins.filter(x=>x.at>Date.now()-7*86400000).slice(-200);
    persist();emit();return current;
  }
  function snapshot() {
    let release=null;
    try{const r=JSON.parse(fs.readFileSync(process.env.KAGOPITA_RELEASE_CONFIG,'utf8'));release={active:r.active,version:r.slots[r.active].version,previous:r.previous,updatedAt:r.updatedAt};}catch{}
    return {health:health(),totals:{...totals},incidents:state.incidents.slice().reverse().map(({delivering,...i})=>i),
      logins:state.logins.slice(-60).reverse(),release,alerts:{emailConfigured:Boolean(mailer),pushConfigured:Boolean(pushAlert)},sessionMinutes:15};
  }
  function emit() {
    if(emission||!clients.size)return;
    emission=setTimeout(()=>{
      emission=null;const message=`event: snapshot\ndata: ${JSON.stringify(snapshot())}\n\n`;
      for(const client of clients)if(!client.res.write(message)) {client.res.end();clients.delete(client);}
    },500);emission.unref();
  }
  function observe(req,res,next) {
    if(!configured || !req.path.startsWith('/api/'))return next();
    res.on('finish',()=>{
      totals.requests++;
      if(res.statusCode>=500){totals.errors++;while(failures.length&&failures[0]<Date.now()-60000)failures.shift();failures.push(Date.now());if(failures.length>1000)failures.shift();if(failures.length>=5)critical('http-errors','1分間に5件以上のサーバーエラーを検出しました。');}
      if(req.path==='/api/login' && req.method==='POST') {
        const success=res.statusCode===200;totals[success?'loginSuccess':'loginFailure']++;
        if(!success){while(authFailures.length&&authFailures[0]<Date.now()-60000)authFailures.shift();authFailures.push(Date.now());if(authFailures.length>1000)authFailures.shift();if(authFailures.length>=10)critical('login-failures','短時間に多数のログイン失敗を検出しました。');}
        state.logins.push({at:Date.now(),success,status:res.statusCode});state.logins=state.logins.slice(-200);dirty=true;
      }
      emit();
    });next();
  }
  function cookie(req) {return (req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith('kagopita_admin='))?.slice(15);}
  function hasGrant(req) {
    const key=hash(cookie(req)||''),grant=grants.get(key);
    if(!grant)return false;
    if(grant.expires<=Date.now()){grants.delete(key);return false;}
    if(grant.session!==hash(sessionToken(req)||''))return false;
    const session=db.prepare('SELECT user_id,expires_at FROM sessions WHERE token_hash=?').get(grant.session);
    if(!session||session.user_id!==ownerId||session.expires_at<=Date.now()){grants.delete(key);return false;}
    req.adminExpiresAt=grant.expires;
    return true;
  }
  function routes() {
    const router=require('express').Router();
    router.use((req,res,next)=>{
      res.set({'Cache-Control':'no-store','X-Robots-Tag':'noindex, nofollow','X-Content-Type-Options':'nosniff'});
      if(!isOwner(req.user)){totals.adminDenied++;return res.status(403).json({error:'この管理画面へのアクセス権限がありません。'});}
      if(req.method!=='GET') {
        const origin=req.get('origin'),expected=new URL(process.env.PUBLIC_URL||'http://'+req.get('host')).origin;
        const currentOrigin=`${req.secure?'https':'http'}://${req.get('host')}`;
        if(req.get('X-Admin-Request')!=='1'||(origin&&origin!==expected&&origin!==currentOrigin)||req.get('sec-fetch-site')==='cross-site')return res.status(403).json({error:'Invalid admin request.'});
      }
      next();
    });
    router.post('/session',rateLimit({windowMs:15*60000,limit:5,keyGenerator:req=>req.user.id,standardHeaders:'draft-8',legacyHeaders:false}),async(req,res,next)=>{
      try {
        const password=req.body?.password;
        const row=db.prepare('SELECT password_salt,password_hash FROM users WHERE id=?').get(ownerId);
        if(typeof password!=='string'||password.length>128||!row?.password_hash||!await verifyPassword(password,row.password_salt,row.password_hash))return res.status(401).json({error:'パスワードを確認してください。'});
        const token=crypto.randomBytes(32).toString('hex'),expires=Date.now()+ADMIN_TTL;
        for(const [key,value]of grants)if(value.expires<=Date.now())grants.delete(key);
        grants.set(hash(token),{expires,session:hash(sessionToken(req)||'')});
        res.cookie('kagopita_admin',token,{httpOnly:true,sameSite:'strict',secure:new URL(process.env.PUBLIC_URL||'http://'+req.get('host')).protocol==='https:',path:'/api/admin',maxAge:ADMIN_TTL});
        res.json({expiresAt:expires});
      }catch(error){next(error);}
    });
    router.use((req,res,next)=>hasGrant(req)?next():res.status(401).json({code:'ADMIN_REAUTH_REQUIRED',error:'管理者パスワードで再認証してください。'}));
    router.get('/snapshot',(req,res)=>res.json({...snapshot(),expiresAt:req.adminExpiresAt}));
    router.delete('/session',(req,res)=>{grants.delete(hash(cookie(req)||''));res.clearCookie('kagopita_admin',{path:'/api/admin',httpOnly:true,sameSite:'strict'});res.json({ok:true});});
    router.post('/test-alert',async(req,res)=>{
      const now=Date.now();if(now-(router.lastTest||0)<60000)return res.status(429).json({error:'通知テストは1分後に再実行できます。'});router.lastTest=now;
      const incident={id:crypto.randomUUID(),summary:'管理者向け通知のテストです。障害は発生していません。',lastSeen:now};
      res.json(await deliver(incident,true));
    });
    router.post('/incidents/:id/acknowledge',(req,res)=>{
      const incident=state.incidents.find(i=>i.id===req.params.id);if(!incident)return res.sendStatus(404);
      incident.acknowledgedAt=Date.now();dirty=true;persist();emit();res.json({ok:true});
    });
    router.get('/events',(req,res)=>{
      res.set({'Content-Type':'text/event-stream','Connection':'keep-alive','X-Accel-Buffering':'no'});res.flushHeaders();
      const client={res};clients.add(client);res.write(`event: snapshot\ndata: ${JSON.stringify(snapshot())}\n\n`);
      const heartbeat=setInterval(()=>{
        let user;try{user=db.prepare('SELECT email,email_verified FROM users WHERE id=?').get(ownerId);}catch{res.end();return;}
        if(!hasGrant(req)||!user?.email_verified||user.email?.toLowerCase()!==ownerEmail.toLowerCase()){res.write('event: expired\ndata: {}\n\n');res.end();return;}
        res.write(': heartbeat\n\n');
      },15000);heartbeat.unref();
      req.on('close',()=>{clearInterval(heartbeat);clients.delete(client);});
    });
    return router;
  }
  function start() {if(!configured||timer)return;lag.enable();sample();timer=setInterval(sample,30000);timer.unref();}
  function stop() {clearInterval(timer);clearTimeout(emission);lag.disable();for(const c of clients)c.res.end();clients.clear();persist();}
  return {observe,routes,health,snapshot,critical,sample,start,stop,isOwner};
}
module.exports={createAdminMonitor,ADMIN_TTL};
