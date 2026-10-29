const assert = require('node:assert/strict');
const {mock} = require('node:test');
const express = require('express');
const {createRequestLimits} = require('../request-limits');
(async()=>{
  mock.timers.enable({apis:['Date'],now:Date.now()});
  const app=express();app.use(express.json());
  const limits=createRequestLimits(req=>({id:req.get('X-Test-User')||'one'}));
  let sent=0;
  app.post(['/invite','/verify','/reset'],limits.emailActor,limits.emailVolume,limits.emailRecipient,(req,res)=>{sent++;res.json({sent:true});});
  const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const base='http://127.0.0.1:'+server.address().port;
  const send=(endpoint='/invite',user='one',email='recipient@example.test')=>fetch(base+endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-Test-User':user},body:JSON.stringify({email})});
  try{
    assert.equal((await send()).status,200);
    const blocked=await send('/reset');assert.equal(blocked.status,429);
    assert.equal(blocked.headers.get('Retry-After'),'30');assert.equal(sent,1,'No second email sent');
    mock.timers.tick(31_000);
    assert.equal((await send('/verify')).status,200,'Email recovers after cooldown');
    assert.equal((await send('/reset','two')).status,200,'Other sender can send');
    assert.equal((await send('/invite','three')).status,429,'Recipient protected across senders');
    assert.equal(sent,3,'Recipient block sends no email');
    mock.timers.tick(61_000);
    assert.equal((await send('/invite','three')).status,200,'Recipient window recovers');
    for(let i=0;i<9;i++){
      mock.timers.tick(31_000);
      assert.equal((await send('/invite','volume','other-'+i+'@example.test')).status,200);
    }
    mock.timers.tick(31_000);assert.equal((await send('/invite','volume','last@example.test')).status,200);
    mock.timers.tick(31_000);assert.equal((await send('/invite','volume','blocked@example.test')).status,429,'Sustained volume limit');
    console.log('PASS: email no-send on rejection; retry seconds; cooldown recovery; cross-endpoint/recipient protection; independent senders; sustained volume cap.');
  }finally{await new Promise(r=>server.close(r));mock.timers.reset();}
})().catch(error=>{console.error(error);process.exitCode=1;});
