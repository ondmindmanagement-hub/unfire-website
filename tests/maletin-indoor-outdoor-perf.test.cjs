// Indoor + outdoor renderer quality: deterministic, no browser/GPU required.
'use strict';
const fs=require('node:fs'), path=require('node:path'), vm=require('node:vm');
const assert=require('node:assert/strict');
const engine=fs.readFileSync(path.resolve(__dirname,'../audio/maletin/game-engine-v50.js'),'utf8');
new vm.Script(engine,{filename:'game-engine-v50.js'});
const begin=engine.indexOf('  function createSceneFrameBudget(');
const end=engine.indexOf('  const sceneFrameBudget =',begin);
assert(begin>0&&end>begin,'Single shared render budget must exist');
const code=engine.slice(begin,end);
assert(!/setInterval|setTimeout|requestAnimationFrame|setSize\(/.test(code),
  'Quality guard cannot add loop/timer or a second framebuffer allocation');
const document={documentElement:{dataset:{}}};
function createRenderer(startDpr){
  return {value:startDpr, changes:[],shadowMap:{enabled:true,autoUpdate:true,needsUpdate:false},
    getPixelRatio(){return this.value;},setPixelRatio(v){this.value=v;this.changes.push(v);}};
}
const ctx={document,Number,Math};
vm.runInNewContext(code+'\nthis.makeBudget=createSceneFrameBudget;',ctx);
function create(compact=false,tier='desktop',dpr=1.3){
  const renderer=createRenderer(dpr), gov=ctx.makeBudget(renderer,{maxDpr:dpr,tier},compact);
  return {renderer,gov};
}
function frames(gov,from,dtMs,count,outside){
  for(let i=0;i<count;i++)gov.note(from+i*dtMs,dtMs/1000,outside);
  return from+dtMs*count;
}
// Healthy capped indoor and outdoor scenes must stay crisp, including 24fps compact.
{
  const {renderer,gov}=create(false,'desktop');
  let t=1000;t=frames(gov,t,28,800,false);t=frames(gov,t,33,800,true);
  assert.equal(renderer.changes.length,0,'Healthy indoor/outdoor frame limits must not lower DPR');
  assert.equal(gov.stats.areaChanges,1,'One zone change');
  assert.equal(gov.stats.outdoor,true,'Outdoor quality target selected');
  assert.equal(renderer.shadowMap.autoUpdate,false,'Shadow updates are scheduled');
}
// A sustained slow scene drops *one* DPR tier; no up/down oscillation after recovery.
{
  const {renderer,gov}=create(false,'desktop',1.2);
  let t=1500;t=frames(gov,t,62,230,false);
  assert.equal(renderer.changes.length,1,'Sustained slowdown should lower quality one step');
  assert(renderer.value<1.2&&renderer.value>=0.70,'DPR stays within floor/ceiling');
  t=frames(gov,t,28,1800,false);
  assert.equal(renderer.changes.length,1,'Recovery must not trigger repeating reallocations');
  assert.equal(gov.stats.adjustments,1,'Only one allocation');
  assert.equal(document.documentElement.dataset.unfireAdaptiveQuality,'on');
}
// Slow performance outdoors is handled independently of interior sample window.
{
  const {renderer,gov}=create(false,'desktop',1.1);
  let t=2000;t=frames(gov,t,30,120,false);t=frames(gov,t,90,20,true);
  assert.equal(renderer.changes.length,0,'Zone transition should not count startup jank');
  t=frames(gov,t,90,140,true);
  assert.equal(renderer.changes.length,1,'Sustained outdoor slowdown should reduce DPR');
  gov.pause();
  t=frames(gov,t+2500,90,4,true);
  assert.equal(renderer.changes.length,1,'Resuming the game does not reduce DPR immediately');
}
// Compact devices at their intentional 24fps cap should not be mistaken for slow.
{
  const {renderer,gov}=create(true,'compact',0.82);
  let t=1000;t=frames(gov,t,42,500,false);t=frames(gov,t,42,500,true);
  assert.equal(renderer.changes.length,0,'24fps mobile cap is healthy, not a slowdown');
  assert.equal(gov.stats.max,0.82);
}
assert(!engine.includes('protectSlowGPU(')&&!engine.includes('adaptivePerf.since')&&!engine.includes('Q.dpr'),
  'Two competing DPR governors must be removed');
assert(engine.includes('sceneFrameBudget.note(now, actualFrameTime, !!window.ATM_OUT)'), 'Budget is called by game frame');
assert(engine.includes('sceneFrameBudget.pause(); window.__LOWFPS = false;'), 'Hidden/background pause resets budget');
assert(engine.includes('window.__LOWFPS = sceneFrameBudget.stats.slow;'), 'Distant FX react to performance');
assert(engine.includes('ROAMS.h += ROAMS.vy * dt'), 'Movement physics preserved');
assert(engine.includes('ONLINE.tick(dt, t)'), 'Multiplayer tick preserved');
console.log('PASS: 4 indoor/outdoor/mobile quality scenarios; no DPR thrash or second controller');
