'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const engine=fs.readFileSync(path.join(__dirname,'../audio/maletin/game-engine-v50.js'),'utf8');
const line=(start)=>{
  const x=engine.split('\n').find(s=>s.trim().startsWith(start));
  assert(x,'Missing actual engine statement: '+start);
  return x.trim();
};
const wall=line('const foregroundFrameTime =');
const physicsDelta=line('const actualFrameTime = Math.min(0.18, foregroundFrameTime);');
const duration=line('lidMotion.duration=pt>pNow?');
const advance=line('lidMotion.elapsed=Math.min(');
const dolly=line('entryDolly.elapsed=Math.min(');
const physics=line('const dt = Math.min(0.05, clock.getDelta())');
const smooth=x=>x*x*(3-2*x);
const bound=x=>Math.max(0,Math.min(1,x));
function runTimeline(frames,pt=1,resetAt=null){
  let prev=0,pNow=pt===1?0:1;
  const lidMotion={from:pNow,to:pNow,elapsed:0,duration:5.6};
  const results=[];
  const code=[wall,physicsDelta,
    'if (Math.abs(lidMotion.to-pt)>0.0001) {',
    'lidMotion.from=pNow;lidMotion.to=pt;lidMotion.elapsed=0;',
    duration,'}',
    advance,
    'const alpha=ease.smooth(clamp(lidMotion.elapsed/lidMotion.duration));',
    'pNow=lidMotion.from+(lidMotion.to-lidMotion.from)*alpha;',
    'globalThis.__actualFrameTime=actualFrameTime;'
  ].join('\n');
  for(let i=0;i<frames.length;i++){
    const now=frames[i];
    if(i===resetAt)prev=0;
    const sandbox={now,previousRenderAt:prev,lidMotion,pt,pNow,ease:{smooth},clamp:bound,Math};
    vm.runInNewContext(code,sandbox,{timeout:150});
    assert(sandbox.__actualFrameTime<=.18+1e-8,'physics frame bound remains separate');
    pNow=sandbox.pNow;
    results.push({at:now,pNow,elapsed:lidMotion.elapsed,physics:sandbox.__actualFrameTime});
    prev=now;
  }
  return results;
}
test('real engine uses elapsed wall time for lid and camera, bounded physics unchanged',()=>{
  assert.match(wall,/now - previousRenderAt/);
  assert.match(advance,/foregroundFrameTime/);
  assert.match(dolly,/foregroundFrameTime/);
  assert.match(physics,/Math.min\(0.05, clock.getDelta\(\)\)/);
});
test('30fps opening completes in roughly three seconds, without skipping lid animation',()=>{
  const seq=Array.from({length:107},(_,i)=>100+i*33.33);
  const r=runTimeline(seq);
  assert(r[40].pNow>.2 && r[40].pNow<.9,'lid must progress, not instantly pop');
  assert(r.at(-1).pNow>.999,'lid must open on real time');
});
test('2fps opening does not take minutes because frame delta is clamped',()=>{
  const r=runTimeline([100,600,1100,1600,2100,2600,3100,3600]);
  assert(r[4].pNow>.5,'visual progress must be noticeable after two seconds');
  assert(r.at(-1).pNow>.99,'slow frames must still finish the lid opening');
});
test('2fps closing also completes and can reverse after player input',()=>{
  const r=runTimeline([100,600,1100,1600,2100],0);
  assert(r.at(-1).pNow<.001);
});
test('hidden tab time does not count towards lid animation',()=>{
  const r=runTimeline([100,600,30000,30600],1,2);
  assert(r[2].pNow<.5,'do not jump to open on first frame after returning');
  assert(r[3].pNow>r[2].pNow);
});
test('camera dolly uses real time, without affecting movement/physics clock',()=>{
  const sandbox={entryDolly:{elapsed:0,duration:1.55},foregroundFrameTime:1.7,Math};
  vm.runInNewContext(dolly,sandbox,{timeout:150});
  assert.equal(sandbox.entryDolly.elapsed,1.55);
});
