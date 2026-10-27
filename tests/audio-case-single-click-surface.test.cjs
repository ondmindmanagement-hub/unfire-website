// Regression: the entire *closed physical lid* opens on one real click/tap.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');
new vm.Script(src);
const from = src.indexOf('  function closedCaseLidHit(e) {');
const to = src.indexOf('  let closedCaseActivatedAt = -Infinity;', from);
assert(from > 0 && to > from, 'Closed lid hit helper exists');
assert.match(src, /hitD \|\| ray\.intersectObject\(caseG, true\)\.length \|\| closedCaseLidHit\(e\)/,
  'Full lid hit is accepted by the existing open action');
const ndc = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } };
const caseG = {
  visible: true, position: { y: 0.55 }, updateWorldMatrix() {},
  worldToLocal(p) { return p; }
};
let carryingCase = false;
const ctx = {
  caseG, carryingCase, CW: 5.8, CD: 3.9, HL: 0.42,
  ndc, cam: {},
  innerWidth: 1200, innerHeight: 800,
  ray: { setFromCamera() {}, ray: { intersectPlane() {
    return { x: ndc.x * 4, z: ndc.y * 3 };
  } } },
  THREE: { Plane: class Plane { constructor() {} } },
  V: (x, y, z) => ({ x, y, z }),
  Math
};
vm.createContext(ctx);
vm.runInContext(src.slice(from, to) + '\nthis.hit = closedCaseLidHit;', ctx);
const click = (x, y) => ctx.hit({ clientX: x, clientY: y });
assert(click(600, 400), 'Centre butterfly accepts one click');
assert(click(900, 400), 'Lid sticker/side accepts one click, not only the butterfly');
assert(!click(1175, 400), 'Click on surrounding table never opens the case');
assert(!click(600, 780), 'Click below the case never opens it');
caseG.visible = false;
assert(!click(600, 400), 'Invisible/stowed case must not be clicked');
caseG.visible = true;
vm.runInContext('carryingCase = true', ctx);
assert(!click(600, 400), 'Carried case must not react to background clicks');
assert.match(src, /cv\.addEventListener\('click', \(e\) =>/,
  'Native click fallback is registered when pointerup is swallowed by Safari');
const b = src.indexOf("  cv.addEventListener('click', (e) => {");
const e = src.indexOf('  function hover(e) {', b);
assert(b > 0 && e > b, 'Native click fallback is bounded');
let now = 1000;
let calls = 0;
let onClick = null;
const cbCtx = { cv: { addEventListener(type, fn) { if (type === 'click') onClick = fn; } },
  performance: { now: () => now }, Math };
vm.createContext(cbCtx);
vm.runInContext(`
  let lidOpen=0, pTarget=0, closedCaseActivatedAt=-Infinity;
  function closedCaseLidHit(e){return !!e.overCase;}
  function onClick(){ closedCaseActivatedAt=performance.now(); calls++; }
` + src.slice(b, e), Object.assign(cbCtx, {calls: 0}));
assert(onClick, 'Click fallback callback connected');
onClick({isTrusted: true, overCase: true});
assert.equal(cbCtx.calls, 1, 'First native click opens');
onClick({isTrusted: true, overCase: true});
assert.equal(cbCtx.calls, 1, 'Synthetic click after normal pointerup does not double-open');
now += 360;
onClick({isTrusted: true, overCase: false});
assert.equal(cbCtx.calls, 1, 'No action on the table');
onClick({isTrusted: false, overCase: true});
assert.equal(cbCtx.calls, 1, 'Untrusted synthetic events cannot force case opening');
vm.runInContext('lidOpen = 1', cbCtx);
onClick({isTrusted: true, overCase: true});
assert.equal(cbCtx.calls, 1, 'Open lid never steals clicks from internal controls');
console.log('PASS: one click on closed case, edge, empty table, stowed case, Safari fallback and no double-open');
