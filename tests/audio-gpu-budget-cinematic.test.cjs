'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const engine=fs.readFileSync(path.join(__dirname,'../audio/maletin/game-engine-v50.js'),'utf8');
const css=fs.readFileSync(path.join(__dirname,'../assets/css/unfire-adaptive-loading.css'),'utf8');
const loader=fs.readFileSync(path.join(__dirname,'../assets/js/unfire-adaptive-loading.js'),'utf8');
const head=engine.indexOf('  const adaptivePerf={');
const tail=engine.indexOf('  // Opening the website/direct-link case',head);
assert.ok(head>0&&tail>head,'single graphics governor found');

function rig(tier='balanced',initial=1){
  const writes=[],resizes=[];
  const S={renderer:{
    getPixelRatio(){return writes.length?writes[writes.length-1]:initial;},
    setPixelRatio(n){writes.push(n);},
    setSize(w,h){resizes.push([w,h]);},
    shadowMap:{enabled:true,needsUpdate:true,autoUpdate:false}
  }};
  const window={__perf:null,ATM_OUT:false,__LOWFPS:false};
  const document={documentElement:{dataset:{}}};
  const DEVICE={tier,maxDpr:initial};
  const ctx={window,document,S,DEVICE,LOWDEV:tier!=='desktop',
    renderWidth:1024,renderHeight:768,innerWidth:1024,innerHeight:768};
  vm.runInNewContext(engine.slice(head,tail).replace('  const adaptivePerf=', '  var adaptivePerf='),ctx,{timeout:1000});
  function run(seconds,fps,zone='inside',origin=0){
    window.ATM_OUT=zone==='outside';
    let last=origin;
    const frameMs=1000/fps;
    for(let at=origin+frameMs;at<=origin+seconds*1000+0.0001;at+=frameMs){
      ctx.governGraphics(at,frameMs/1000);last=at;
    }
    return last;
  }
  return {ctx,run,writes,resizes,window,document};
}

test('single active DPR governor, no competing protectSlowGPU or fast per-3s reallocations',()=>{
  assert.doesNotMatch(engine,/protectSlowGPU/);
  assert.doesNotMatch(engine,/Q\.t>3/);
  assert.match(engine,/governGraphics\(now,actualFrameTime\)/);
  assert.equal((engine.match(/S\.renderer\.setPixelRatio\(/g)||[]).length,3,
    'boot software-renderer cap, calibration and a single dynamic governor');
});

test('healthy capped 24fps compact is not treated as GPU overload',()=>{
  const r=rig('compact',0.8);
  r.run(30,24);
  assert.equal(r.writes.length,0);
  assert.equal(r.window.__perf.f,720);
});

test('sustained low frame rate lowers DPR gradually, never oscillates it upward',()=>{
  const r=rig('desktop',1.5);
  r.run(70,12);
  assert.ok(r.writes.length>=1,'lowered at least once after sustained slowness');
  assert.ok(r.writes.length<=5,'cooldown limits GPU reallocation frequency');
  for(let i=0;i<r.writes.length;i++){
    assert.ok(r.writes[i]>=0.75&&r.writes[i]<1.5);
    if(i)assert.ok(r.writes[i]<=r.writes[i-1],'never increases during the same play session');
  }
  assert.equal(r.resizes.length,r.writes.length,'renderer resize paired with DPR change');
  assert.equal(r.document.documentElement.dataset.unfireAdaptiveQuality,'on');
});

test('healthy desktop, outdoor and indoor target framerate: quality stays crisp',()=>{
  const a=rig('desktop',1.5);a.run(25,35);assert.deepEqual(a.writes,[]);
  const b=rig('balanced',1);b.run(25,30,'outside');assert.deepEqual(b.writes,[]);
});

test('zone change resets the sampling window without resetting chosen quality',()=>{
  const r=rig('balanced',1);
  r.run(7,15,'inside');
  r.run(7,15,'outside',7000);
  assert.equal(r.writes.length,0,'two short slow periods across zones do not count as one 14s period');
  assert.ok(r.window.__perf.f>0);
});

test('compact/WebGL software lower bound respected',()=>{
  const r=rig('compact',0.6);
  r.run(80,12);
  assert.equal(r.writes.length,0,'already at floor; no framebuffer churn');
});

test('existing cinematic loader is finite, lightweight and accessible',()=>{
  assert.match(css,/uf-load-glide/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css,/@media\(max-height:420px\) and \(orientation:landscape\)/);
  assert.match(css,/#ufAdaptiveLoader\{[^}]*pointer-events:none/);
  assert.doesNotMatch(css,/url\(/i,'no new GPU-heavy image/video resources');
  assert.match(loader,/setTimeout\(initialDone,3600\)/);
  assert.match(loader,/13000/,'game loader has safety timeout');
  assert.match(loader,/saveData/);
  assert.match(loader,/slow-2g\|2g/);
  assert.doesNotMatch(loader,/fetch\(|XMLHttpRequest|WebSocket/,'no network probes');
});

test('explicit network hints only; Safari unknown and fast links are not guessed slow',()=>{
  const a=loader.indexOf('var connection=typeof navigator');
  const b=loader.indexOf('var en=',a);
  assert.ok(a>0&&b>a);
  function low(network,mode='engine'){
    const ctx={navigator:{connection:network},root:{classList:{contains:()=>false}},mode};
    vm.runInNewContext(loader.slice(a,b),ctx,{timeout:200});
    return !!ctx.low;
  }
  assert.equal(low(undefined),false);
  assert.equal(low({effectiveType:'4g'}),false);
  assert.equal(low({effectiveType:'2g'}),true);
  assert.equal(low({saveData:true}),true);
  assert.equal(low({saveData:true},'site'),false);
});
