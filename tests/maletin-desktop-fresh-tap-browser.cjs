'use strict';
// Desktop-only isolated browser repro for PR #105. Never modifies the game.
// Run in GitHub Actions; no physical device or FPS certification.
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require(process.env.UNFIRE_PLAYWRIGHT_PATH || 'playwright');
const port = Number(process.env.UNFIRE_DESKTOP_TAP_PORT || 8873);
const host = 'http://127.0.0.1:' + port;
let browser, context, server;
const events = [];
const bound = (action, ms = 4000) => Promise.race([
  Promise.resolve().then(action).then(() => true, () => false),
  new Promise(resolve => setTimeout(() => resolve(false), ms))
]);
(async () => {
  try {
    server = spawn('python3', ['-m','http.server',String(port),'--bind','127.0.0.1'],
      {cwd:path.resolve(__dirname,'..'),stdio:'ignore'});
    await new Promise(resolve => setTimeout(resolve, 900));
    browser = await chromium.launch({headless:true,
      args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage','--no-sandbox']});
    context = await browser.newContext({viewport:{width:1280,height:800},
      isMobile:false,hasTouch:false,deviceScaleFactor:1});
    const page = await context.newPage();
    page.on('pageerror', error => events.push(String(error.message).slice(0,250)));
    await page.goto(host + '/audio/', {waitUntil:'domcontentloaded',timeout:30000});
    await page.waitForFunction(() => {
      const fr = document.getElementById('malFrame'), w = fr?.contentWindow;
      return document.getElementById('heroPin')?.classList.contains('scene-ready')
        && !!w?.__UNFIRE_CASE_QA && !!w?.__ringB;
    },null,{timeout:85000,polling:200});
    const before = await page.evaluate(() => {
      const f=document.getElementById('malFrame'),w=f.contentWindow;
      const c=w.__dbg.S.camera,ring=w.__ringB;
      ring.updateWorldMatrix(true,false);c.updateMatrixWorld(true);
      const p=ring.getWorldPosition(ring.position.clone().set(0,0,0)).project(c);
      const r=f.getBoundingClientRect();
      const x=r.left+(p.x+1)*r.width/2, y=r.top+(1-p.y)*r.height/2;
      window.__tapHostEvents=[];w.__tapFrameEvents=[];
      for(const name of ['pointerdown','pointerup','mousedown','mouseup','click']){
        document.addEventListener(name,e=>window.__tapHostEvents.push({
          type:name, target:e.target?.id||e.target?.tagName, x:e.clientX,y:e.clientY
        }),true);
        w.document.addEventListener(name,e=>w.__tapFrameEvents.push({
          type:name,target:e.target?.id||e.target?.tagName,x:e.clientX,y:e.clientY
        }),true);
      }
      return {x,y,rect:[r.x,r.y,r.width,r.height],viewport:[innerWidth,innerHeight],
        hostTarget:document.elementFromPoint(x,y)?.id||document.elementFromPoint(x,y)?.tagName,
        innerTarget:w.document.elementFromPoint(x-r.left,y-r.top)?.id||
          w.document.elementFromPoint(x-r.left,y-r.top)?.tagName,
        iframeClip:getComputedStyle(f).clipPath,iframePointer:getComputedStyle(f).pointerEvents,
        closed:w.__UNFIRE_CASE_QA.closed,ringVisible:ring.visible,
        immersive:document.body.classList.contains('immOn')};
    });
    console.log('DESKTOP_BEFORE',JSON.stringify(before));
    assert(before.x>2&&before.x<1278&&before.y>2&&before.y<798,
      'Real 3D butterfly must project on desktop viewport');
    assert.equal(before.closed,true,'Case starts closed');
    await page.mouse.click(before.x,before.y);
    let waitFailure=null;
    try {
      await page.waitForFunction(() => {
        const f=document.getElementById('malFrame'),q=f?.contentWindow?.__UNFIRE_CASE_QA;
        return document.body.classList.contains('immOn')&&q&&!q.closed;
      },null,{timeout:30000,polling:150});
    } catch(error){waitFailure=String(error.message);}
    const after=await page.evaluate(() => {
      const f=document.getElementById('malFrame'),w=f?.contentWindow,q=w?.__UNFIRE_CASE_QA;
      return {immersive:document.body.classList.contains('immOn'),
        closed:q?.closed,caseVisible:q?.caseVisible,hasQA:!!q,
        hostEvents:(window.__tapHostEvents||[]).slice(-14),
        iframeEvents:(w?.__tapFrameEvents||[]).slice(-14),
        iframeClip:f?getComputedStyle(f).clipPath:null,
        framePointer:f?getComputedStyle(f).pointerEvents:null};
    });
    console.log('DESKTOP_AFTER',JSON.stringify({after,waitFailure,pageErrors:events}));
    assert.equal(waitFailure,null,'Desktop open timed out: '+waitFailure);
    assert(after.immersive && after.closed===false && after.caseVisible,
      'Desktop click must open actual case');
    assert.equal(events.length,0,'No uncaught JS exceptions: '+events.join('; '));
    console.log('DESKTOP_FRESH_TAP_PASS');
  } catch(error){
    console.error('DESKTOP_FRESH_TAP_FAIL',error.stack||error);
    process.exitCode=1;
  } finally {
    if(context) await bound(()=>context.close());
    if(browser){
      const child=typeof browser.process==='function'?browser.process():null;
      const closed=await bound(()=>browser.close());
      if(!closed&&child&&!child.killed)try{child.kill('SIGTERM')}catch(_){}
    }
    if(server && server.exitCode===null)server.kill('SIGTERM');
  }
})();
