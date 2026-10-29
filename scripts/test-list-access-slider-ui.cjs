const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const terms = require('../terms.json');
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/api/**',async route=>{
      const p=new URL(route.request().url()).pathname;
      if(p==='/api/events')return route.fulfill({contentType:'text/event-stream',body:': fixture\n\n'});
      let data={};
      if(p==='/api/me')data={user:{id:'u',username:'Test'},channels:[]};
      if(p==='/api/terms')data={...terms,notify:false};
      if(p==='/api/notifications')data={notifications:[],unreadCount:0,totalPages:1};
      if(p.endsWith('/toggle'))return route.fulfill({status:429,headers:{'Retry-After':'5'},json:{code:'RATE_LIMITED',retryAfter:5,error:'操作が多すぎます。少し待ってからもう一度お試しください。'}});
      return route.fulfill({json:data});
    });
    await page.goto(process.env.KAGOPITA_TEST_URL||'http://127.0.0.1:3001');
    await page.locator('#view-channels').waitFor();
    const position=()=>page.locator('.list-access-tabs').evaluate(e=>{
      const style=getComputedStyle(e,'::before'),box=e.getBoundingClientRect();
      return {x:box.x+e.clientLeft+parseFloat(style.left)+new DOMMatrix(style.transform).m41,width:parseFloat(style.width),height:parseFloat(style.height)};
    });
    const aligned=async id=>{
      await page.waitForFunction(id=>{
        const e=document.querySelector('.list-access-tabs'),s=getComputedStyle(e,'::before');
        const b=e.getBoundingClientRect(),t=document.getElementById(id).getBoundingClientRect();
        return Math.abs(b.x+e.clientLeft+parseFloat(s.left)+new DOMMatrix(s.transform).m41-t.x)<.6;
      },id);
      const p=await position(),b=await page.locator('#'+id).boundingBox();
      assert.ok(Math.abs(p.width-b.width)<1 && Math.abs(p.height-b.height)<1,'Highlight matches selected tab');
    };
    for(const width of [320,390,768])for(const dark of [false,true])for(const language of ['ja','en','ko','zh','es']){
      await page.setViewportSize({width,height:844});
      await page.evaluate(({dark,language})=>{document.documentElement.classList.toggle('dark-mode',dark);applyLanguage(language);selectListAccess('create');},{dark,language});
      await aligned('createListTab');
      await page.locator('#channelName').fill('Keep my draft');
      await page.locator('#joinListTab').tap();
      await aligned('joinListTab');
      assert.equal(await page.locator('#joinListTab').getAttribute('aria-selected'),'true');
      assert.equal(await page.locator('#joinChannelForm').isVisible(),true);
      await page.locator('#joinListTab').focus();await page.keyboard.press('ArrowLeft');
      await aligned('createListTab');
      assert.equal(await page.locator('#channelName').inputValue(),'Keep my draft');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.equal(await page.locator('#joinListTab').evaluate(e=>getComputedStyle(e).borderTopWidth),'0px','No individual button outlines');
      if(dark)assert.equal(await page.locator('.list-access-tabs').evaluate(e=>getComputedStyle(e,'::before').backgroundColor),'rgb(50, 73, 54)','Reference dark pill fill');
      if(width===390&&language==='ja'){
        await page.locator('#joinListTab').tap();await aligned('joinListTab');
        await page.locator('#joinListTab').evaluate(e=>e.blur());
        await page.screenshot({path:'/tmp/list-slider-'+dark+'.png',animations:'disabled'});
      }
    }
    await page.locator('#joinListTab').tap();
    const transitions=await page.locator('.list-access-tabs').evaluate(e=>e.getAnimations({subtree:true}).filter(a=>a.transitionProperty==='transform').map(a=>a.effect.getTiming().duration));
    assert.ok(transitions.includes(320),'Actual sliding transition runs');
    await aligned('joinListTab');
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.locator('#createListTab').tap();await aligned('createListTab');
    assert.equal(await page.locator('.list-access-tabs').evaluate(e=>getComputedStyle(e,'::before').transitionDuration),'0s');
    for(const [language,expected]of [['ja','5秒後'],['en','5 seconds'],['ko','5초'],['zh','5秒'],['es','5 segundos']]){
      await page.evaluate(language=>applyLanguage(language),language);
      const message=await page.evaluate(async()=>{try{await api('/api/channels/a/items/1/toggle',{method:'PATCH'});}catch(error){return {message:error.message,retryAfter:error.retryAfter};}});
      assert.ok(message.message.includes(expected),message.message);assert.equal(message.retryAfter,5);
    }
    await page.evaluate(()=>{applyLanguage('en');return toggleItem(1);});
    await page.locator('#actionDialog').waitFor({state:'visible'});
    assert.match(await page.locator('#actionDialogBody').textContent(),/Too many actions.*5 seconds/);
    assert.deepEqual(errors,[]);
    console.log('PASS: slider geometry in 30 layouts; actual transition; keyboard/focus/drafts; reduced motion; localized 429 wait times and visible error dialog.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
