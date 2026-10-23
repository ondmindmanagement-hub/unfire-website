// Input event regression: tap jitter, multi-touch, pointer cancel and legacy Safari.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../audio/maletin/index.html'), 'utf8');
new vm.Script(src);
assert.match(html, /#cv\s*\{[^}]*touch-action:none/, 'WebGL canvas does not allow scrolling to cancel a touch');
const i = src.indexOf('  let drag = null;\n  // Touch taps');
const j = src.indexOf('  // pellizco en móvil', i);
assert(i > 0 && j > i, 'Stable input block exists');
const block = src.slice(i, j);
function harness(legacy = false) {
  const local = {}, global = {};
  let clicks = 0, now = 1000;
  const cv = {
    addEventListener(type, callback) { (local[type] ||= []).push(callback); },
    setPointerCapture() {}
  };
  const vmctx = {
    cv, addEventListener(type, callback) { (global[type] ||= []).push(callback); },
    window: legacy ? {} : { PointerEvent() {} },
    CINE: { on: false }, MV: null, knobDrag: null,
    ROAMS: { on: false }, REC: { on: false },
    view: { gx: 0, gz: 0 }, ORB: { gaz: 0, gde: 0 },
    zoomed: () => false,
    clamp: (v, lo, hi) => Math.min(hi, Math.max(lo, v)),
    onDown: () => {}, onClick: () => { clicks++; }, endKnob: () => {},
    hover: () => {}, performance: { now: () => now }, say: () => {}, $: () => ({
      querySelectorAll: () => []
    })
  };
  vm.runInNewContext(block, vmctx);
  const dispatch = (bucket, name, evt) => (bucket[name] || []).forEach(cb => cb(evt));
  const pointer = (type, id, x, y, other = {}) => ({
    pointerType: type, pointerId: id, clientX: x, clientY: y, button: 0,
    shiftKey: false, isPrimary: true, ...other
  });
  return {
    down: (e) => dispatch(local, 'pointerdown', e),
    move: (e) => dispatch(local, 'pointermove', e),
    up: (e) => dispatch(global, 'pointerup', e),
    cancel: (e) => dispatch(global, 'pointercancel', e),
    reset: (name) => dispatch(global, name, {}),
    touch: (event, e) => dispatch(local, event, e),
    pointer, clicks: () => clicks, advance: (ms) => { now += ms; }
  };
}
let t = harness();
t.down(t.pointer('touch', 1, 110, 150));
t.move(t.pointer('touch', 1, 117, 158));
t.up(t.pointer('touch', 1, 117, 158));
assert.equal(t.clicks(), 1, '8px of natural finger jitter is a TAP and opens on first release');
t.down(t.pointer('touch', 2, 110, 150));
t.move(t.pointer('touch', 2, 145, 150));
t.up(t.pointer('touch', 2, 145, 150));
assert.equal(t.clicks(), 1, '35px drag must not open the case');
t.down(t.pointer('touch', 3, 110, 150));
t.cancel(t.pointer('touch', 3, 110, 150));
t.up(t.pointer('touch', 3, 110, 150));
assert.equal(t.clicks(), 1, 'Canceled touch cannot open');
t.down(t.pointer('touch', 4, 110, 150));
t.down(t.pointer('touch', 5, 110, 150, { isPrimary: false }));
t.up(t.pointer('touch', 4, 110, 150));
t.up(t.pointer('touch', 5, 110, 150, { isPrimary: false }));
assert.equal(t.clicks(), 1, 'Two-finger gesture cannot open');
t.down(t.pointer('touch', 6, 110, 150));
t.advance(1200);
t.up(t.pointer('touch', 6, 110, 150));
assert.equal(t.clicks(), 1, 'Long hold does not count as case tap');
t.down(t.pointer('mouse', 7, 110, 150));
t.move(t.pointer('mouse', 7, 118, 150));
t.up(t.pointer('mouse', 7, 118, 150));
assert.equal(t.clicks(), 1, 'Desktop mouse drag threshold is preserved');
t.down(t.pointer('mouse', 8, 110, 150));
t.up(t.pointer('mouse', 8, 110, 150));
assert.equal(t.clicks(), 2, 'Desktop click still opens case');
t.down(t.pointer('pen', 9, 110, 150));
t.move(t.pointer('pen', 9, 117, 150));
t.up(t.pointer('pen', 9, 117, 150));
assert.equal(t.clicks(), 3, 'Pen taps work with small jitter');
t.down(t.pointer('touch', 10, 110, 150));
t.down(t.pointer('touch', 11, 110, 150, {isPrimary:false}));
t.reset('orientationchange');
t.down(t.pointer('touch', 12, 110, 150));
t.up(t.pointer('touch', 12, 110, 150));
assert.equal(t.clicks(), 4, 'Rotating mid-gesture clears stale IDs so the next tap works');
t.down(t.pointer('touch', 13, 110, 150, {timeStamp:4000}));
t.advance(6000); // A slow frame must not make a physically short 170ms tap expire.
t.up(t.pointer('touch', 13, 110, 150, {timeStamp:4170}));
assert.equal(t.clicks(), 5, 'Delayed mobile dispatch uses true event timestamps');
t = harness(true);
const T = (x, y) => ({ clientX: x, clientY: y });
t.touch('touchstart', { touches: [T(100, 100)] });
t.touch('touchend', { touches: [], changedTouches: [T(106, 106)] });
assert.equal(t.clicks(), 1, 'Legacy WebKit touchend opens without pointer events');
t.touch('touchstart', { touches: [T(100, 100)] });
t.touch('touchmove', { touches: [T(140, 100)] });
t.touch('touchend', { touches: [], changedTouches: [T(140, 100)] });
assert.equal(t.clicks(), 1, 'Legacy touch drag never opens');
console.log('PASS: touch slop, one-tap, pen, mouse, multi-touch, cancel, long-hold and legacy Safari');
