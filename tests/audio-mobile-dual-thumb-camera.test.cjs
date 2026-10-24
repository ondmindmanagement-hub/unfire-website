'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const engine = fs.readFileSync('audio/maletin/game-engine-v50.js', 'utf8');
const css = fs.readFileSync('audio/maletin/thumb-reach.css', 'utf8');
const extract = (start, end) => {
  const a = engine.indexOf(start);
  assert(a >= 0, 'missing event handler: ' + start);
  const b = engine.indexOf(end, a + start.length);
  assert(b > a, 'missing ending: ' + end);
  return engine.slice(a, b);
};

// A joystick pointer is elsewhere in the document, so the next finger that lands
// on the scene's canvas can be non-primary. Its camera drag must still start.
const listeners = {};
let downs = 0;
const state = {
  activeTouchPointers: new Set(),
  drag: null,
  CINE: { on: false },
  MV: null,
  view: { gx: 0, gz: 0 },
  cv: {
    addEventListener: (name, listener) => { listeners[name] = listener; },
    setPointerCapture: () => {},
  },
  tapMoment: () => 100,
  onDown: () => { downs++; },
  knobDrag: null,
  REC: { on: false },
  ROAMS: { on: true, yaw: 0, pitch: 0, tgt: {}, k: { w: 1, a: 0 } },
  CASE_VIEW: { on: false },
  clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
  ORB: { az: 0, gaz: 0, gde: 0 },
  Math,
  hover: () => {},
};
vm.runInNewContext(extract(
  "cv.addEventListener('pointerdown', (e) => {",
  "cv.addEventListener('contextmenu',"
), state, { timeout: 1500 });
vm.runInNewContext(extract(
  "cv.addEventListener('pointermove', (e) => { if (MV && MV.drag)",
  "addEventListener('pointerup', (e) => {"
), state, { timeout: 1500 });
assert.equal(typeof listeners.pointerdown, 'function');
assert.equal(typeof listeners.pointermove, 'function');

const touch = (pointerId, x, y, isPrimary = false) => ({
  pointerType: 'touch', pointerId, clientX: x, clientY: y, isPrimary,
  isTrusted: true, button: 0, shiftKey: false,
});
// Left joystick already held (ROAMS.k.w=1). The camera's first canvas touch
// is pointer 42 and isPrimary=false, but must be captured.
listeners.pointerdown(touch(42, 280, 210, false));
assert.equal(state.drag.id, 42, 'camera finger rejected while walking');
assert.equal(downs, 1, 'touch should use existing scene handler');
listeners.pointermove(touch(42, 345, 185, false));
assert(state.ROAMS.yaw > 0.3, 'horizontal camera rotation did not respond');
assert(state.ROAMS.pitch > 0.09, 'vertical camera rotation did not respond');
assert.equal(state.ROAMS.k.w, 1, 'right thumb released or overwrote left-stick walking');

// Two simultaneous fingers on the camera canvas must not become a click/drag.
listeners.pointerdown(touch(43, 345, 185, false));
assert.equal(state.drag, null, 'multi-finger canvas gesture should cancel drag');
assert.equal(downs, 1, 'second canvas finger must not trigger interactions');

const clamp = (min, ideal, max) => Math.min(max, Math.max(min, ideal));
const portrait = { w: 390, h: 844 };
const landscape = { w: 844, h: 390 };
const tablet = { w: 820, h: 1180 };
// Guard real CSS declarations and numerical ergonomics in the scoped breakpoints.
for (const token of [
  '--uf-joy-inset: clamp(28px, 5.5vw, 78px);',
  '--uf-joy-rise: clamp(62px, 11dvh, 135px);',
  '--uf-joy-inset:clamp(36px, 7vw, 112px);',
  '--uf-joy-rise:clamp(31px, 9dvh, 100px);',
  '--uf-joy-inset:clamp(34px, 9vw, 50px);',
  '--uf-joy-rise:clamp(68px, 12dvh, 112px);',
  '--uf-joy-rise:clamp(30px, 8dvh, 46px);',
  'left:calc(var(--uf-thumb-safe-l) + var(--uf-joy-inset))!important;',
  'bottom:calc(var(--uf-thumb-safe-b) + var(--uf-joy-rise))!important;',
  'body.unfire-roaming #unfireTouchPad'
]) assert(css.includes(token), 'missing ergonomic rule: ' + token);
assert(css.includes('env(safe-area-inset-left') && css.includes('env(safe-area-inset-bottom'));
assert(engine.includes('if (on && pid === null) { const c = Math.max(0, (pad.clientWidth - knob.offsetWidth) / 2);'),
  'joystick thumb must stay centered at rest after size/orientation changes');
assert(css.includes('@media (pointer:coarse) and (orientation:portrait)'));
assert(css.includes('@media (pointer:coarse) and (orientation:landscape)'));
assert(!css.includes('@import'), 'control stylesheet must stay local');
const portraitX = clamp(34, portrait.w * 0.09, 50);
const portraitBottom = clamp(68, portrait.h * 0.12, 112);
const landscapeX = clamp(36, landscape.w * 0.07, 112);
const landscapeBottom = clamp(30, landscape.h * 0.08, 46);
const tabletX = clamp(28, tablet.w * 0.055, 78);
const tabletBottom = clamp(62, tablet.h * 0.11, 135);
assert(portraitX > 30 && portraitBottom > 65);
assert(landscapeX > 35 && landscapeBottom >= 30);
assert(tabletX > 40 && tabletBottom > 120);
assert(portraitX + 104 < portrait.w / 2, 'portrait joystick blocks the screen centre');
assert(landscapeX + 94 < landscape.w / 2, 'landscape joystick blocks the screen centre');
assert(tabletX + 140 < tablet.w / 2, 'tablet joystick blocks the screen centre');
console.log('PASS mobile dual-thumb: joystick-held camera, secondary touch, touch safety and reach in 3 layouts');
