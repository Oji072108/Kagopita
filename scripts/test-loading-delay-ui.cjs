const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const terms=require('../terms.json');
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/**',async route=>{
      const p=new URL(route.request().url()).pathname;let data={};
      if(p==='/api/events')return route.fulfill({contentType:'text/event-stream',body:': test\n\n'});
      if(p==='/api/terms')data={...terms,notify:false};
      if(p==='/api/me')data={user:{id:'u',username:'Test'},channels:[]};
      if(p==='/api/notifications')data={notifications:[],unreadCount:0,totalPages:1};
      await route.fulfill({json:data});
    });
    await page.goto(process.env.KAGOPITA_TEST_URL||'http://127.0.0.1:3001');
    await page.waitForFunction(()=>currentUser&&!KagopitaActions.busy);
    await page.evaluate(()=>KagopitaLiveUpdates.stop());
    await page.clock.install({time:new Date('2026-10-29T00:00:00Z')});
    await page.clock.pauseAt(new Date('2026-10-29T00:00:01Z'));
    await page.evaluate(()=>{
      window.delayWrites=0;window.loadingShows=0;window.delayFailure=null;
      const original=HTMLDialogElement.prototype.showModal;
      HTMLDialogElement.prototype.showModal=function(){if(this.id==='actionLoadingDialog')loadingShows++;return original.call(this);};
      const button=document.createElement('button');button.id='delayTest';button.textContent='Test action';
      button.onclick=()=>{
        delayWrites++;
        KagopitaActions.request(()=>new Promise((resolve,reject)=>{window.delayResolve=resolve;window.delayReject=reject;}))
          .catch(error=>{delayFailure=error.message;});
      };document.body.append(button);
      window.otherDialog=document.createElement('dialog');document.body.append(otherDialog);
    });
    const click=()=>page.evaluate(()=>document.querySelector('#delayTest').click());
    const isOpen=()=>page.locator('#actionLoadingDialog').evaluate(e=>e.open);
    await click();assert.equal(await page.locator('#delayTest').isDisabled(),true,'Button locks immediately');
    for(let i=0;i<5;i++)await click();assert.equal(await page.evaluate(()=>delayWrites),1);
    await page.clock.runFor(499);assert.equal(await isOpen(),false,'No loading screen before 500ms');
    await page.evaluate(()=>delayResolve());await page.clock.runFor(2);
    assert.equal(await page.evaluate(()=>loadingShows),0,'Fast success never flashes loading');
    assert.equal(await page.locator('#delayTest').isEnabled(),true);
    await click();await page.clock.runFor(200);
    await page.evaluate(()=>otherDialog.showModal());
    assert.equal(await isOpen(),false,'Ordinary dialog cannot bypass delay');
    await page.clock.runFor(299);assert.equal(await isOpen(),false);
    await page.clock.runFor(1);assert.equal(await isOpen(),true,'Slow request shows loading at 500ms');
    await page.evaluate(()=>delayResolve());await page.clock.runFor(2);
    assert.equal(await isOpen(),false);await page.evaluate(()=>otherDialog.close());
    await click();await page.clock.runFor(100);await page.evaluate(()=>delayReject(Error('Test failure')));await page.clock.runFor(2);
    assert.equal(await isOpen(),false);assert.equal(await page.locator('#delayTest').isEnabled(),true,'Failure unlocks trigger');
    const shows=await page.evaluate(()=>loadingShows);await page.clock.runFor(500);
    assert.equal(await page.evaluate(()=>loadingShows),shows,'No late screen after failure');
    await click();await page.clock.runFor(30_001);await page.clock.runFor(2);
    assert.equal(await isOpen(),false);assert.equal(await page.locator('#delayTest').isEnabled(),true,'Timeout unlocks trigger');
    assert.equal(await page.locator('#delayTest').getAttribute('aria-busy'),null);
    await click();
    await page.evaluate(()=>{document.querySelector('#delayTest').disabled=true;delayResolve();});
    await page.clock.runFor(2);
    assert.equal(await page.locator('#delayTest').evaluate(e=>e.disabled),true,'Feature-owned disabled state survives action cleanup');
    assert.deepEqual(errors,[]);
    console.log('PASS: immediate disabled trigger; duplicate clicks blocked; no overlay at 499ms or on fast completion; overlay at 500ms; modal ordering; failure/timeout cleanup; no late flash.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
