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
      const stage=window.__mal.S,renderer=stage.renderer;
      const originalRender=renderer.render;
      const renderedAt=[],rafAt=[];
      // Software WebGL in CI can require several seconds per frame; sample long enough
      // to collect multiple render calls without imposing any FPS pass threshold.
      const samplingMs=16000;
      const start=performance.now();
      // Count the final game scene-camera render, not merely browser RAF ticks.
      // Other offscreen reflection passes have different cameras and are excluded.
      renderer.render=function(scene,camera){
        if(scene===stage.scene&&camera===stage.camera)renderedAt.push(performance.now());
        return originalRender.apply(this,arguments);
      };
      try{
        await new Promise(resolve=>{
          function sample(now){
            rafAt.push(now);
            if(now-start>=samplingMs || rafAt.length>=600){resolve();return;}
            requestAnimationFrame(sample);
          }
          requestAnimationFrame(sample);
        });
      }finally{
        renderer.render=originalRender;
      }
      const intervals=a=>a.slice(1).map((t,i)=>t-a[i]);
      return {
        renderIntervals:intervals(renderedAt),
        rafIntervals:intervals(rafAt),
        visible:!document.hidden,
        rendererInfo:renderer.info?.render ? {
          calls:renderer.info.render.calls,
          triangles:renderer.info.render.triangles,
          lines:renderer.info.render.lines
        }:null,
        qualityTier:window.__UNFIRE_AUTOCALIB?.tier||null,
        maxDpr:window.__UNFIRE_AUTOCALIB?.maxDpr||null,
        activeDpr:renderer.getPixelRatio?.()||null
      };
    });
    const elapsedMs=Date.now()-started;
    const metric=summarizeFrames(probe.renderIntervals,Number(process.env.UNFIRE_PROFILE_TARGET_FPS||60));
    const rafProxy=summarizeFrames(probe.rafIntervals,Number(process.env.UNFIRE_PROFILE_TARGET_FPS||60));
    // Emit diagnostics without enforcing an arbitrary FPS threshold in software-rendered CI.
    const output={
      kind:'unfire-frame-profile-v1',source:'game-scene-camera-render-calls-headless-diagnostic',
      disclaimer:'WebGL render-call interval proxy; not display-present FPS, physical-device FPS or network-latency certification.',
      viewport:await page.evaluate(()=>({width:innerWidth,height:innerHeight})),
      qualityTier:probe.qualityTier,maxDpr:probe.maxDpr,activeDpr:probe.activeDpr,
      visible:probe.visible,elapsedMs,metrics:metric,rafProxy,rendererInfo:probe.rendererInfo,pageErrors:errors
    };
    console.log('UNFIRE_FRAME_PROFILE '+JSON.stringify(output));
    assert(probe.visible,'Page was backgrounded; metrics invalid');
    assert(metric.samples>=2,'Insufficient game scene render calls to calculate timing');
    assert.equal(errors.length,0,'Uncaught page errors during sample');
  }catch(error){
    console.error('[unfire-frame-profile]',error.stack||error);
    process.exitCode=1;
  }finally{
    if(browser)await Promise.race([browser.close(),new Promise((_,reject)=>setTimeout(()=>reject(Error('browser.close timeout')),5000))])
      .catch(err=>{console.error('[unfire-frame-profile] cleanup:',err.message);process.exitCode=1;});
  }
})();
