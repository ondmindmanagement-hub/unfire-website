'use strict';
// Opt-in diagnostic, not a CI performance certification. Runs once in an isolated browser.
// node scripts/unfire-browser-qa-guard.cjs --timeout-ms=120000 -- node tests/unfire-frame-profile-browser.cjs
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {summarizeFrames}=require('../scripts/unfire-frame-metrics.cjs');

(async()=>{
  let browser;
  try{
    const url=process.env.UNFIRE_PROFILE_URL||'http://127.0.0.1:8765/audio/maletin/index.html?quality=compact';
    const started=Date.now();
    browser=await chromium.launch({
      headless:true,executablePath:process.env.UNFIRE_CHROME||undefined,
      args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage','--no-sandbox']
    });
    const page=await browser.newPage({
      viewport:{width:Number(process.env.UNFIRE_PROFILE_WIDTH||960),height:Number(process.env.UNFIRE_PROFILE_HEIGHT||640)},
      deviceScaleFactor:1
    });
    const errors=[];
    page.on('pageerror',e=>errors.push(String(e.message||e).slice(0,220)));
    const nav=await page.goto(url,{waitUntil:'domcontentloaded',timeout:40000});
    assert(nav?.ok(),'Maletín failed to load: HTTP '+nav?.status());
    await page.waitForFunction(()=>!!window.__mal?.S?.renderer,null,{timeout:65000,polling:250});
    // Collect intervals only; avoid sending an extra request or changing the scene.
    // In hidden/background tabs RAF throttles; this page remains foreground.
    const probe=await page.evaluate(async ()=>{
      const intervals=[],ms=6000;
      const start=performance.now();
      let last=null,first=null;
      return await new Promise(resolve=>{
        function frame(now){
          if(first===null)first=now;
          if(last!==null)intervals.push(now-last);
          last=now;
          if(now-first>=ms || intervals.length>=600){
            const r=window.__mal?.S?.renderer;
            resolve({
              intervals,
              visible:!document.hidden,
              rendererInfo:r?.info?.render ? {
                calls:r.info.render.calls,
                triangles:r.info.render.triangles,
                lines:r.info.render.lines
              }:null,
              qualityTier:window.__UNFIRE_AUTOCALIB?.tier||null,
              maxDpr:window.__UNFIRE_AUTOCALIB?.maxDpr||null,
              activeDpr:r?.getPixelRatio?.()||null
            });
            return;
          }
          requestAnimationFrame(frame);
        }
        requestAnimationFrame(frame);
      });
    });
    const elapsedMs=Date.now()-started;
    const metric=summarizeFrames(probe.intervals,Number(process.env.UNFIRE_PROFILE_TARGET_FPS||60));
    // Emit diagnostics without enforcing an arbitrary FPS threshold in software-rendered CI.
    const output={
      kind:'unfire-frame-profile-v1',source:'chromium-headless-diagnostic',
      disclaimer:'Not a physical-device FPS or network-latency certification.',
      viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight})),
      qualityTier:probe.qualityTier,maxDpr:probe.maxDpr,activeDpr:probe.activeDpr,
      visible:probe.visible,elapsedMs,metrics:metric,rendererInfo:probe.rendererInfo,pageErrors:errors
    };
    console.log('UNFIRE_FRAME_PROFILE '+JSON.stringify(output));
    assert(probe.visible,'Page was backgrounded; metrics invalid');
    assert(metric.samples>=2,'Insufficient RAF frames to calculate timing');
    assert.equal(errors.length,0,'Uncaught page errors during sample');
  }catch(error){
    console.error('[unfire-frame-profile]',error.stack||error);
    process.exitCode=1;
  }finally{
    if(browser)await Promise.race([browser.close(),new Promise((_,reject)=>setTimeout(()=>reject(Error('browser.close timeout')),5000))])
      .catch(err=>{console.error('[unfire-frame-profile] cleanup:',err.message);process.exitCode=1;});
  }
})();
