'use strict';
const assert=require('node:assert/strict');
const path=require('node:path');
const {chromium}=require('playwright');
(async()=>{
  const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  try{
    async function setup(mobile,reduced){
      const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1200,height:820},
        hasTouch:mobile,isMobile:mobile,deviceScaleFactor:1,reducedMotion:reduced?'reduce':'no-preference'});
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      await page.setContent('<!doctype html><html><head></head><body><main id="heroPin" style="position:relative;width:100vw;height:100vh"></main><button id="sndBtn" aria-pressed="false">Sound</button></body></html>');
      await page.addScriptTag({path:path.resolve(__dirname,'../audio/mobile-game-intro.js')});
      return {page,context,errors};
    }
    const a=await setup(true,false);
    await a.page.evaluate(()=>{window.__introPromise=window.UNFIRE_GAME_INTRO.play(document.getElementById('heroPin'));});
    await a.page.waitForSelector('#unfireGamesStart[data-stage="studio"]');
    await a.page.waitForSelector('#unfireGamesStart[data-skippable="yes"]',{timeout:3000});
    assert.equal(await a.page.locator('#unfireGamesStart .ugs-brand strong').textContent(),'UNFIRE GAMES');
    await a.page.waitForSelector('#unfireGamesStart[data-stage="game"]',{timeout:3000});
    assert.equal(await a.page.locator('#unfireGamesStart .ugs-title h2').innerText(),'Y2K ROBOTS');
    await a.page.locator('#unfireGamesStart .ugs-skip').click();
    await a.page.evaluate(()=>window.__introPromise);
    assert.equal(await a.page.locator('#unfireGamesStart').count(),0,'skip removes overlay');
    await a.page.evaluate(()=>window.UNFIRE_GAME_INTRO.play(document.getElementById('heroPin')));
    assert.equal(await a.page.locator('#unfireGamesStart').count(),0,'return does not replay');
    assert.deepEqual(a.errors,[]);
    await a.context.close();

    const b=await setup(true,true);
    await b.page.evaluate(()=>{window.__introPromise=window.UNFIRE_GAME_INTRO.play(document.getElementById('heroPin'));});
    await b.page.evaluate(()=>window.__introPromise);
    assert.equal(await b.page.locator('#unfireGamesStart').count(),0,'reduced motion exits');
    assert.deepEqual(b.errors,[]);
    await b.context.close();

    const c=await setup(false,false);
    await c.page.evaluate(()=>window.UNFIRE_GAME_INTRO.play(document.getElementById('heroPin')));
    assert.equal(await c.page.locator('#unfireGamesStart').count(),0,'desktop no ident');
    assert.deepEqual(c.errors,[]);
    await c.context.close();
    console.log('PASS Chromium: phone studio/title/skip/resume, reduced-motion, desktop and no JS errors');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
