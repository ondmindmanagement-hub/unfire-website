'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine=fs.readFileSync('audio/maletin/game-engine-v50.js','utf8');
const match=engine.match(/function queueResize\(\)\s*\{\s*if\(queuedResize\)return;\s*queuedResize=setTimeout\(\(\)=>\{queuedResize=0;resize\(\);\},0\);\s*\}/);
assert.ok(match,'rotation events coalesce through a scheduled task, independent of GPU RAF');
test('a burst of mobile orientation events results in one exact resize and supports later rotations',()=>{
  const tasks=[];
  let calls=0;
  const ctx={
    resize:()=>calls++,
    setTimeout:(fn,delay)=>{assert.equal(delay,0);tasks.push(fn);return tasks.length;},
    requestAnimationFrame:()=>{throw Error('resize must not depend on GPU RAF');}
  };
  vm.runInNewContext('let queuedResize=0;'+match[0]+';globalTest=queueResize',ctx);
  for(let i=0;i<12;i++)ctx.globalTest();
  assert.equal(tasks.length,1);
  assert.equal(calls,0);
  tasks.shift()();
  assert.equal(calls,1);
  ctx.globalTest();
  assert.equal(tasks.length,1);
  tasks.shift()();
  assert.equal(calls,2);
});
test('resize retains exact screen and renderer geometry, quality cap and orientation',()=>{
  assert.match(engine,/const w=Math\.max\(1,Math\.round\(innerWidth \|\| document\.documentElement\.clientWidth\)\)/);
  assert.match(engine,/S\.renderer\.setSize\(w,h,false\);cam\.aspect=w\/h;cam\.updateProjectionMatrix\(\)/);
  assert.match(engine,/window\.__unfireViewport=\{width:w,height:h,orientation:w>=h\?'landscape':'portrait'\}/);
  assert.match(engine,/addEventListener\('orientationchange',\(\)=>setTimeout\(queueResize,120\)/);
});
