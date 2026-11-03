const assert=require('node:assert/strict'),{chromium}=require('playwright');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});const errors=[];let logged=false;
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.EventSource=class extends EventTarget{constructor(){super();window.adminStream=this;}close(){}};});
  const snapshot={health:{status:'ok',database:'ok',diskFree:2e9,diskTotal:10e9,uptimeSeconds:4000,rss:80e6,heapUsed:20e6,eventLoopP99Ms:5,checkedAt:Date.now()},totals:{requests:250,errors:2,loginSuccess:4,loginFailure:1},alerts:{emailConfigured:true,pushConfigured:true},incidents:[{id:'one',summary:'<img src=x onerror=alert(1)>',lastSeen:Date.now(),count:1,emailDelivery:'sent',pushDelivery:'queued'}],logins:[{at:Date.now(),success:true,status:200}],sessionMinutes:15};
  await page.route('**/api/**',async route=>{
   const p=new URL(route.request().url()).pathname;let data={};
   if(p==='/api/login')data={user:{id:'owner'}};
   if(p==='/api/admin/session'&&route.request().method()==='POST'){logged=true;data={expiresAt:Date.now()+900000};}
   if(p==='/api/admin/session'&&route.request().method()==='DELETE'){logged=false;data={ok:true};}
   if(p==='/api/admin/snapshot'){if(!logged)return route.fulfill({status:401,json:{error:'再認証してください。'}});data=snapshot;}
   if(p.endsWith('/acknowledge')){snapshot.incidents[0].acknowledgedAt=Date.now();data={ok:true};}
   if(p==='/api/admin/test-alert')data={email:'sent',push:'queued'};
   await route.fulfill({json:data});
  });
  await page.goto(process.env.KAGOPITA_TEST_URL?process.env.KAGOPITA_TEST_URL+'/admin':'http://127.0.0.1:3001/admin');
  await page.locator('#login').waitFor({state:'visible'});await page.locator('#email').fill('owner@example.test');await page.locator('#password').fill('Fixture Password');await page.locator('#loginButton').tap();
  await page.locator('#dashboard').waitFor({state:'visible'});assert.equal(await page.locator('#password').inputValue(),'');
  assert.equal(await page.locator('#incidents img').count(),0);assert.match(await page.locator('#incidents').textContent(),/<img/);
  for(const width of [320,390,768,1280]){
   await page.setViewportSize({width,height:900});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   for(const id of ['refresh','testAlert','logout'])assert.ok((await page.locator('#'+id).boundingBox()).height>=44);
   if(width===390)await page.screenshot({path:'/tmp/kagopita-admin-mobile.png',fullPage:true});
  }
  await page.locator('#testAlert').tap();await page.locator('#message').getByText(/sent/).waitFor();
  await page.locator('#incidents button').tap();await page.waitForFunction(()=>!document.querySelector('#incidents button'));
  await page.locator('#logout').tap();await page.locator('#login').waitFor({state:'visible'});assert.equal(await page.locator('#dashboard').isVisible(),false);
  assert.equal(await page.evaluate(()=>localStorage.length),0,'No credentials stored in localStorage');assert.deepEqual(errors,[]);
  console.log('PASS: admin login/logout and password clearing; responsive 320/390/768/1280px; safe incident rendering; accessible controls; test alert; acknowledge; no credential storage.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
