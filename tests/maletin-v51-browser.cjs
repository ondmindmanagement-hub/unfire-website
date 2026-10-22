const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  let browser;
  try{
    browser=await chromium.launch({headless:true,args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage','--no-sandbox','--autoplay-policy=no-user-gesture-required']});
    const page=await browser.newPage({viewport:{width:1080,height:760},deviceScaleFactor:1});
    const errors=[];page.on('pageerror',e=>errors.push(e.message.slice(0,160)));
    await page.goto('http://127.0.0.1:8765/audio/',{waitUntil:'domcontentloaded',timeout:40000});
    await page.locator('#openBtn').evaluate(b=>b.click());
    await page.waitForFunction(()=>{const f=document.getElementById('malFrame');try{return !!f?.contentWindow?.__UNFIRE_WINDOWS&&!!f.contentWindow.__mal?.S}catch{return false}},{timeout:85000});
    const game=page.frames().find(f=>f.url().includes('/audio/maletin/index.html'));
    assert(game,'game frame');
    const initial=await game.evaluate(()=>{
      window.__mal.setP(1);window.__roamAPI.enterRoam();
      window.__SIDEM.offer('NIMBO');
      return {mission:window.__SIDEM.cur?.t,count:window.__UNFIRE_WINDOWS.definitions.length,roam:window.__UNFIRE_CASE_QA.roam};
    });
    assert(initial.mission&&initial.roam&&initial.count===8,'Mission or 8 portals unavailable');
    console.log('INITIAL',JSON.stringify(initial));
    const results=[];
    for(let n=0;n<8;n++){
      if(n>0)await wait(1400);
      const result=await game.evaluate((index)=>{
        const w=window.__UNFIRE_WINDOWS.definitions[index],r=window.__roamAPI.ROAMS;
        r.p.set(0,4.5,30);r.h=12;r.fly=true;r.flyH=12;r.vy=0;r.tgt=null;
        let px=0,pz=0,nx=0,nz=0;
        if(w.wall==='L'){px=-73;pz=w.at;nx=-76;nz=w.at}
        if(w.wall==='R'){px=73;pz=w.at;nx=76;nz=w.at}
        if(w.wall==='F'){px=w.at;pz=89;nx=w.at;nz=92}
        if(w.wall==='W'){px=w.at;pz=-9;nx=w.at;nz=-12}
        const hit=window.__UNFIRE_WINDOWS.cross(px,pz,nx,nz);
        return {id:w.id,hit,portal:window.__UNFIRE_WINDOWS.last,coords:window.__UNFIRE_CASE_QA.worldCoords,
          altitude:window.__UNFIRE_CASE_QA.altitude,area:window.__UNFIRE_CASE_QA.location,
          mission:window.__SIDEM.cur?.t,returnVisible:getComputedStyle(document.getElementById('unfireWindowHome')).display};
      },n);
      console.log('WINDOW_'+n,JSON.stringify(result));
      assert(result.hit&&result.id===result.portal&&result.area==='outside','Wrong portal '+result.id);
      assert.equal(result.mission,initial.mission,'Mission reset during '+result.id);
      assert.equal(result.returnVisible,'block','Return button hidden');
      if(result.id==='space'||result.id==='sky')assert(result.altitude>1000,'High-altitude portal failure');
      if(n===0){
        await game.evaluate(()=>window.__mal.toggleCase());
        const carried=await game.evaluate(()=>({carry:window.__UNFIRE_CASE_QA.carrying,mission:window.__SIDEM.cur?.t}));
        assert(carried.carry,'Case could not be carried after teleport');
        await game.evaluate(()=>{const b=document.getElementById('unfireCarryCase');if(!b)throw Error('carry button absent');b.click()});
        const opened=await game.evaluate(()=>({closed:window.__UNFIRE_CASE_QA.closed,
          carry:window.__UNFIRE_CASE_QA.carrying,
          caseY:window.__UNFIRE_CASE_QA.casePos[1],alt:window.__UNFIRE_CASE_QA.altitude}));
        assert(!opened.closed&&!opened.carry&&Math.abs(opened.caseY-opened.alt)<15,'Case did not open at destination');
      }
      await game.evaluate(()=>{const b=document.getElementById('unfireWindowHome');if(!b)throw Error('return button absent');b.click()});
      const home=await game.evaluate(()=>({area:window.__UNFIRE_CASE_QA.location,mission:window.__SIDEM.cur?.t,coords:window.__UNFIRE_CASE_QA.worldCoords}));
      assert(home.area==='house'&&home.mission===initial.mission,'Return broke storyline');
      results.push(result.id);
    }
    // Side missions are still completable after repeated world travel.
    const completions=await game.evaluate(()=>{
      const r=window.__roamAPI.ROAMS,list=[];
      for(let n=0;n<11;n++){
        if(!window.__SIDEM.cur)window.__SIDEM.offer('NIMBO');
        const m=window.__SIDEM.cur;
        r.p.x=m.x;r.p.z=m.z;r.h=m.y+70;
        window.__SIDEM.tick();list.push(!window.__SIDEM.cur);
      }
      return list;
    });
    assert.equal(completions.filter(Boolean).length,11,'Side mission completion regression');
    const host=await page.evaluate(()=>({src:document.getElementById('malFrame').getAttribute('src'),
      url:location.pathname,immersive:document.body.classList.contains('immOn')}));
    assert(host.src.includes('v=51')&&host.immersive,'Game returned to website');
    assert.equal(errors.length,0,'JS errors: '+errors.join(' | '));
    console.log('PASS',JSON.stringify({portals:results,missionCompletion:completions.length,host,errors:errors.length}));
  }catch(e){console.error('FAIL',e.stack?.slice(0,1400));process.exitCode=1}
  finally{if(browser)await browser.close()}
})();
