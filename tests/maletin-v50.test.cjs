const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const engine=fs.readFileSync('audio/maletin/game-engine-v50.js','utf8');
const html=fs.readFileSync('audio/index.html','utf8');
const game=fs.readFileSync('audio/maletin/index.html','utf8');
new vm.Script(engine,{filename:'game-engine-v50.js'});
function chk(label,condition){assert.ok(condition,label);console.log('PASS',label)}
chk('No standalone 2D opener on website',!html.includes('id="openBtn"')&&!html.includes('#openBtn'));
chk('Only the real 3D butterfly opens the case',engine.includes('parent.__UNFIRE_ENTER_CASE()')&&engine.includes('ray.intersectObject(caseG, true)'));
chk('Single original click enters immersive viewport and starts 3D lid during zoom',html.includes('immersive();\n    fullscreenFromGesture();')&&html.includes('UNFIRE_SCENE.onReady(()=>{loadingIntent=false;begin();})')&&html.includes('entryTransition=false;parked=0;'));
chk('Lid uses >5s real-time procedural animation',engine.includes('5.6*Math.abs(pt-pNow)')&&engine.includes('actualFrameTime')&&!engine.includes('lidControlledByPlayer ? 0.18 : 0.16'));
chk('Original case opening SFX follow the actual procedural 3D hinge timeline',
  engine.includes('const CASE_SOUND=(()=>')&&engine.includes('CASE_SOUND.sync(pNow,pTarget,lidControlledByPlayer);')&&
  ['latch','hinge','thud','reveal'].every(x=>engine.includes("play('"+x+"'"))&&
  engine.includes("!manual||document.hidden")&&engine.includes("v.connect(UA.bus.master)"));

chk('Claude procedural 3D butterfly lid switch restored without a second button',engine.includes('const ringB = mesh(new THREE.TorusGeometry(0.42, 0.02, 10, 64)')&&engine.includes('window.__ringB = ringB;')&&engine.includes('lid.add(ringB);')&&engine.includes("G3.drawEmblem(ec.getContext('2d'), 256, '#ffffff')")&&!engine.includes('originalUnfireLidButton'));
chk('Still no standalone 2D ABRIR button',!html.includes('id="openBtn"')&&!game.includes('id="directOpen"'));
chk('Web exit parks WebGL behind a themed, manual return-to-play screen',
  html.includes('id="unfireReturnPortal"')&&html.includes('id="unfireReturnPlay"')&&
  html.includes("$('#heroPin').classList.add('web-return')")&&
  html.includes('if(webReturn)return false')&&
  html.includes('if(caseLocal||webReturn)return;')&&
  html.includes("document.getElementById('instrumentos')")&&
  html.includes('const resumeGame=()=>{'));
chk('Web return resumes existing game without restarting missions',
  html.includes('entryResume:true')&&html.includes('if(!webReturn&&(d.caseState')&&
  html.includes("if(!webReturn&&'immersive' in d"));
chk('Capsule carry control stays on left lateral rather than over the robot',
  engine.includes('left:max(12px,env(safe-area-inset-left));top:clamp(190px,40dvh,420px)')&&
  game.includes('#unfireCarryCase{left:max(9px,env(safe-area-inset-left))!important'));

chk('Old double camera buttons completely removed',!engine.includes('caseModeHud')&&!game.includes('#caseModeHud'));
chk('Existing PASEAR is the only character action with an open maletin',
  engine.includes("roamB.textContent = '🚶 PASEAR'")&&
  engine.includes("pTarget>.99&&lidOpen>=.998")&&
  engine.includes('updateRoamButtonHint();')&&
  !engine.includes('characterEntryButton')&&!game.includes('#unfireCharacterEntry'));
chk('Clicking maletin from avatar returns to identical case view',
  engine.includes('if(ray.intersectObject(caseG,true).length){')&&
  engine.includes('if(window.ATM_OUT)showCaseView();else exitRoam();')&&
  engine.includes("roamB.textContent = '🚶 PASEAR'"));
chk('Same PASEAR button stays in the safe right dock in both case and roam',
  engine.includes("if(roamB.parentElement!==dock)dock.appendChild(roamB);")&&
  engine.includes("if(roamB.style.position!=='static')roamB.style.position='static';")&&
  game.includes('body:not(.unfire-roaming) #ctlDock{')&&
  game.includes('#ctlDock #roamB{')&&
  game.includes('body:has(#storyHud.cfgOn) #ctlDock')&&
  !game.includes('body:not(.unfire-roaming) #roamB{')&&
  !engine.includes('const container=ROAMS.on?dock:document.body;'));
chk('Gacha procedural FX reveal uses a side-on avatar approach, never central occlusion',
  engine.includes('const side = V(-d.z, 0, d.x); const p = V(CT.x + d.x * 12 + side.x * 9')&&
  engine.includes('const q = V(p.x + d.x * 11 + side.x * 7')&&
  engine.includes('const side=V(-d.z,0,d.x);const p = V(c.x + d.x * dist + side.x * Math.min(7,dist*.45)'));
