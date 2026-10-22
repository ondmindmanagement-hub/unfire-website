const { chromium }=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 let browser;
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.UNFIRE_CHROME||undefined,args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage','--no-sandbox','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:1080,height:760},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',err=>errors.push(err.message.slice(0,180)));
  await page.addInitScript(()=>{
    try{localStorage.setItem('unfire_save_v1',JSON.stringify({name:'Tester',level:1,ch:2,step:0,done:[0,1],met:true,ts:Date.now()}));}catch(e){}
  });
  await page.goto(process.env.UNFIRE_TEST_URL||'http://127.0.0.1:8765/audio/',{waitUntil:'domcontentloaded',timeout:30000});
  await page.locator('#openBtn').evaluate(e=>e.click());
  const frame=page.frameLocator('#malFrame');
  await frame.locator('#directOpen').count();
  await page.waitForFunction(()=>{try{return !!document.getElementById('malFrame').contentWindow.__mal?.S}catch{return false}},{timeout:80000});
  const f=page.frames().find(x=>x.url().includes('/audio/maletin/index.html'));
  assert(f,'Game iframe missing');
  await f.evaluate(()=>{window.__mal.setP(1);window.__mal.requestOpen();window.__roamAPI.enterRoam();window.__SIDEM.offer('NIMBO')});
  const initial=await f.evaluate(()=>({mission:window.__UNFIRE_CASE_QA.mission,originalButterfly:window.__UNFIRE_CASE_QA.originalButterfly,roam:window.__UNFIRE_CASE_QA.roam}));
  assert(initial.mission&&initial.originalButterfly&&initial.roam,'Mission, roam or real 3D butterfly not initialized');
  assert(await f.evaluate(()=>window.__UNFIRE_CASE_QA.portableUnlocked),'Capsule should unlock at third mission');
  await f.evaluate(()=>window.__mal.toggleCase());
  const closed=await f.evaluate(()=>({closed:window.__UNFIRE_CASE_QA.closed,carrying:window.__UNFIRE_CASE_QA.carrying,mission:window.__UNFIRE_CASE_QA.mission}));
  console.log('CASE_STATE_DIAGNOSTIC',JSON.stringify({initial,closed}));
  assert(closed.closed&&closed.carrying&&closed.mission===initial.mission,'Closing case loses game or quest');
  const host=await page.evaluate(()=>({url:location.pathname,frameSrc:document.getElementById('malFrame').getAttribute('src'),immersive:document.body.classList.contains('immOn')}));
  assert(host.immersive&&host.frameSrc.includes('v=20261022c'),'Game returned to website after closing case');
  const control=await f.evaluate(()=>{const b=document.getElementById('unfireCarryCase');if(!b)return {exists:false};const q=b.getBoundingClientRect();return {exists:true,display:getComputedStyle(b).display,visibility:getComputedStyle(b).visibility,rect:[q.x,q.y,q.width,q.height],hidden:b.hidden,roam:window.__UNFIRE_CASE_QA.roam,carry:window.__UNFIRE_CASE_QA.carrying};});
  console.log('CARRY_BUTTON_DIAGNOSTIC',JSON.stringify(control));
  assert.equal(await f.evaluate(()=>window.__UNFIRE_CASE_QA.caseVisible),false,'Case must not obstruct player camera when packed');
  // The reusable capsule is actually thrown; reopening takes place on landing.
  await f.evaluate(()=>{const b=document.getElementById('unfireCarryCase');if(!b)throw Error('Capsule control missing');b.click()});
  const flying=await f.evaluate(()=>window.__UNFIRE_CASE_QA.capsuleFlying);
  assert(flying,'Capsule launch did not start');
  await f.waitForFunction(()=>!window.__UNFIRE_CASE_QA.capsuleFlying&&window.__UNFIRE_CASE_QA.caseVisible,{timeout:30000});
  const opened=await f.evaluate(()=>({closed:window.__UNFIRE_CASE_QA.closed,carrying:window.__UNFIRE_CASE_QA.carrying,mission:window.__UNFIRE_CASE_QA.mission,visible:window.__UNFIRE_CASE_QA.caseVisible}));
  assert(!opened.closed&&!opened.carrying&&opened.visible&&opened.mission===initial.mission,'Capsule landing lost case or active mission');
  await f.evaluate(()=>{window.__mal.showCaseView();});
  const inspecting=await f.evaluate(()=>window.__UNFIRE_CASE_QA.inspecting);
  assert(inspecting,'Case close-up camera did not enable');
  await f.evaluate(()=>window.__mal.showRobotView());
  assert(!(await f.evaluate(()=>window.__UNFIRE_CASE_QA.inspecting)),'Robot view did not restore');
  // Pack again; player stays walking with no case mesh in front of the camera.
  await f.evaluate(()=>document.getElementById('unfireCarryCase').click());
  const repacked=await f.evaluate(()=>({closed:window.__UNFIRE_CASE_QA.closed,carrying:window.__UNFIRE_CASE_QA.carrying,visible:window.__UNFIRE_CASE_QA.caseVisible,mission:window.__UNFIRE_CASE_QA.mission}));
  assert(repacked.closed&&repacked.carrying&&!repacked.visible&&repacked.mission===initial.mission,'Repacking capsule interrupted mission');
  // In-game house computer: ? app, invalid code, then ULTIMATEROBOTS.
  const secret=await f.evaluate(()=>{
    const beforeQuest=window.__UNFIRE_CASE_QA.mission;
    const beforeSave=localStorage.getItem('unfire_save_v1');
    const tube=document.getElementById('tube');
    assertExists(tube&&document.getElementById('pcMysteryApp'),'House computer missing mystery app');
    tube.classList.add('on');
    document.getElementById('pcMysteryApp').click();
    const fld=document.getElementById('pcSecretCode');
    fld.value='not-a-code';document.getElementById('pcSecretGo').click();
    const rejected=+(localStorage.getItem('unfire_unlock')||0)===0;
    fld.value='ULTIMATEROBOTS';document.getElementById('pcSecretGo').click();
    const unlocked=+(localStorage.getItem('unfire_unlock')||0)>=20;
    const confirmation=document.getElementById('pcResult').textContent;
    document.getElementById('tubeX').click();
    return {rejected,unlocked,confirmation,questStillActive:window.__UNFIRE_CASE_QA.mission===beforeQuest,storyUnchanged:localStorage.getItem('unfire_save_v1')===beforeSave};
    function assertExists(v,msg){if(!v)throw Error(msg);}
  });
  assert(secret.rejected&&secret.unlocked&&secret.questStillActive&&secret.storyUnchanged&&secret.confirmation.includes('desbloqueados'),'Secret app unlock/persistence or mission isolation failed: '+JSON.stringify(secret));
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
  console.log('PASS desktop browser: portable capsule throw/repack, mystery code, preserved quest and game, 11 mission completion predicates, no JS errors');
 }catch(e){console.error('FAIL',e.stack?.slice(0,1200));process.exitCode=1}
 finally{if(browser)await browser.close()}
})();
