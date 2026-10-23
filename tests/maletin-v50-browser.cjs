const { chromium }=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 let browser, page; const errors=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.UNFIRE_CHROME||undefined,args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage','--no-sandbox','--autoplay-policy=no-user-gesture-required']});
  const page=await browser.newPage({viewport:{width:1080,height:760},deviceScaleFactor:1});
  const errors=[];page.on('pageerror',err=>errors.push(err.message.slice(0,180)));
  await page.addInitScript(()=>{
    try{localStorage.setItem('unfire_save_v1',JSON.stringify({name:'Tester',level:1,ch:2,step:0,done:[0,1],met:true,ts:Date.now()}));}catch(e){}
  });
  await page.goto(process.env.UNFIRE_TEST_URL||'http://127.0.0.1:8765/audio/',{waitUntil:'domcontentloaded',timeout:30000});
  const frame=page.frameLocator('#malFrame');
  await frame.locator('#directOpen').count();
  await page.waitForFunction(()=>{try{return !!document.getElementById('malFrame')?.contentWindow?.__mal?.S}catch{return false}},null,{timeout:90000,polling:250});
  const f=page.frames().find(x=>x.url().includes('/audio/maletin/index.html'));
  assert(f,'Game iframe missing');
  assert.equal(await page.locator('#openBtn').count(),0,'2D opener must not exist');
  // In software WebGL CI, Playwright boundingBox() can stall despite canvas
  // readiness. Synthesize the *same* pointerdown/up on the 3D case instead;
  // real physical Chromium pointer input is tested by the separate local QA.
  const tap=await page.evaluate(()=>{
    const w=document.getElementById('malFrame').contentWindow;
    const canvas=w.document.getElementById('cv');if(!canvas)return false;
    const rect=canvas.getBoundingClientRect();
    const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
    const p={bubbles:true,cancelable:true,pointerId:19,pointerType:'mouse',button:0,clientX:x,clientY:y};
    canvas.dispatchEvent(new w.PointerEvent('pointerdown',{...p,buttons:1}));
    w.dispatchEvent(new w.PointerEvent('pointerup',{...p,buttons:0}));
    return true;
  });
  assert(tap,'3D case canvas was unavailable for the first-tap probe');
  await page.waitForFunction(()=>document.body.classList.contains('immOn'),null,{timeout:30000});
  // CI runs WebGL in CPU software, causing >1min stalls on animation frames.
  // Pause only its render scheduler, preserving all actual gameplay actions and
  // testing capsule physics through real deterministic simulation ticks below.
  await f.evaluate(()=>{
    if(location.hostname==='127.0.0.1')
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
  });
  await f.evaluate(()=>{window.__mal.setP(1);window.__mal.requestOpen();window.__roamAPI.enterRoam();window.__SIDEM.offer('NIMBO')});
  const initial=await f.evaluate(()=>({mission:window.__UNFIRE_CASE_QA.mission,originalButterfly:window.__UNFIRE_CASE_QA.originalButterfly,roam:window.__UNFIRE_CASE_QA.roam}));
  assert(initial.mission&&initial.originalButterfly&&initial.roam,'Mission, roam or real 3D butterfly not initialized');
  assert(await f.evaluate(()=>window.__UNFIRE_CASE_QA.portableUnlocked),'Capsule should unlock at third mission');
  await f.evaluate(()=>window.__mal.toggleCase());
  const closed=await f.evaluate(()=>({closed:window.__UNFIRE_CASE_QA.closed,carrying:window.__UNFIRE_CASE_QA.carrying,mission:window.__UNFIRE_CASE_QA.mission}));
  console.log('CASE_STATE_DIAGNOSTIC',JSON.stringify({initial,closed}));
  assert(closed.closed&&closed.carrying&&closed.mission===initial.mission,'Closing case loses game or quest');
  const host=await page.evaluate(()=>({url:location.pathname,frameSrc:document.getElementById('malFrame').getAttribute('src'),immersive:document.body.classList.contains('immOn')}));
  assert(host.immersive&&host.frameSrc.includes('v=20261023case2'),'Game returned to website after closing case');
  const control=await f.evaluate(()=>{const b=document.getElementById('unfireCarryCase');if(!b)return {exists:false};const q=b.getBoundingClientRect();return {exists:true,display:getComputedStyle(b).display,visibility:getComputedStyle(b).visibility,rect:[q.x,q.y,q.width,q.height],hidden:b.hidden,roam:window.__UNFIRE_CASE_QA.roam,carry:window.__UNFIRE_CASE_QA.carrying};});
  console.log('CARRY_BUTTON_DIAGNOSTIC',JSON.stringify(control));
  assert.equal(await f.evaluate(()=>window.__UNFIRE_CASE_QA.caseVisible),false,'Case must not obstruct player camera when packed');
  // The reusable capsule is actually thrown; reopening takes place on landing.
  await f.evaluate(()=>{const b=document.getElementById('unfireCarryCase');if(!b)throw Error('Capsule control missing');b.click()});
  const flying=await f.evaluate(()=>window.__UNFIRE_CASE_QA.capsuleFlying);
  assert(flying,'Capsule launch did not start');
  // Physics is identical; CI headless WebGL rendering speed is irrelevant.
  const landed=await f.evaluate(()=>window.__UNFIRE_CASE_QA.advanceCapsuleInLocalTest(18));
  assert(landed,'Capsule did not land after physical simulation steps');
  const opened=await f.evaluate(()=>({closed:window.__UNFIRE_CASE_QA.closed,carrying:window.__UNFIRE_CASE_QA.carrying,mission:window.__UNFIRE_CASE_QA.mission,visible:window.__UNFIRE_CASE_QA.caseVisible}));
  assert(!opened.closed&&!opened.carrying&&opened.visible&&opened.mission===initial.mission,'Capsule landing lost case or active mission');
  await f.evaluate(()=>{window.__mal.showCaseView();});
  const inspecting=await f.evaluate(()=>window.__UNFIRE_CASE_QA.inspecting);
  assert(inspecting,'Case close-up camera did not enable');
  const inspectorKeys=await f.evaluate(()=>{
    window.__roamAPI.ROAMS.k.w=0;
    dispatchEvent(new KeyboardEvent('keydown',{key:'w',bubbles:true,cancelable:true}));
    const walkKeyCaptured=!!window.__roamAPI.ROAMS.k.w;
    dispatchEvent(new KeyboardEvent('keydown',{key:'g',bubbles:true,cancelable:true}));
    return {walkKeyCaptured,packed:window.__UNFIRE_CASE_QA.carrying};
  });
  assert(!inspectorKeys.walkKeyCaptured&&!inspectorKeys.packed,'Case inspection should prioritize playing W/G keys over walking or capsule controls: '+JSON.stringify(inspectorKeys));
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
  const rapid=await f.evaluate(()=>{const a=[],initial=window.__UNFIRE_CASE_QA.closed;for(let i=0;i<4;i++){window.__mal.toggleCase();a.push(window.__UNFIRE_CASE_QA.closed)}return {initial,states:a};});
  assert(rapid.states.every((v,i)=>v===(i%2===0?!rapid.initial:rapid.initial)),'Rapid click target-state toggle not alternating: '+JSON.stringify(rapid));
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
  // Workshop must display actual cached 3D robot portraits and leave room for player.
  // Localized UI may label this control TALLER or WORKSHOP: its stable ID is language-independent.
  const workshopDiag=await f.evaluate(()=>({lang:window.__LANG||navigator.language,hud:!!document.getElementById('storyHud'),button:!!document.getElementById('unfireWorkshopHud')}));
  console.log('WORKSHOP_UI_DIAGNOSTIC',JSON.stringify(workshopDiag));
  await f.waitForFunction(()=>!!document.getElementById('unfireWorkshopHud'),null,{timeout:25000,polling:150});
  await f.evaluate(()=>{const b=document.getElementById('unfireWorkshopHud');if(!b)throw Error('Workshop action missing');b.click()});
  await f.waitForFunction(()=>document.querySelectorAll("#onT .robotCard img").length>=2,{timeout:20000}).catch(()=>{});
  const studio=await f.evaluate(()=>{const panel=document.querySelector('#onl .b').getBoundingClientRect();return {cards:document.querySelectorAll('#onT .robotCard').length,locked:document.querySelectorAll('#onT .robotCard:disabled').length,portraits:document.querySelectorAll('#onT .robotCard img').length,width:panel.width,viewport:innerWidth}});
  assert(studio.cards===20&&studio.locked===0&&studio.portraits>=2&&studio.width<studio.viewport*0.5,'Workshop obstructs player or 3D portraits missing: '+JSON.stringify(studio));
  // PeerJS failure/retry/cancel regression runs as a single page task.
  // A CPU-only CI WebGL renderer can delay Playwright polling for seconds;
  // synchronous microtask flushing is deterministic and does not change game.
  const peerQA=await f.evaluate(async()=>{
    const original=window.Peer;
    let destroyed=0;
    const code=document.getElementById('onCode');
    const button=document.getElementById('onJoin');
    const status=document.getElementById('onMsg');
    try {
      window.Peer=class SimulatedPeerFailure {
        on(event,cb){if(event==='error')queueMicrotask(()=>cb({type:'peer-unavailable'}));return this;}
        destroy(){destroyed++;}
      };
      document.getElementById('onlB').click();
      code.value='ABCDE';
      button.click();
      await Promise.resolve();
      const first=status.textContent||'';
      button.click();
      await Promise.resolve();
      const second=status.textContent||'';
      const afterErrors=destroyed;
      window.Peer=class SimulatedPeerStall {
        on(){return this;}
        destroy(){destroyed++;}
      };
      button.click();
      document.getElementById('onX').click();
      return {first,second,afterErrors,destroyed,
        cancelled:!document.getElementById('onl').classList.contains('on')};
    } finally {window.Peer=original;}
  });
  assert(/(Esa sala no existe|That room does not exist)/.test(peerQA.first)&&/(Esa sala no existe|That room does not exist)/.test(peerQA.second)
    &&peerQA.afterErrors>=2&&peerQA.destroyed>=3&&peerQA.cancelled,
    'PeerJS error/retry/close did not recover cleanly '+JSON.stringify(peerQA));
  console.log('PASS PeerJS error/retry/stalled cancellation without third-party network or polling delays');
  // First-time players use the case on the table; carrying is locked until chapter 3.
  // Release the validated first game and its software WebGL context before
  // launching another; CI runners have limited RAM/GPU time.
  await page.close();
  const firstPage=await browser.newPage({viewport:{width:960,height:700}});
  const firstErrors=[];firstPage.on('pageerror',e=>firstErrors.push(e.message));
  await firstPage.addInitScript(()=>{try{localStorage.setItem('unfire_save_v1',JSON.stringify({name:'New',level:1,ch:0,step:0,done:[],met:true,ts:Date.now()}))}catch(e){}});
  // The website's first-tap entry is exercised separately by maletin-entry-fullscreen.
  // This check only needs the same game engine, not a *second* parent page+iframe.
  const direct=new URL('maletin/index.html',process.env.UNFIRE_TEST_URL||'http://127.0.0.1:8765/audio/').href;
  await firstPage.goto(direct,{waitUntil:'commit',timeout:120000});
  await firstPage.waitForFunction(()=>!!window.__mal?.S,null,{timeout:120000,polling:250});
  const newcomer=firstPage;
  await newcomer.evaluate(()=>{window.__mal.setP(1);window.__mal.requestOpen();window.__roamAPI.enterRoam();window.__mal.toggleCase()});
  const newbie=await newcomer.evaluate(()=>({unlocked:window.__UNFIRE_CASE_QA.portableUnlocked,carrying:window.__UNFIRE_CASE_QA.carrying,visible:window.__UNFIRE_CASE_QA.caseVisible,roam:window.__UNFIRE_CASE_QA.roam,disabled:document.getElementById('unfireCarryCase').disabled}));
  assert(!newbie.unlocked&&!newbie.carrying&&newbie.visible&&newbie.roam&&newbie.disabled,'Newcomer portable case should stay locked but normal gameplay continue: '+JSON.stringify(newbie));
  assert.equal(firstErrors.length,0,'Newcomer browser errors: '+firstErrors.join(' | '));
  await firstPage.close();
  assert.equal(errors.length,0,'Browser JavaScript errors: '+errors.join(' | '));
  console.log('PASS Chrome: capsule/repack, case camera, 20 3D workshop slots, 11 side missions, first-time chapter gate, no JS errors');
 }catch(e){console.error('FAIL',e.stack?.slice(0,1200));process.exitCode=1}
 finally{if(browser)await browser.close()}
})();