chk('First-tap 3D case opens in the existing web document, without a new tab',
  html.includes('window.__UNFIRE_ENTER_CASE=()=>open(1050)')&&
  html.includes('immersive();\n    fullscreenFromGesture();')&&
  html.includes('fr.contentWindow.postMessage({unfire:1,entryStart:true,vis:true},location.origin)')&&
  !html.slice(html.indexOf('const Mal=(()=>'),html.indexOf('/* ================= Precios')).includes("window.open("));
chk('First visit PASEAR blinks exactly two seconds after opening',
  engine.includes("'unfire_pasear_intro_v1'")&&
  engine.includes('},2000);')&&
  game.includes('animation:unfire-pasear-blink 2s steps(1,end) 1'));

chk('Entry always forces 3D case, never the roaming robot',engine.includes('if(ROAMS.on)exitRoam();CASE_VIEW.on=false'));
chk('Cinematic noclip traverses house, walls, doors and windows',engine.includes('Cinematic camera is a spectator')&&engine.includes('REC.p.x=clamp(REC.p.x,-90000,90000)')&&!engine.includes('REC.p.z = clamp(REC.p.z, -13.5, 93.5)'));
chk('Case camera approaches using a smooth timed dolly',engine.includes('entryDolly.elapsed=Math.min')&&engine.includes('entryDolly.to=view.D0*.96'));
chk('Direct game also has no 2D opener',!game.includes('id="directOpen"'));
chk('Original button opens slow lid concurrently with camera dolly',engine.includes('entryDolly.openAfter=false;view.gd=entryDolly.to;pTarget=1;')&&engine.includes('5.6*Math.abs(pt-pNow)'));
chk('No floating 2D showcase return button',!game.includes('✕ DEVOLVER A LA VITRINA'));
chk('Original 3D butterfly artwork preserved',engine.includes("G3.drawEmblem(em.getContext('2d'), 256, '#7fd0ff')"));
chk('Real 3D lid-button calls local toggle',engine.includes('ray.intersectObject(lidBtn, true).length) { toggleCaseInGame()'));
chk('Rapid toggles use target state',engine.includes('if(pTarget>0.5)closeCaseInGame();else openCaseInGame();'));
chk('Case closure never sends parent closeCase',!engine.includes('parentPost({ closeCase: 1 })'));
chk('Local action does not call exitGame',!engine.slice(engine.indexOf('function closeCaseInGame()'),engine.indexOf('function openCaseInGame(')).includes('exitGame'));
chk('Carry does not disconnect online',!engine.slice(engine.indexOf('function closeCaseInGame()'),engine.indexOf('function openCaseInGame(')).includes('ONLINE.leave'));
chk('Packed case invisible and saves GPU draws',engine.includes('caseG.visible=false;')&&engine.includes('inventory-only'));
chk('Capsule simulation test limited to localhost',engine.includes('advanceCapsuleInLocalTest(steps=16)')&&engine.includes('location.hostname')&&engine.includes('CAPS.tick(0.06)'));
chk('Capsule is reusable without spawning objects each click',engine.includes('if(capsule)return;')&&engine.includes('capsule.visible=true;flight=0.001;'));
chk('G keyboard handles pack and throw',engine.includes("(e.key==='g'||e.key==='G')")&&engine.includes('action();'));
chk('Exit from roam cancels capsule and restores case',engine.includes('CAPS.cancel();carryingCase=false;caseG.visible=true'));
chk('Capsule never exits the game',!engine.slice(engine.indexOf('const CAPS=(()=>'),engine.indexOf('  // ===== SECRETOS:')).includes('exitRoam()'));

chk('Workshop attaches to story HUD without timer polling',engine.includes('const mountWorkshopControls = () =>')&&engine.includes('new MutationObserver(')&&!engine.includes('setTimeout(function addT()'));
chk('Case view stops walk shortcuts while allowing piano notes',engine.includes('if (CASE_VIEW.on) return; const k = e.key.length === 1'));
chk('Case view G note does not pack capsule',engine.includes('&&ROAMS.on&&!CASE_VIEW.on&&portableUnlocked()'));
chk('Case mobile pinch zooms inspection camera',engine.includes('CASE_VIEW.dist=clamp(CASE_VIEW.dist*f,window.ATM_OUT?6.8:5.4,window.ATM_OUT?17:14.5)'));
chk('PASEAR never overlaps center captions and stays accessible without duplicates',
  game.includes('top:calc(env(safe-area-inset-top) + 135px)!important')&&
  game.includes('top:calc(env(safe-area-inset-top) + 112px)!important')&&
  game.includes('top:calc(env(safe-area-inset-top) + 110px)!important')&&
  game.includes('#ctlDock #roamB{min-height:34px!important')&&
  engine.includes("roamB.textContent=CASE_VIEW.on?'↩ VOLVER AL PERSONAJE'")&&
  !engine.includes('characterEntryButton'));
chk('No blue artificial case illustration in any initial viewport or compatibility fallback',
  !html.includes('unfire-case-preview.svg') && !html.includes('background:url("img/hyperwave-open.webp")'));
