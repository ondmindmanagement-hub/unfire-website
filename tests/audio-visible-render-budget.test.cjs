'use strict';
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const engine = readFileSync(join(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');

const budgetSrc = engine.match(/const INSPECTION_BUDGET =\s*([\s\S]*?);\s*const RT =/);
assert.ok(budgetSrc, 'render target tier budget must be present');
const budget = new Function('LOWDEV', 'DEVICE', 'return (' + budgetSrc[1] + ');');

test('compact auxiliary preview uses fewer than 15% desktop pixels and a longer render interval', () => {
  const desktop = budget(false, {tier:'desktop'});
  const compact = budget(true, {tier:'compact'});
  assert.deepEqual(desktop, {width:512,height:320,stride:4});
  assert.deepEqual(compact, {width:192,height:120,stride:8});
  assert.ok(compact.width*compact.height/(desktop.width*desktop.height) < .15);
  assert.equal(compact.width/compact.height, desktop.width/desktop.height);
});
test('balanced auxiliary preview is quarter-sized, retaining original aspect ratio', () => {
  const b = budget(true, {tier:'balanced'});
  assert.deepEqual(b,{width:256,height:160,stride:6});
});
test('inspection pass remains on-demand and slows rather than adding a second animation loop', () => {
  assert.match(engine, /rtPlane\.visible = !!SEL && lidOpen > 0\.9;/);
  assert.match(engine,/window\.__LOWFPS \? Math\.ceil\(INSPECTION_BUDGET\.stride \* 1\.5\)/);
  assert.match(engine,/frameN % inspectionStride/);
  assert.ok(!/requestAnimationFrame/.test(engine.slice(engine.indexOf('const INSPECTION_BUDGET'),engine.indexOf('rtPlane.visible = false;'))));
});
test('mobile decorative meshes delegate camera-frustum rejection to THREE', () => {
  assert.match(engine, /m\.castShadow = m\.receiveShadow = false; m\.frustumCulled = LOWDEV;/);
  assert.match(engine, /const mediaFrustum = new THREE\.Frustum\(\), mediaMatrix = new THREE\.Matrix4\(\)/);
  assert.match(engine, /v\.preload = 'none'; v\.src = MED2 \+ f;/);
});

const mediaStart = engine.indexOf('const videoNow = performance.now();');
const mediaEnd = engine.indexOf('const day = window.__SKYDAY',mediaStart);
assert.ok(mediaStart>0 && mediaEnd>mediaStart);
const mediaFn = new Function('out', 'LOWDEV', 'self', 'SCR', 'performance', 'cam', 'mediaFrustum', 'mediaMatrix',
  engine.slice(mediaStart,mediaEnd));
function video(inSight, paused=false) {
  const v={paused,plays:0,pauses:0,play(){this.plays++;this.paused=false;return Promise.resolve()},pause(){this.pauses++;this.paused=true}};
  return {m:{inSight,visible:true,updateMatrixWorld(){}},v};
}
test('offscreen media pauses, reappears on camera turn, and stops immediately when leaving outdoors', () => {
  const a=video(true,true), b=video(false,false);
  const scr=[a,b], self={};
  let now=1000, frustumChecks=0, cameraUpdates=0;
  const perf={now:()=>now};
  const cam={projectionMatrix:{},matrixWorldInverse:{},updateMatrixWorld:()=>cameraUpdates++};
  const matrix={multiplyMatrices(){return this}};
  const frustum={setFromProjectionMatrix(){return this},intersectsObject(m){frustumChecks++;return m.inSight}};
  const run=(out)=>mediaFn(out,true,self,scr,perf,cam,frustum,matrix);
  run(true);
  assert.equal(a.m.visible,true); assert.equal(a.v.plays,1);
  assert.equal(b.m.visible,false); assert.equal(b.v.pauses,1);
  now+=30; a.m.inSight=false;run(true);
  assert.equal(a.m.visible,true,'short intervals reuse visibility result');
  now+=120; run(true);
  assert.equal(a.m.visible,false);assert.equal(a.v.pauses,1);
  b.m.inSight=true;now+=140;run(true);
  assert.equal(b.m.visible,true);assert.equal(b.v.plays,1);
  run(false);
  assert.equal(b.v.pauses,2);assert.equal(b.m.visible,false);
  assert.ok(frustumChecks >= 6 && cameraUpdates >= 3);
});
test('desktop background video retains original behavior rather than applying mobile view filtering',()=>{
  const a=video(false,true),b=video(false,false);
  const now={now:()=>1000};
  mediaFn(true,false,{},[a,b],now,{}, {}, {});
  assert.equal(a.v.plays,1);
  assert.equal(a.m.visible,true);assert.equal(b.m.visible,true);
});
test('HUD is changed only when its text actually changes, not in every render frame',()=>{
  assert.match(engine, /const hudCopy = \{ buyKey: null, buyText: null, crumb: null, tip: null \}/);
  assert.match(engine, /if \(hudCopy\.buyText !== buyText\) \{ \$\('buy'\)\.textContent = buyText;/);
  assert.match(engine, /if \(hudCopy\.crumb !== crumbText\) \{ \$\('crumb'\)\.innerHTML = crumbText;/);
  assert.match(engine, /if \(hudCopy\.tip !== mobileTip\) \{[\s\S]{0,110}\$\('tip'\)\.classList\.toggle/);
});
test('offscreen and closed case screens do not consume repeated 2D rasterization/upload work',()=>{
  assert.match(engine, /if \(caseG\.visible && lidOpen > 0\.05\) drawScr\(t, A\.song, CINE\.on\);/);
  assert.match(engine, /scrT = 0\.25;/);
});
