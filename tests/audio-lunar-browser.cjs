'use strict';
// Playwright checks the *actual* game and lunar scene in Chromium software WebGL,
// not a mocked static page. No Mac GPU or user browser is touched.
const assert=require('node:assert/strict'),path=require('node:path'),{spawn}=require('node:child_process');
const {chromium}=require(process.env.UNFIRE_PLAYWRIGHT_PATH||'playwright');
const PORT=Number(process.env.UNFIRE_LUNAR_QA_PORT||8799);
const sleep=(n)=>new Promise(ok=>setTimeout(ok,n));
(async()=>{
 const http=spawn('python3',['-m','http.server',String(PORT),'--bind','127.0.0.1'],{cwd:path.join(__dirname,'..'),stdio:'ignore'});
 let browser;
 try{
   await sleep(750);
   browser=await chromium.launch({headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
   for(const d of [{name:'phone',w:390,h:844,touch:true},{name:'desktop',w:1366,h:768,touch:false}]){
     const context=await browser.newContext({viewport:{width:d.w,height:d.h},hasTouch:d.touch,isMobile:d.touch,deviceScaleFactor:1});
     try{
       const page=await context.newPage(),errors=[];
       page.on('pageerror',e=>errors.push(e.message));
       await page.goto('http://127.0.0.1:'+PORT+'/audio/maletin/index.html?quality=compact',{waitUntil:'domcontentloaded',timeout:30000});
       await page.waitForFunction(()=>window.__mal&&window.__roamAPI&&window.UnfireLunarWorld,{timeout:100000});
       await page.evaluate(()=>{
         window.__mal.setP(1);window.__roamAPI.enterRoam();
         window.ATM_OUT=true;
         window.__roamAPI.ROAMS.p.set(153,4.5,-58);
       });
       await page.waitForFunction(()=>!!window.__UNFIRE_LUNAR && !!document.querySelector('#unfireLunarGate') && getComputedStyle(document.querySelector('#unfireLunarGate')).display!=='none',{timeout:60000,polling:200});
       assert.equal(errors.length,0,'boot errors '+d.name+': '+errors.join(';'));
       const before=await page.evaluate(()=>({renderers:document.querySelectorAll('canvas#cv').length,gate:document.querySelector('#unfireLunarGate').textContent}));
       assert.equal(before.renderers,1,'only one WebGL canvas');
       assert(/PIE DERECHO|PECHO/.test(before.gate),'entry visible in island');
       await page.locator('#unfireLunarGate').click({force:true,timeout:20000});
       assert.equal(await page.evaluate(()=>window.__UNFIRE_LUNAR.mode),'ship');
       await page.locator('#unfireLunarUI button').first().click({force:true});
       assert.equal(await page.evaluate(()=>window.__UNFIRE_LUNAR.mode),'flight');
       const flight=await page.evaluate(()=>window.__UNFIRE_LUNAR.state);
       assert(flight.mode==='flight','cabin flight remains uninterrupted');
       await page.evaluate(()=>window.__UNFIRE_LUNAR.state && window.__UNFIRE_LUNAR.enter); // no side effects
       console.log('LUNAR_REAL_ENGINE_PASS',d.name,'ship-foot/chest and forward in-cabin flight',JSON.stringify(flight));
     }finally{await context.close()}
   }
 }finally{if(browser)await browser.close();http.kill('SIGTERM')}
})().catch(e=>{console.error('LUNAR_REAL_ENGINE_FAIL',e.stack||e);process.exitCode=1});
