// End-to-end first tap: from the Unfire Audio website into full-viewport gameplay.
// The test never writes game files or alters story saves.
const assert=require('node:assert/strict');
const {chromium}=require(process.env.UNFIRE_PLAYWRIGHT_PATH||'playwright');
(async()=>{
 const browser=await chromium.launch({
   headless:true,executablePath:process.env.UNFIRE_CHROME||undefined,
   args:['--enable-unsafe-swiftshader','--disable-dev-shm-usage','--no-sandbox']
 });
 try{
   const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   await page.goto(process.env.UNFIRE_ENTRY_URL||'http://127.0.0.1:8765/audio/',{waitUntil:'domcontentloaded',timeout:45000});
   await page.locator('#openBtn').click({timeout:12000});
   await page.waitForFunction(()=>{
     const g=document.getElementById('malFrame')?.contentWindow;
     return !!g?.__UNFIRE_CASE_QA?.roam && g.__UNFIRE_CASE_QA.lid>0.94;
   },null,{timeout:120000,polling:300});
   const first=await page.evaluate(()=>{
     const pin=document.getElementById('heroPin');
     const frame=document.getElementById('malFrame');
     const game=frame.contentWindow;
     return {
       immersive:document.body.classList.contains('immOn')&&document.documentElement.classList.contains('immOn'),
       fullViewport:pin.classList.contains('imm')&&frame.getBoundingClientRect().width>=innerWidth-1&&frame.getBoundingClientRect().height>=innerHeight-1,
       fullscreenAllowed:frame.allowFullscreen&&frame.allow.includes('fullscreen'),
       roaming:game.__UNFIRE_CASE_QA.roam,
       lid:game.__UNFIRE_CASE_QA.lid,
       exit:!!game.document.getElementById('unfireExitGame'),
       gameSource:frame.getAttribute('src')
     };
   });
   assert(first.immersive&&first.fullViewport&&first.fullscreenAllowed&&first.roaming&&first.lid>0.94&&first.exit,
     'Single tap did not enter immersive playable world '+JSON.stringify(first));
   for(const [width,height] of [[390,844],[844,390]]){
     await page.setViewportSize({width,height});
     await page.waitForFunction(()=>{
       const frame=document.getElementById('malFrame'),game=frame.contentWindow;
       const rect=frame.getBoundingClientRect();
       return Math.abs(rect.width-innerWidth)<2&&Math.abs(rect.height-innerHeight)<2
         &&Math.abs(game.__mal.S.camera.aspect-rect.width/rect.height)<.025;
     },null,{timeout:12000,polling:250});
     const state=await page.evaluate(()=>{
       const d=document.getElementById('malFrame').contentWindow.document;
       const story=d.getElementById('story');assertExists(story);
       d.body.classList.add('storyOn');story.classList.add('on');
       const rect=(el)=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
       const box=rect(story.querySelector('.box'));
       const touch=['unfireTouchPad','unfireFly','unfireTalk','unfireDown','caseModeHud']
         .map(id=>({id,hidden:getComputedStyle(d.getElementById(id)).display==='none'}));
       const exit=rect(d.getElementById('unfireExitGame'));
       return {box,touch,exit};
       function assertExists(x){if(!x)throw Error('Story overlay missing');}
     });
     const b=state.box;
     assert(b.x>=-1&&b.y>=-1&&b.x+b.w<=width+2&&b.y+b.h<=height+2,
       'Nimbo story dialogue clipped '+JSON.stringify({width,height,b}));
     assert(state.touch.every(x=>x.hidden),
       'Buttons overlap active story dialogue '+JSON.stringify(state.touch));
     assert(state.exit.x>=-1&&state.exit.y>=-1&&state.exit.x+state.exit.w<=width+1,
       'Game exit clipped by small viewport');
   }
   // A directly shared maletín URL has no website wrapper: it must still
   // enter fullscreen when supported and use every available viewport pixel.
   const direct=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
   direct.on('pageerror',e=>errors.push('direct: '+e.message));
   const directUrl=new URL('maletin/index.html',process.env.UNFIRE_ENTRY_URL||'http://127.0.0.1:8765/audio/').href;
   await direct.goto(directUrl,{waitUntil:'domcontentloaded',timeout:45000});
   await direct.locator('#directOpen').click({timeout:12000});
   await direct.waitForFunction(()=>Boolean(window.__UNFIRE_CASE_QA?.roam&&window.__UNFIRE_CASE_QA?.lid>.94),null,{timeout:120000,polling:300});
   const directCheck=await direct.evaluate(()=>({
     viewportWidth:innerWidth,canvasWidth:document.getElementById('cv').getBoundingClientRect().width,
     cameraAspect:window.__mal.S.camera.aspect,
     directOpenHidden:document.getElementById('directOpen').hidden,
     panoramaFov:window.__mal.S.camera.fov,
   }));
   assert(directCheck.canvasWidth>=directCheck.viewportWidth-1&&directCheck.directOpenHidden
     &&directCheck.cameraAspect<.6,'Direct mobile entry was not panoramic '+JSON.stringify(directCheck));
   await direct.close();
   assert.deepEqual(errors,[],'Game JavaScript exceptions');
   console.log('PASS fullscreen host and direct URL, portrait and landscape, responsive panoramic game, 0 JS exceptions');
 } finally {await browser.close();}
})().catch(e=>{console.error('FAIL first-tap',e.stack||e);process.exitCode=1;});
