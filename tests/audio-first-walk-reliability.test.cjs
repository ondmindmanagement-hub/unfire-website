'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = fs.readFileSync(path.resolve(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');
const physics = require('../audio/maletin/nano-physics.js');
function section(start, end) {
  const a = engine.indexOf(start);
  assert.notEqual(a, -1, 'missing '+start);
  const b = engine.indexOf(end, a + start.length);
  assert.notEqual(b, -1, 'missing '+end);
  return engine.slice(a,b);
}

test('PASEAR focuses the playing canvas and resets stale input without losing current spawn', () => {
  const src = section('function enterRoam() {', 'function exitRoam() {');
  const r = { on:false, k:{w:1}, tgt:{x:1}, p:{set(x,y,z){this.x=x;this.y=y;this.z=z}} };
  let focused=false, message='';
  const cv = {tabIndex:0, hasAttribute(){return false}, focus(opts){focused=opts.preventScroll===true}};
  const document = {body:{classList:{add(v){assert.equal(v,'unfire-roaming')}}}};
  const roamB = {};
  new Function('ROAMS','cv','document','roamB','say',src+'\nenterRoam();')(r,cv,document,roamB,v=>{message=v});
  assert.equal(r.on,true);
  assert.deepEqual(r.k,{});
  assert.equal(r.tgt,null);
  assert.equal(r.p.z,24);
  assert.equal(focused,true);
  assert.match(message,/W A S D/);
});

test('joystick moves on first press, changes on drag, stops on release', () => {
  const js = section('let pid = null, cx = 0, cy = 0; const setK', 'const resetTouch = () =>');
  const events={}; const knob={offsetWidth:36,style:{}};
  const pad = {
    clientWidth:130,clientHeight:130,
    addEventListener(name,fn){events[name]=fn;},
    getBoundingClientRect(){return {left:0,top:0,width:130,height:130};},
    setPointerCapture(){},releasePointerCapture(){}
  };
  const ROAMS={k:{}};
  new Function('pad','knob','ROAMS',js)(pad,knob,ROAMS);
  const e = (x,y) => ({pointerId:2,clientX:x,clientY:y,stopPropagation(){},preventDefault(){}});
  events.pointerdown(e(65,5));
  assert.equal(ROAMS.k.w,1, 'movement begins on touch-down without extra drag');
  events.pointermove(e(125,65));
  assert.equal(ROAMS.k.d,1);
  assert.equal(ROAMS.k.w,0);
  events.pointerup(e(125,65));
  assert.equal(ROAMS.k.d,0);
  events.pointerdown(e(65,120));
  events.pointercancel(e(65,120));
  assert.equal(ROAMS.k.s,0);
});

test('window blur releases all walking keys instead of leaving perpetual input', () => {
  const m = engine.match(/addEventListener\('blur', \(\) => \{ for \(const k in ROAMS\.k\) ROAMS\.k\[k\] = 0; \}\);/);
  assert.ok(m);
  let cb;const ROAMS={k:{w:1,Shift:1,ArrowLeft:1}};
  new Function('addEventListener','ROAMS',m[0])((name,fn)=>{assert.equal(name,'blur');cb=fn},ROAMS);
  cb();
  assert.deepEqual(Object.values(ROAMS.k),[0,0,0]);
});

test('incremental obstacle prewarm is enabled on desktop as well as mobile', () => {
  const at = engine.indexOf('function prewarmRoamingProps() {');
  assert.ok(at >= 0);
  const pre = engine.slice(at, at + 2200);
  assert.doesNotMatch(pre,/!LOWDEV/);
  assert.match(pre,/setTimeout\(scanSlice, 26\)/);
  assert.match(engine,/if \(!roomPrewarmRequested && !ROAMS\.on && !document\.hidden &&/);
  assert.match(engine,/setTimeout\(prewarmRoamingProps, 120\)/);
});

test('ordinary-size walking still respects furniture collision', () => {
  const p=physics.profile(false);
  const o=[{x0:2,x1:5,z0:2,z1:5,y0:-10,y1:10}];
  const move=physics.move2D({x:0,z:3},{x:6,z:0},o,p,{footY:-8.9,prePadding:0});
  assert.equal(move.blocked,true);
  assert.ok(move.x < 2, 'does not pass through furniture');
  const free=physics.move2D({x:0,z:10},{x:6,z:0},o,p,{footY:-8.9,prePadding:0});
  assert.ok(free.x > 5.9, 'unobstructed movement proceeds');
});
