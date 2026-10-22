const assert=require('node:assert/strict');
const {chromium}=require(process.env.UNFIRE_PLAYWRIGHT_PATH||'playwright');
(async()=>{
 let browser;
 const errors=[];
 try{
  browser=await chromium.launch({headless:true,executablePath:process.env.UNFIRE_CHROME||undefined,args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage','--no-sandbox']});
  const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
  const page=await context.newPage();
  page.on('pageerror',e=>errors.push(e.message.slice(0,250)));
  await page.goto(process.env.UNFIRE_MOBILE_URL||'http://127.0.0.1:8765/audio/maletin/index.html',{waitUntil:'domcontentloaded',timeout:45000});
  await page.waitForFunction(()=>Boolean(window.__mal?.S&&window.__roamAPI&&window.__UNFIRE_CASE_QA),null,{timeout:120000,polling:400});
  await page.evaluate(()=>{window.__mal.setP(1);window.__mal.requestOpen();window.__roamAPI.enterRoam();});
  const mission=await page.evaluate(()=>window.__UNFIRE_CASE_QA.mission);
  const check=async(width,height)=>{
    await page.setViewportSize({width,height});
    await page.waitForFunction(([w,h])=>window.__unfireViewport?.width===w&&window.__unfireViewport?.height===h,[width,height],{timeout:15000});
    await page.waitForTimeout(370);
    const state=await page.evaluate(()=>{
      const names=['unfireTouchPad','unfireFly','unfireTalk','ctlDock','minimap','cfgB'];
      const rect={};for(const name of names){const el=document.getElementById(name);if(!el)continue;const b=el.getBoundingClientRect();rect[name]={x:b.x,y:b.y,w:b.width,h:b.height,visible:getComputedStyle(el).display!=='none'};}
      const r=window.__roamAPI.ROAMS;const quality=window.__UNFIRE_ACTIVE_DEVICE;const pixelRatio=window.__mal.S.renderer.getPixelRatio();
      const s=window.__mal.S.renderer.getSize(new THREE.Vector2());
      return {size:[innerWidth,innerHeight],render:[s.x,s.y],rect,roam:r.on,mission:window.__UNFIRE_CASE_QA.mission,orientation:window.__unfireViewport.orientation,touch:getComputedStyle(document.getElementById('cv')).touchAction,quality:quality?.tier,pixelRatio,maxDpr:quality?.maxDpr};
    });
    assert.deepEqual(state.render,[width,height],'WebGL render size');
    assert.equal(state.roam,true,'Rotation ended gameplay');
    assert.equal(state.mission,mission,'Rotation lost story chapter');
    assert.equal(state.touch,'none','Game canvas should capture touch controls');
    assert(['compact','balanced'].includes(state.quality),'Touch device must pick quality automatically');
    assert(state.pixelRatio <= state.maxDpr + .01,'WebGL pixel ratio must respect device GPU budget');
    assert.equal(state.orientation,width>=height?'landscape':'portrait');
    for(const name of ['unfireTouchPad','unfireFly','unfireTalk']){
      const b=state.rect[name];assert(b&&b.visible&&b.w>0&&b.h>0,'missing touch control '+name);
      assert(b.x>=-1&&b.y>=-1&&b.x+b.w<=width+2&&b.y+b.h<=height+2,'Control outside mobile screen '+name+' '+JSON.stringify({b,width,height}));
    }
    const a=state.rect.unfireTouchPad,b=state.rect.unfireFly;
    assert(a.x+a.w<=b.x||b.x+b.w<=a.x||a.y+a.h<=b.y||b.y+b.h<=a.y,'Joystick and fly button overlap');
    console.log('PASS mobile',width+'x'+height,state.orientation,'mission preserved, touch controls fitted');
  };
  for(const [w,h] of [[390,844],[844,390],[320,568],[568,320],[390,844]])await check(w,h);
  await page.evaluate(()=>{const b=document.getElementById('onlB');if(!b)throw Error('Online button missing');b.click();});
  await page.waitForTimeout(200);
  const modal=await page.evaluate(()=>{const o=document.getElementById('onl');const b=o.querySelector('.b').getBoundingClientRect();return {display:getComputedStyle(o).display,width:b.width,height:b.height,viewport:innerHeight};});
  assert.equal(modal.display,'flex','online dialog hidden');
  assert(modal.height<=modal.viewport,'online dialog clipped on portrait phone');
  await page.evaluate(()=>document.getElementById('onX').click());
  assert.equal(errors.length,0,'browser JS errors '+errors.join('; '));
  console.log('PASS game mobile viewport rotation and online dialog; 0 browser exceptions');
 }catch(e){console.error('FAIL mobile',e.stack||e);process.exitCode=1;}
 finally{if(browser)await browser.close();}
})();