chk('First landing loads actual live WebGL maletin, not synth ad or fake image',
  html.includes('requestAnimationFrame(()=>{if(!document.hidden&&nearHero())start()})')&&
  html.includes('PREPARANDO MALETÍN 3D')&&
  !html.includes('::after{content:"";position:absolute;inset:16% 2% 0')&&
  html.includes('scene-ready .hero-copy{opacity:0!important'));
chk('Outdoor capsule rests above terrain instead of on the ground',
  engine.includes('floor+(window.ATM_OUT?6.8:0.8)')&&
  engine.includes('landing ? landing.y : -8.9+(ROAMS.h||0)+(window.ATM_OUT?6.8:0.3)'));
chk('Outdoor case camera keeps the avatar in place and widens the horizon',
  engine.includes('if(window.ATM_OUT)showCaseView();else exitRoam();')&&
  engine.includes("CASE_VIEW.elevation=window.ATM_OUT?0.52:0.78")&&
  engine.includes('const panoramic=window.ATM_OUT')&&
  engine.includes("roamB.textContent=CASE_VIEW.on?'↩ VOLVER AL PERSONAJE'"));
chk('Portrait and landscape HUD use safe areas and leave story legible',
  game.includes('id="unfireMobileNoOverlap20261023"')&&
  game.includes('#tip{left:50%!important;top:calc(env(safe-area-inset-top) + 10px)!important;')&&
  game.includes('body.storyOn #ctlDock')&&
  game.includes('@media (pointer:coarse) and (orientation:landscape)'));
chk('Single exit label is not visually truncated',
  game.includes('#unfireExitGame{box-sizing:border-box!important;')&&
  engine.includes("xb.textContent = '⏏ SALIR A LA WEB'"));
chk('Mission logic retained',engine.includes("localStorage.setItem('unfire_side'")&&engine.includes('const SIDE ='));
chk('Multiplayer logic retained',engine.includes('const ONLINE ='));
chk('Online joins timeout safely and allow retries',engine.includes('function clearJoining()')&&engine.includes('La sala no responde.')&&engine.includes('ONLINE.joining'));
chk('Room audio implementation retained',engine.includes('const AMB ='));
chk('Parent scroll no longer overrides manual open/close',engine.includes('!lidControlledByPlayer) pTarget = d.p;'));
chk('Host keeps iframe active when case is local',html.includes('vis:caseLocal||rb.bottom>90'));
chk('Host does not scroll when closing case',!html.includes('if(d.closeCase)Mal.shut();'));
chk('Standalone game loads exact matching engine',game.includes('game-engine-v50.js?v=20261023casecuev1'));
chk('Host loads exact matching game',/maletin\/index\.html\?v=20261023casecuev1/.test(html));
chk('User can explicitly exit if desired',engine.includes('window.__exitGame'));
chk('3D original scene size intact',engine.length>500000);
const storySource=game.slice(game.indexOf('window.STORY_INIT = function (H) {'),game.indexOf('</script>',game.indexOf('window.STORY_INIT = function (H) {')));
new vm.Script(storySource,{filename:'story-inline.js'});
chk('Open Hyperwave is recognized even when opened before mission prompt',storySource.includes("S0.wait.ev==='hwopen'")&&engine.includes('isHyperwaveOpen: () =>'));
chk('In-house PC mystery application',engine.includes('id="pcMysteryApp"')&&engine.includes('id="pcSecretCode"'));
chk('Correct unique unlock code',engine.includes("fld.value.trim().toUpperCase()!=='ULTIMATEROBOTS'"));
chk('Only local avatar entitlements updated',engine.includes("localStorage.setItem('unfire_unlock',String(Math.max(current,20)))"));
chk('Story saves protected from corrupted data',storySource.includes('Validate older/corrupted saves'));
chk('Twelve playable story chapters', (storySource.match(/\{\s*t:\s*['\"][^'\"]+['\"],\s*steps:/g)||[]).length===12 && storySource.includes('const FREE = 12'));
chk('Map chapter goals can be completed with Nimbo assistance',storySource.includes("w.ev==='reach'")&&engine.includes('navigateTo: (quest)'));
chk('Completed story has no purchase gate',storySource.includes('HISTORIA COMPLETADA')&&!storySource.includes('VER EL MALETÍN COMPLETO'));
chk('Mission events guarded against stale steps',storySource.includes('currentStep.wait.ev !== name'));
chk('Persistent active side quest',engine.includes("'unfire_side_active'"));
chk('Showcase exhibition keeps player camera and avoids overlapping full-size plugins',
  game.includes('noFocus: true, f: () => { hap(0.4); openT = 6;')&&
  game.includes('if (cur) { cur.out = true; say(')&&
  game.includes('if (olds.length) { say(')&&
  !game.includes('noFocus: false, f: () => { hap(0.4); openT = 6;'));
chk('PC screen shows mystery app icon',engine.includes("g.fillText('?', 14, 78)"));
console.log('All staged structural tests PASSED; full gameplay and device performance still require browser QA.');
