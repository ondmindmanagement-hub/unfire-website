'use strict';
// Capture aerial gameplay directly from the published Unfire Three.js engine.
// No image-generation, composites, replacement textures or mock artwork.
const {chromium} = require('playwright');
const {spawn} = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const PORT = 8789;
const output = path.resolve(__dirname, '../audio/press/captures');
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const scenes = [
  {file:'05-sky-flight-day.jpg', phase:0.27, pos:[-120, 4.5, 215], altitude:116, yaw:0.51, pitch:0.13, lighting:'day'},
  {file:'06-sky-flight-sunset.jpg', phase:0.49, pos:[-105, 4.5, 195], altitude:91, yaw:0.45, pitch:0.11, lighting:'sunset'},
  {file:'07-sky-flight-night.jpg', phase:0.76, pos:[-125, 4.5, 238], altitude:126, yaw:0.50, pitch:0.19, lighting:'night'}
];

(async () => {
  fs.mkdirSync(output, {recursive:true});
  const server = spawn('python3', ['-m','http.server',String(PORT),'--bind','127.0.0.1'], {
    cwd:path.resolve(__dirname,'..'), stdio:'ignore'
  });
  let browser;
  try {
    await sleep(1200);
    browser = await chromium.launch({headless:true,args:[
      '--no-sandbox','--disable-dev-shm-usage','--use-gl=angle','--use-angle=swiftshader'
    ]});
    const context = await browser.newContext({
      viewport:{width:1280,height:720},deviceScaleFactor:1,reducedMotion:'reduce'
    });
    try {
      const page = await context.newPage();
      page.setDefaultTimeout(20000);
      const errors=[];
      page.on('pageerror',error=>errors.push(String(error.message).slice(0,180)));
      const response=await page.goto('http://127.0.0.1:'+PORT+'/audio/maletin/index.html?quality=compact',{
        waitUntil:'domcontentloaded',timeout:45000
      });
      assert.equal(response.status(),200);
      await page.waitForFunction(()=>Boolean(window.__mal?.setP &&
        window.__roamAPI?.enterRoam && window.__ROOM?.R?.userData),null,
        {timeout:120000,polling:400});
      await page.evaluate(()=>{
        window.__mal.setP(1);
        window.__roamAPI.enterRoam();
        document.getElementById('atmBtn')?.click();
      });
      await page.waitForFunction(()=>window.ATM_OUT===true && window.__roamAPI.ROAMS.on,
        null,{timeout:30000,polling:250});
      // Remove only DOM HUD/dialogue. All 3D scenery/lighting/robots remain game-native.
      await page.addStyleTag({content:[
        '#hud,#tip,#ctlDock,#cfgB,#minimap,#stO,#unfireTouchPad,#unfireTouchKnob,',
        '#unfireFly,#unfireTalk,#unfireDown,#unfireCarryCase,#unfireExitGame,',
        '#wradio,#unfireCoinHud,#atmBtn,#onlB,#storyHud,#story,#storyMenu,#intro,',
        '#nimboIntro,#unfireAdaptiveLoader,#directOpen,#howto{visibility:hidden!important}'
      ].join('')});
      for (const scene of scenes) {
        await page.evaluate(s=>{
          const r=window.__roamAPI.ROAMS;
          r.k={};r.tgt=null;r.on=true;r.mode='3p';r.mini=false;
          r.p.set(...s.pos);r.h=s.altitude;r.flyH=s.altitude;r.fly=true;
          r.flyT=2;r.climbV=0;r.vy=0;r.wk=1;r.moving=false;
          r.yaw=s.yaw;r.cy=s.yaw;r.pitch=s.pitch;r.cp=null;
          window.__ROOM.R.userData.camTrack=null;
          // The game's own eight-minute cycle chooses the real sky texture and lights.
          window.__ROOM.R.userData.dayT=s.phase;
        },scene);
        await page.waitForFunction(s=>{
          const r=window.__roamAPI.ROAMS;
          const d=window.__ROOM.R.userData.dl;
          return r.fly && r.on && !!window.ATM_OUT &&
            r.av?.w?.visible && r.h>60 &&
            (s.lighting==='night'?d<0.18:s.lighting==='day'?d>0.65:d>=0.18&&d<0.45);
        },scene,{timeout:50000,polling:300});
        await sleep(1900);
        const state=await page.evaluate(()=>{
          const r=window.__roamAPI.ROAMS,cv=document.getElementById('cv');
          const day=window.__ROOM.R.userData.dl;
          return {roam:r.on,fly:r.fly,night:day<0.18,daylight:day,
            altitude:r.h,avatar:!!r.av?.w?.visible,exterior:!!window.ATM_OUT,
            renderCanvas:!!cv&&cv.width>10&&cv.height>10};
        });
        assert(state.roam&&state.fly&&state.avatar&&state.exterior&&state.renderCanvas,
          'Actual third-person flight not active: '+JSON.stringify(state));
        if(scene.lighting==='night') assert(state.night,'Must be game-native nighttime');
        if(scene.lighting==='day') assert(state.daylight>0.65,'Must be daytime');
        assert.equal(errors.length,0,'Game errors: '+errors.join('; '));
        const file=path.join(output,scene.file);
        await page.screenshot({path:file,type:'jpeg',quality:88,animations:'disabled',timeout:60000});
        const bytes=fs.statSync(file).size;
        assert(bytes>28000,'Game capture missing or blank: '+scene.file+' '+bytes);
        console.log('AUTHENTIC_AERIAL_GAMEPLAY',scene.file,bytes,JSON.stringify(state));
      }
    } finally {await context.close();}
  } finally {
    if(browser) await browser.close();
    server.kill('SIGTERM');
  }
})().catch(error=>{
  console.error('UNFIRE_AERIAL_CAPTURE_FAILED',error.stack||error);
  process.exitCode=1;
});
