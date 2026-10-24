'use strict';
// Source-of-truth gameplay stills from the actual Three.js world; no artwork or AI compositing.
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
const PORT=8797,ROOT='http://127.0.0.1:'+PORT;
const output=path.resolve(__dirname,'../audio/press/captures');
function sleep(ms){return new Promise(r=>setTimeout(r,ms));}
(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const server=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{
    cwd:path.resolve(__dirname,'..'),stdio:'ignore'
  });
  let browser;
  try{
    await sleep(1000);
    browser=await chromium.launch({headless:true,args:[
      '--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader'
    ]});
    const context=await browser.newContext({viewport:{width:1280,height:720},deviceScaleFactor:1,reducedMotion:'reduce'});
    try{
      const page=await context.newPage();
      page.setDefaultTimeout(24000);
      const errors=[];
      page.on('pageerror',err=>errors.push(String(err.message).slice(0,260)));
      const res=await page.goto(ROOT+'/audio/maletin/index.html?quality=compact',{waitUntil:'domcontentloaded',timeout:45000});
      assert.equal(res.status(),200);
      await page.waitForFunction(()=>Boolean(window.__mal?.setP&&window.__roamAPI?.enterRoam),null,{timeout:100000,polling:500});
      await page.evaluate(()=>{
        window.__mal.setP(1);
        window.__roamAPI.enterRoam();
      });
      await page.waitForFunction(()=>Boolean(window.__roamAPI?.ROAMS?.on),null,{timeout:25000});
      // For editorial stills, hide the HUD only; never replace or draw any game object.
      await page.addStyleTag({content:`
        #hud,#tip,#ctlDock,#cfgB,#minimap,#stO,#unfireTouchPad,#unfireTouchKnob,
        #unfireFly,#unfireTalk,#unfireDown,#unfireCarryCase,#unfireExitGame,
        #wradio,#unfireCoinHud,#atmBtn,#onlB,#storyHud,#story,#storyMenu,#intro,\n        #nimboIntro,#unfireGarageScrollStyle,
        #unfireAdaptiveLoader{visibility:hidden!important}
      `});
      // Screenshots of the world should not be dominated by a first-run tutorial.
      // Hide only DOM dialogue overlays; keep 3D meshes, light and scenery untouched.
      await page.evaluate(()=>{
        const label=/NIMBO\\s*[·-]\\s*(YOUR GUIDE|TU GUÍA)/i;
        for(const el of document.querySelectorAll('body *')){
          if(el.children.length>0 || !label.test((el.textContent||'').trim()))continue;
          const panel=el.closest('.box,[role="dialog"],[id*="intro" i]')||el.parentElement?.parentElement;
          if(panel && panel!==document.body && !panel.contains(document.getElementById('cv')))
            panel.style.setProperty('visibility','hidden','important');
        }
      });
      async function shot(file){
        await sleep(2300);
        assert.equal(errors.length,0,'JavaScript errors in real game: '+errors.join('; '));
        const state=await page.evaluate(()=>{
          const cv=document.getElementById('cv');
          return {roam:!!window.__roamAPI?.ROAMS?.on,outer:!!window.ATM_OUT,canvas:!!cv&&cv.width>10&&cv.height>10,width:cv?.width,height:cv?.height};
        });
        assert(state.roam&&state.canvas,'3D game must be active, not an illustration: '+JSON.stringify(state));
        const location=path.join(output,file);
        await page.screenshot({path:location,type:'jpeg',quality:83,animations:'disabled',timeout:60000});
        const bytes=fs.statSync(location).size;
        assert(bytes>20000,'Capture must not be a blank or missing screenshot: '+file+' '+bytes);
        console.log('AUTHENTIC_GAME_CAPTURE',file,bytes,JSON.stringify(state));
      }
      await shot('01-inside-house.jpg');
      await page.evaluate(()=>{const r=window.__roamAPI.ROAMS;r.p.set(-15,4.5,45);r.yaw=0.95;r.pitch=-0.08;});
      await shot('02-house-interior.jpg');
      await page.evaluate(()=>{
        const b=document.getElementById('atmBtn');
        if(!b)throw Error('No exterior gameplay control');
        b.click();
      });
      await page.waitForFunction(()=>window.ATM_OUT===true,null,{timeout:25000});
      await page.evaluate(()=>{const r=window.__roamAPI.ROAMS;r.p.set(-48,4.5,175);r.yaw=2.52;r.pitch=-0.13;});
      await shot('03-house-exterior.jpg');
      await page.evaluate(()=>{const r=window.__roamAPI.ROAMS;r.p.set(-15,4.5,185);r.yaw=2.06;r.pitch=-0.10;});
      await shot('04-island-exploration.jpg');
      assert.equal(errors.length,0,errors.join('; '));
    }finally{await context.close();}
  }finally{if(browser)await browser.close();server.kill('SIGTERM');}
})().catch(err=>{console.error('UNFIRE_AUTHENTIC_CAPTURE_FAILED',err.stack||err);process.exitCode=1;});
