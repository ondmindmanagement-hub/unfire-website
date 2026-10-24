'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const engine = fs.readFileSync(path.join(__dirname,'../audio/maletin/game-engine-v50.js'),'utf8');
const html = fs.readFileSync(path.join(__dirname,'../audio/maletin/index.html'),'utf8');
const start = engine.indexOf('    if (MAP.expandedOpen ||');
const end = engine.indexOf('    // Cap this heavy 3D scene',start);
assert.ok(start>0 && end>start,'Modal GPU guard must precede WebGL frame workload');
const block = engine.slice(start,end);
function check(display, map=false, shop=false) {
  const state = { MAP:{expandedOpen:map,tick(){}}, window:{UNFIRE_COINS:{isOpen:shop}},
    document:{getElementById(id){assert.equal(id,'storyMenu');return {style:{display}};}},
    clock:{getDelta(){}}, adaptivePerf:{since:2,frames:4,slow:4}, previousRenderAt:13 };
  const result = vm.runInNewContext('(function(){'+block+'return "render";})()',state,{timeout:300});
  return {result,state};
}
test('opening History suspends WebGL before touching the close button',()=>{
  assert.match(html,/menu\.style\.display = 'block'/);
  assert.equal(check('block').result,undefined);
  assert.equal(check('none').result,'render');
});
test('existing map and shop rendering pauses remain unchanged',()=>{
  assert.equal(check('none',true).result,undefined);
  assert.equal(check('none',false,true).result,undefined);
  assert.equal(check('none',false,false).result,'render');
});
test('modal pause drains elapsed frame time without losing game position',()=>{
  const {state}=check('block');
  assert.equal(state.previousRenderAt,0);
  assert.equal(state.adaptivePerf.frames,0);
  assert.equal(state.adaptivePerf.slow,0);
  assert.equal(state.adaptivePerf.since,0);
  assert.match(html,/id = 'storyMenu'/);
});
