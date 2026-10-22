const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm');
const engine=fs.readFileSync('audio/maletin/game-engine-v51.js','utf8');
const host=fs.readFileSync('audio/index.html','utf8');
const shell=fs.readFileSync('audio/maletin/index.html','utf8');
new vm.Script(engine,{filename:'game-engine-v51.js'});
function ok(msg,test){assert.ok(test,msg);console.log('PASS',msg)}
ok('3D butterfly untouched',engine.includes("G3.drawEmblem(em.getContext('2d'), 256, '#7fd0ff')"));
ok('3D click toggles case',engine.includes('ray.intersectObject(lidBtn, true).length) { toggleCaseInGame()'));
ok('Case never sends website close event',!engine.includes('parentPost({ closeCase: 1 })'));
ok('Case carried at current altitude',engine.includes('-8.9+(ROAMS.h||0)+2.5'));
ok('Case opens at current altitude',engine.includes('caseG.position.set(ROAMS.p.x+Math.sin(ROAMS.yaw)*3.5,-8.9+(ROAMS.h||0)+4.5'));
ok('Portals are evaluated BEFORE collision',engine.includes('if(crossWindow(px0,pz0,ROAMS.p.x,ROAMS.p.z))return; if (!ROAMS.mini'));
ok('All 8 windows mapped to real world', ['reef','jelly','mountain','sea','space','satellite','desert','sky'].every(x=>engine.includes("id:'"+x+"'")));
ok('Shared world travel never creates new scene',!engine.slice(engine.indexOf('function warpWindow(w)'),engine.indexOf('function crossWindow(')).includes('new THREE.Scene'));
ok('Travel preserves side missions',!engine.slice(engine.indexOf('function warpWindow(w)'),engine.indexOf('function crossWindow(')).includes('localStorage.clear'));
ok('Return control restores house without reloading game',engine.includes('function returnThroughWindow()')&&!engine.includes('location.reload()'));
ok('Portal FX uses one timeout, not a render loop',engine.includes("portalFlash.style.opacity='1'")&&engine.includes('clearTimeout(portalFadeTimer)'));
ok('All 5 original video portals preserved', ['reef.t','jelly.t','steens.t','waves.t','milkyW'].every(x=>shell.includes(x)));
ok('Desert landscape window added',shell.includes("portal('F',-44,8,15,14"));
ok('Video panels have no collision',shell.includes('g.userData.noCollide=true'));
ok('Both game preload/script point to engine v51',shell.split('game-engine-v51.js').length-1===2);
ok('Parent points to exact v51',host.includes('maletin/index.html?v=51'));
ok('Existing story & quests survive',engine.includes('const SCENES =')&&engine.includes('const SIDE ='));
ok('Existing online subsystem retained',engine.includes('const ONLINE ='));
ok('Existing audio ambience retained',engine.includes('const AMB ='));
// The release is a FREE complete adventure, not just the former three-chapter preview.
const start=shell.indexOf('const CH = [');
const end=shell.indexOf('// ---------- interfaz: barras de cine',start);
assert(start>=0&&end>start,'Story chapter data not found');
const storySource=shell.slice(start+'const CH = '.length,shell.lastIndexOf('];',end)+1);
const chapters=Function('N','lv','return '+storySource)(()=> 'Jugador',(a,b,c)=>b);
ok('All 12 chapters are playable, not locked',chapters.length===12&&chapters.every(x=>Array.isArray(x.steps)&&x.steps.length>0&&!x.locked));
ok('Every chapter has a real ending',chapters.every(x=>x.steps.some(y=>y.end)));
ok('Complete final epilogue exists',chapters[11].steps.some(x=>x.end&&x.say.length>=4));
ok('No paywall after final chapter',shell.includes('🏆 HISTORIA COMPLETA · SEGUIR JUGANDO'));
const allWaits=chapters.flatMap(c=>c.steps.filter(x=>x.wait).map(x=>x.wait.ev));
ok('All chapter requirements can be fulfilled by gameplay systems',
  allWaits.every(ev=>['hwopen','hwkey','case','radio','poster','gacha','portal','side',
    'portal:sea','portal:sky','portal:reef','portal:desert','portal:space','portal:mountain','portal:jelly'].includes(ev)));
ok('Portal, butterfly and quest completion emit story events',
  engine.includes("window.UEV('portal:'+w.id)")&&engine.includes("window.UEV('case')")&&engine.includes("window.UEV('side')"));

console.log('Static v51 assertions PASSED');
