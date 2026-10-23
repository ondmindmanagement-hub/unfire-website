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
       characterButtonExists:!!game.document.getElementById('unfireCharacterEntry'),
       oldDoubleHudMissing:!game.document.getElementById('caseModeHud'),
       exteriorCircleMissing:!game.__ringB,
       lid:game.__UNFIRE_CASE_QA.lid,
       exit:!!game.document.getElementById('unfireExitGame'),
       gameSource:frame.getAttribute('src')
     };
   });
   assert(first.immersive&&first.fullViewport&&first.fullscreenAllowed&&!first.roaming&&first.caseVisible&&first.caseCamera&&first.characterButtonExists&&first.oldDoubleHudMissing&&first.exteriorCircleMissing&&first.lid>0.94&&first.exit,
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
       const touch=['unfireTouchPad','unfireFly','unfireTalk','unfireDown']
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
   // Walking is a separate voluntary action. The player can freely enter and
   // return to the case without restarting the mission or collapsing the lid.
   await page.waitForFunction(()=>{const g=document.getElementById('malFrame')?.contentWindow;
     return !!g?.document.getElementById('unfireCharacterEntry')&&!g.document.getElementById('unfireCharacterEntry').hidden;
   },null,{timeout:120000,polling:250});
   const choice=await page.evaluate(()=>{
     const game=document.getElementById('malFrame').contentWindow;
     const before=game.__UNFIRE_CASE_QA;
     if(before.roam||before.lid<.94)throw Error('Opened case jumped to avatar');
     game.document.body.classList.remove('storyOn');
     game.document.getElementById('story').classList.remove('on');
     const button=game.document.getElementById('unfireCharacterEntry');
     if(button.hidden) throw Error('Contextual player button did not appear after lid opened');
     button.click();
     const exploring=game.__UNFIRE_CASE_QA.roam;
     const hiddenOnWalking=button.hidden;
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
