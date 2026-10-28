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
   const initialGameURL=page.url();const initialTabCount=page.context().pages().length;
   assert.equal(await page.locator('#openBtn').count(),0,'2D butterfly button must not exist on website');
   await page.waitForFunction(()=>!!document.getElementById('malFrame')?.contentWindow?.__mal?.S,
     null,{timeout:120000,polling:250});
   // Avoid expensive layout-stability waits in GitHub CPU-only WebGL;
   // exercise the actual canvas pointerdown/up handler and 3D raycast.
   const tapped=await page.evaluate(()=>{
     const w=document.getElementById('malFrame').contentWindow;
     const canvas=w.document.getElementById('cv');if(!canvas)return false;
     const rect=canvas.getBoundingClientRect();
     const x=rect.left+rect.width/2,y=rect.top+rect.height/2;
     const p={bubbles:true,cancelable:true,pointerId:19,pointerType:'mouse',button:0,clientX:x,clientY:y};
     canvas.dispatchEvent(new w.PointerEvent('pointerdown',{...p,buttons:1}));
     w.dispatchEvent(new w.PointerEvent('pointerup',{...p,buttons:0}));
     return true;
   });
   assert(tapped,'3D maletín canvas was not initialized');
   await page.waitForFunction(()=>document.body.classList.contains('immOn'),null,{timeout:120000,polling:200});
   const instant=await page.evaluate(()=>({visible:document.body.classList.contains('immOn'),
     fullWidth:document.getElementById('malFrame').getBoundingClientRect().width>=innerWidth-1,
     noButtons:!document.querySelector('#openBtn')&&!document.getElementById('malFrame').contentDocument.querySelector('#directOpen')}));
   assert(instant.visible&&instant.fullWidth&&instant.noButtons,
     '3D case must open in fullscreen with no 2D overlay '+JSON.stringify(instant));
   assert.equal(page.url(),initialGameURL,'Opening the 3D case must not navigate away from the Unfire page');
   assert.equal(page.context().pages().length,initialTabCount,'Opening the maletin must not create another browser tab');
   await page.waitForFunction(()=>{
     const g=document.getElementById('malFrame')?.contentWindow;
     return !!g?.__UNFIRE_CASE_QA && g.__UNFIRE_CASE_QA.lid>0.94;
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
       caseVisible:game.__UNFIRE_CASE_QA.caseVisible,
       caseCamera:!game.__UNFIRE_CASE_QA.roam&&!game.__UNFIRE_CASE_QA.inspecting,
       walkButtonExists:!!game.document.getElementById('roamB'),
       oldDoubleHudMissing:!game.document.getElementById('caseModeHud'),
       lidButterflyRestored:game.__UNFIRE_CASE_QA.originalLidButton,
       lid:game.__UNFIRE_CASE_QA.lid,
       exit:!!game.document.getElementById('unfireExitGame'),
       gameSource:frame.getAttribute('src')
     };
   });
   assert(first.immersive&&first.fullViewport&&first.fullscreenAllowed&&!first.roaming&&first.caseVisible&&first.caseCamera&&first.walkButtonExists&&first.oldDoubleHudMissing&&first.lidButterflyRestored&&first.lid>0.94&&first.exit,
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
       // Reset the previous orientation's artificial story overlay before
       // measuring the case-view-only PASEAR button: storyOn hides it by design.
       d.body.classList.remove('storyOn');story.classList.remove('on');
       const rect=(el)=>{const r=el.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height}};
       // The SAME original PASEAR now lives inside the right-hand action dock.
       // It may be hidden by the story overlay; measure before re-enabling it.
       const walk=d.getElementById('roamB'), dock=d.getElementById('ctlDock'),oldDisplay=walk.style.display;
       walk.style.display='block';
       const pasear=rect(walk),dockRect=rect(dock),insideDock=walk.parentElement===dock;
       const map=rect(d.getElementById('minimap'));
       const zoomHud=rect(d.getElementById('hud'));
       const cfg=rect(d.getElementById('cfgB'));
       walk.style.display=oldDisplay;
       d.body.classList.add('storyOn');story.classList.add('on');
       const box=rect(story.querySelector('.box'));
       const touch=['unfireTouchPad','unfireFly','unfireTalk','unfireDown']
         .map(id=>({id,hidden:getComputedStyle(d.getElementById(id)).display==='none'}));
       const exitButton=d.getElementById('unfireExitGame');
       const exit=rect(exitButton),style=getComputedStyle(exitButton);
       const label={text:exitButton.textContent.trim(),scrollWidth:exitButton.scrollWidth,
         clientWidth:exitButton.clientWidth,whiteSpace:style.whiteSpace,
         compactCaption:getComputedStyle(exitButton,'::after').content};
       const tipEl=d.getElementById('tip'),tip=rect(tipEl);
       return {box,touch,exit,label,tip,pasear,dockRect,insideDock,cfg,map,zoomHud};

       function assertExists(x){if(!x)throw Error('Story overlay missing');}
     });
     const intersects=(a,b)=>a.w>0&&a.h>0&&b.w>0&&b.h>0&&
       a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
     const walk=state.pasear;
     assert(state.insideDock&&walk.x>=width*.54&&walk.y>=65&&walk.w>=65&&
       walk.x>=-1&&walk.x+walk.w<=width+2&&walk.y+walk.h<=height+2&&
       walk.x>=state.dockRect.x-2,
       'PASEAR not inside the safe right action dock '+JSON.stringify({width,height,walk,dock:state.dockRect}));
     assert(!intersects(walk,state.exit)&&!intersects(walk,state.cfg)&&
       !intersects(walk,state.map)&&!intersects(walk,state.zoomHud)&&!intersects(walk,state.tip),
       'PASEAR overlaps exit, gear, minimap, zoom HUD or captions '+JSON.stringify({width,height,walk,exit:state.exit,cfg:state.cfg,map:state.map,hud:state.zoomHud,tip:state.tip}));
     const b=state.box;
     assert(b.x>=-1&&b.y>=-1&&b.x+b.w<=width+2&&b.y+b.h<=height+2,
       'Nimbo story dialogue clipped '+JSON.stringify({width,height,b}));
     assert(state.touch.every(x=>x.hidden),
       'Buttons overlap active story dialogue '+JSON.stringify(state.touch));
     assert(state.exit.x>=-1&&state.exit.y>=-1&&state.exit.x+state.exit.w<=width+1,
       'Game exit clipped by small viewport');
     // Compact touch UI deliberately abbreviates the visual label, but retains
     // the full accessible button text and shows a real, unclipped SALIR caption.
     assert(/(SALIR A LA WEB|BACK TO THE WEBSITE)/.test(state.label.text)&&
       /SALIR/.test(state.label.compactCaption)&&state.exit.w>=70&&state.exit.w<=92&&
       state.exit.h>=34&&state.label.scrollWidth<=state.label.clientWidth+2,
       'Compact exit caption missing, clipped or not accessible '+JSON.stringify({width,height,label:state.label}));
     const overlaps=(a,b)=>a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
     assert(!overlaps(state.exit,state.box),
       'Story dialogue overlaps the exit on rotated phone '+JSON.stringify({width,height,exit:state.exit,box:state.box}));

   }
   // Carry/throw capsule action stays on the left rail, beyond the central
   // avatar, and between minimap and thumbstick across rotations.
   for(const [width,height] of [[390,844],[844,390]]){
     await page.setViewportSize({width,height});
     const layout=await page.evaluate(()=>{
       const d=document.getElementById('malFrame').contentDocument;
       d.body.classList.remove('storyOn');
       const b=d.getElementById('unfireCarryCase');
       b.style.display='flex';
       const r=b.getBoundingClientRect();
       const mini=d.getElementById('minimap').getBoundingClientRect();
       b.style.display='none';
       return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,
         minimapBottom:mini.bottom,width:d.defaultView.innerWidth,height:d.defaultView.innerHeight};
     });
     assert(layout.x>=0&&layout.right<width*.5&&layout.bottom<height-58&&
       layout.y>=layout.minimapBottom-4,
       'Capsule carry action obscures avatar/minimap/joystick '+JSON.stringify(layout));
   }
   // Return to web must not reactivate the scene when the page scrolls.
   // Walking is a separate voluntary action. The player can freely enter and
   // return to the case without restarting the mission or collapsing the lid.
   await page.waitForFunction(()=>{const g=document.getElementById('malFrame')?.contentWindow;
     return g?.document.getElementById('roamB')?.style.display==='block'&&!g.__UNFIRE_CASE_QA.roam;
   },null,{timeout:120000,polling:250});
   const choice=await page.evaluate(()=>{
     const game=document.getElementById('malFrame').contentWindow;
     const before=game.__UNFIRE_CASE_QA;
     if(before.roam||before.lid<.94)throw Error('Opened case jumped to avatar');
     game.document.body.classList.remove('storyOn');
     game.document.getElementById('story').classList.remove('on');
     const button=game.document.getElementById('roamB');
     if(button.style.display==='none') throw Error('PASEAR missing after lid opened');
     button.click();
     const exploring=game.__UNFIRE_CASE_QA.roam;
     const hiddenOnWalking=!button.textContent.includes('PASEAR');
     game.document.getElementById('roamB').click();
     return {exploring,hiddenOnWalking,returned:!game.__UNFIRE_CASE_QA.roam,
       lid:game.__UNFIRE_CASE_QA.lid,caseVisible:game.__UNFIRE_CASE_QA.caseVisible};
   });
   assert(choice.exploring&&choice.hiddenOnWalking&&choice.returned&&choice.caseVisible&&choice.lid>.94,
     'Case-to-avatar must be optional and reversible '+JSON.stringify(choice));
   // MODO CINE: spectator camera must pass through the entire house, walls,
   // ceilings, windows and furnishings without constraining the player robot.
   const cinematic=await page.evaluate(()=>{
     const g=document.getElementById('malFrame').contentWindow;
     g.__roamAPI.enterRoam();
     const rec=g.__REC;rec.set(true);
     if(!rec.on)throw Error('Cinematic spectator mode did not start');
     rec.p.set(76,24,93);rec.v.set(35,12,35);
     const player=g.__roamAPI.ROAMS.p.clone();
     rec.tick(.8);
     const result={camera:[rec.p.x,rec.p.y,rec.p.z],playerUnchanged:player.distanceTo(g.__roamAPI.ROAMS.p)<.01};
     rec.set(false);g.__roamAPI.exitRoam();
     return result;
   });
   assert(cinematic.camera[0]>78&&cinematic.camera[1]>24&&cinematic.camera[2]>95&&cinematic.playerUnchanged,
     'Cinematic spectator must traverse physical and architectural bounds without moving robot '+JSON.stringify(cinematic));
   const savedLid=await page.evaluate(()=>document.getElementById('malFrame').contentWindow.__UNFIRE_CASE_QA.lid);
   await page.evaluate(()=>document.getElementById('malFrame').contentWindow.__exitGame());
   await page.waitForFunction(()=>document.getElementById('heroPin').classList.contains('web-return'),null,{timeout:10000});
   const afterExit=await page.evaluate(()=>{
     dispatchEvent(new WheelEvent('wheel',{deltaY:380,cancelable:true,bubbles:true}));
     return {portal:!!document.getElementById('unfireReturnPortal'),
       returnLabel:document.getElementById('unfireReturnPlay')?.textContent,
       gamePaused:!document.body.classList.contains('immOn'),
       persistent:document.getElementById('heroPin').classList.contains('web-return')};
   });
   assert(afterExit.portal&&/PLAY AGAIN/.test(afterExit.returnLabel)&&afterExit.gamePaused&&afterExit.persistent,
     'Exit to website did not leave game parked with manual return portal '+JSON.stringify(afterExit));
   await page.evaluate(()=>document.getElementById('unfireReturnPlay').click());
   await page.waitForFunction(()=>document.body.classList.contains('immOn'),null,{timeout:10000});
   const afterResume=await page.evaluate(()=>({
     portalClosed:!document.getElementById('heroPin').classList.contains('web-return'),
     lid:document.getElementById('malFrame').contentWindow.__UNFIRE_CASE_QA.lid
   }));
   assert(afterResume.portalClosed&&Math.abs(afterResume.lid-savedLid)<.06,
     'VOLVER A JUGAR must resume original maletin scene, not restart '+JSON.stringify({savedLid,afterResume}));
   console.log('PASS exit directly to web, no scroll auto-reopen, Y2K portal, resumable game and responsive capsule HUD');
   // The first game has already been validated; release its expensive software
   // WebGL context before starting a second game in a CI worker.
   await page.close();
   // A directly shared maletín URL has no website wrapper: it must still
   // enter fullscreen when supported and use every available viewport pixel.
   const direct=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
   direct.on('pageerror',e=>errors.push('direct: '+e.message));
   const directUrl=new URL('maletin/index.html',process.env.UNFIRE_ENTRY_URL||'http://127.0.0.1:8765/audio/').href;
   await direct.goto(directUrl,{waitUntil:'commit',timeout:120000});
   // On slow CI software GPUs, parsing the heavy 3D engine may block user
   // input for tens of seconds. The website first-tap test above has already
   // tested click-before-boot, so test the direct URL after its engine is ready.
   await direct.waitForFunction(()=>!!window.__mal?.S,null,{timeout:120000,polling:250});
   assert.equal(await direct.locator('#directOpen').count(),0,'Direct link may not show 2D opener');
   await direct.evaluate(()=>{
     const c=document.getElementById('cv');if(!c)throw Error('No direct 3D canvas');
     const r=c.getBoundingClientRect();
     const p={bubbles:true,cancelable:true,pointerId:19,pointerType:'mouse',button:0,clientX:r.left+r.width/2,clientY:r.top+r.height/2};
     c.dispatchEvent(new PointerEvent('pointerdown',{...p,buttons:1}));
     window.dispatchEvent(new PointerEvent('pointerup',{...p,buttons:0}));
   });
   await direct.waitForFunction(()=>Boolean(window.__UNFIRE_CASE_QA&&window.__UNFIRE_CASE_QA.lid>.94),null,{timeout:120000,polling:300});
   const directCheck=await direct.evaluate(()=>({
     viewportWidth:innerWidth,canvasWidth:document.getElementById('cv').getBoundingClientRect().width,
     cameraAspect:window.__mal.S.camera.aspect,
     directOpenHidden:!document.getElementById('directOpen'),
     roaming:window.__UNFIRE_CASE_QA.roam,
     caseVisible:window.__UNFIRE_CASE_QA.caseVisible,
     panoramaFov:window.__mal.S.camera.fov,
   }));
   assert(directCheck.canvasWidth>=directCheck.viewportWidth-1&&directCheck.directOpenHidden&&!directCheck.roaming&&directCheck.caseVisible
     &&directCheck.cameraAspect<.6,'Direct mobile entry was not panoramic '+JSON.stringify(directCheck));
   await direct.close();
   assert.deepEqual(errors,[],'Game JavaScript exceptions');
   console.log('PASS host+direct link open the case fullscreen WITHOUT auto avatar, optional walk+return, portrait+landscape, 0 JS exceptions');
 } finally {await browser.close();}
})().catch(e=>{console.error('FAIL first-tap',e.stack||e);process.exitCode=1;});
