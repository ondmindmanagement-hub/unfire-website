const { chromium }=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage','--no-sandbox','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:1080,height:760},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',err=>errors.push(err.message.slice(0,180)));
  await page.goto('http://127.0.0.1:8765/audio/',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#openBtn').evaluate(e=>e.click());
  const frame=page.frameLocator('#malFrame');
  await frame.locator('#directOpen').count();
  await page.waitForFunction(()=>{try{return !!document.getElementById('malFrame').contentWindow.__mal?.S}catch{return false}},{timeout:80000});
  const f=page.frames().find(x=>x.url().includes('/audio/maletin/index.html'));
  assert(f,'Game iframe missing');
  await f.evaluate(()=>{window.__mal.setP(1);window.__roamAPI.enterRoam();window.__SIDEM.offer('NIMBO')});
  const initial=await f.evaluate(()=>({mission:window.__UNFIRE_CASE_QA.mission,originalButterfly:window.__UNFIRE_CASE_QA.originalButterfly,roam:window.__UNFIRE_CASE_QA.roam}));
  assert(initial.mission&&initial.originalButterfly&&initial.roam,'Mission, roam or real 3D butterfly not initialized');
  await f.evaluate(()=>window.__mal.toggleCase());
  const closed=await f.evaluate(()=>({closed:window.__UNFIRE_CASE_QA.closed,carrying:window.__UNFIRE_CASE_QA.carrying,mission:window.__UNFIRE_CASE_QA.mission}));
  assert(closed.closed&&closed.carrying&&closed.mission===initial.mission,'Closing case loses game or quest');
  const host=await page.evaluate(()=>({url:location.pathname,frameSrc:document.getElementById('malFrame').getAttribute('src'),immersive:document.body.classList.contains('immOn')}));
  assert(host.immersive&&host.frameSrc.includes('v=50'),'Game returned to website after closing case');
  await f.locator('#unfireCarryCase').click({timeout:10000});
  const opened=await f.evaluate(()=>({closed:window.__UNFIRE_CASE_QA.closed,carrying:window.__UNFIRE_CASE_QA.carrying,mission:window.__UNFIRE_CASE_QA.mission}));
  assert(!opened.closed&&!opened.carrying&&opened.mission===initial.mission,'Reopen does not work');
  const states=await f.evaluate(()=>{const a=[];for(let i=0;i<4;i++){window.__mal.toggleCase();a.push(window.__UNFIRE_CASE_QA.closed)}return a});
  assert.deepEqual(states,[true,false,true,false],'Rapid click target-state toggle not alternating');
  const missions=await f.evaluate(()=>{
    const result=[];
    for(let i=0;i<11;i++){
      let q=window.__SIDEM.cur;
      if(!q){window.__SIDEM.offer('NIMBO');q=window.__SIDEM.cur}
      window.__roamAPI.ROAMS.p.set(q.x,4.5,q.z);
      window.__roamAPI.ROAMS.h=q.y+70;
      window.__SIDEM.tick();
      result.push(!window.__SIDEM.cur);
    }
    return result;
  });
  assert.equal(missions.filter(Boolean).length,11,'Some side mission completion rules failed');
  assert.equal(errors.length,0,'Browser JavaScript errors: '+errors.join(' | '));
  console.log('PASS desktop browser: butterfly toggle, in-game carry/reopen, preserved quest and game, 11 mission completion predicates, no JS page errors');
 }catch(e){console.error('FAIL',e.stack?.slice(0,1200));process.exitCode=1}
 finally{if(browser)await browser.close()}
})();
