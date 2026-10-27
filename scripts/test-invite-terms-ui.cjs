const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const original=require('../terms.json');
(async()=>{
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 try {
  for(const width of [320,390,768]){
   const page=await browser.newPage({viewport:{width,height:700},hasTouch:true,isMobile:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   let terms=structuredClone(original), payload=null, joined=false, attempts=0;
   await page.route('**/api/**',async r=>{
    const path=new URL(r.request().url()).pathname;
    if(path==='/api/terms')return r.fulfill({json:{...terms,notify:false}});
    if(path==='/api/session'){
     attempts++;payload=r.request().postDataJSON();
     if(attempts===1)return r.fulfill({status:400,json:{error:'Please try again'}});
     joined=true;return r.fulfill({json:{channelId:'a'}});
    }
    if(!joined)return r.fulfill({status:401,json:{error:'Not signed in'}});
    if(path==='/api/events')return r.fulfill({contentType:'text/event-stream',body:': fixture\n\n'});
    let data={};
    if(path==='/api/me')data={user:{id:'u',username:'Guest'},channels:[{id:'a',name:'Groceries',role:'member'}]};
    if(path.endsWith('/shopping-list'))data={total:0,completed:0,familyFeed:[],categories:[]};
    if(path.endsWith('/members'))data={members:[]};
    if(path.endsWith('/favorites'))data={favorites:[]};
    return r.fulfill({json:data});
   });
   await page.goto((process.env.KAGOPITA_TEST_URL||'http://127.0.0.1:3001')+'/#invite=TESTCODE',{waitUntil:'networkidle'});
   await page.locator('#joinDialog').waitFor();
   const submit=page.locator('#joinForm [type="submit"]'), checkbox=page.locator('#inviteTermsAccepted');
   assert.equal(await submit.isDisabled(),true);
   await page.locator('#joinForm').evaluate(e=>e.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
   assert.equal(payload,null,'Direct submit cannot bypass consent');
   await page.locator('#joinName').fill('Invited guest');
   const read=async()=>{
    await page.locator('[data-terms-consent="invite"] .terms-open').tap();
    await page.locator('#termsDialog').waitFor();
    assert.equal(await page.locator('#termsReadDone').isDisabled(),true);
    await page.locator('#termsDocument').evaluate(e=>e.scrollTo(0,e.scrollHeight));
    await page.locator('#termsReadDone').tap();
    assert.equal(await page.locator('#joinDialog').isVisible(),true,'Return to original join dialog');
   };
   await page.locator('[data-terms-consent="invite"] .terms-open').tap();
   await page.locator('#termsClose').tap();
   assert.equal(await checkbox.isDisabled(),true,'Early close does not count as reading');
   await read();assert.equal(await submit.isDisabled(),true,'Reading alone is not agreement');
   await checkbox.check();assert.equal(await submit.isEnabled(),true);
   terms={...terms,version:'updated-invite-terms'};
   await page.evaluate(()=>KagopitaTerms.refresh());
   assert.equal(await submit.isDisabled(),true,'Updated terms invalidate consent');
   assert.equal(await checkbox.isChecked(),false);
   await read();await checkbox.check();
   await submit.tap();await page.locator('#joinMessage').filter({hasText:'Please try again'}).waitFor();
   assert.equal(await submit.isEnabled(),true,'Failed join can be retried');
   assert.deepEqual(payload,{invite:'TESTCODE',username:'Invited guest',termsAccepted:true,termsVersion:terms.version});
   await submit.tap();await page.waitForURL(url=>!url.hash);await page.locator('#view-list').waitFor();
   assert.equal(new URL(page.url()).hash,'');
   assert.equal(await page.locator('#joinDialog').isVisible(),false);
   assert.deepEqual(errors,[]);await page.close();
  }
  console.log('PASS: invite URL read-and-agree flow at 320/390/768px; nested dialog return, early exit, submit bypass, stale consent, retry and successful join.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
