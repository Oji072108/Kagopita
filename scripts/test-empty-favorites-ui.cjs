const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const terms=require('../terms.json');
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{window.EventSource=class extends EventTarget{constructor(){super();window.favoriteStream=this;}close(){}};});
    const favorites={a:[],b:[]};let fail=false;
    await page.route('**/api/**',async route=>{
      const p=new URL(route.request().url()).pathname;let data={};
      if(p==='/api/me')data={user:{id:'u',username:'Test'},channels:['a','b'].map(id=>({id,name:id,role:'owner'}))};
      if(p==='/api/terms')data={...terms,notify:false};
      if(p==='/api/notifications')data={notifications:[],unreadCount:0,totalPages:1};
      if(p.endsWith('/shopping-list'))data={total:0,completed:0,categories:[],familyFeed:[]};
      const match=p.match(/^\/api\/channels\/(a|b)\/favorites(?:\/\d+)?$/);
      if(match){
        if(fail)return route.fulfill({status:500,json:{error:'Test load failed'}});
        if(route.request().method()==='DELETE')favorites[match[1]]=[];
        data={favorites:favorites[match[1]]};
      }
      await route.fulfill({json:data});
    });
    await page.goto(process.env.KAGOPITA_TEST_URL||'http://127.0.0.1:3001');
    await page.waitForFunction(()=>currentChannelId);
    await page.locator('#nav-add').tap();await page.waitForFunction(()=>!KagopitaActions.busy);
    for(const width of [320,390,768])for(const dark of [false,true]){
      await page.setViewportSize({width,height:844});
      await page.evaluate(dark=>document.documentElement.classList.toggle('dark-mode',dark),dark);
      assert.equal(await page.locator('#favoriteDetails').isVisible(),false,'Entire empty card hidden');
      assert.equal(await page.locator('#inputName').isVisible(),true,'Add form remains available');
    }
    favorites.a=[{id:1,name:'Milk',qty:'1',category:'Dairy'}];
    await page.evaluate(()=>favoriteStream.dispatchEvent(new Event('update')));
    await page.locator('#favoriteDetails').waitFor({state:'visible'});
    assert.equal(await page.locator('.favorite-row').count(),1,'Live update reveals populated favorites');
    await page.locator('.favorite-remove-button').tap();
    await page.locator('#favoriteDetails').waitFor({state:'hidden'});
    favorites.a=[{id:1,name:'Milk',qty:'1',category:'Dairy'}];await page.evaluate(()=>loadFavorites());
    await page.evaluate(()=>selectChannel('b'));
    assert.equal(await page.locator('#favoriteDetails').evaluate(e=>e.classList.contains('hidden')),true,'Switch clears old list immediately');
    await page.locator('#nav-add').tap();await page.waitForFunction(()=>!KagopitaActions.busy);
    assert.equal(await page.locator('#favoriteDetails').isVisible(),false,'New empty list stays hidden');
    fail=true;await page.evaluate(()=>loadFavorites());
    assert.match(await page.locator('#favoriteDetails').textContent(),/Test load failed/,'Load failure remains visible');
    fail=false;await page.evaluate(()=>loadFavorites());assert.equal(await page.locator('#favoriteDetails').isVisible(),false);
    assert.deepEqual(errors,[]);
    console.log('PASS: empty card hidden in 6 layouts; live addition reveals it; final removal hides it; list switches clear stale data; errors remain visible; add form preserved.');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
