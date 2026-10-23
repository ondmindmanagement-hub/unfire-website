'use strict';
// Compatibility between #82 stabilized 1p movement and #86 adaptive/Gamepad inputs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const engine = fs.readFileSync(path.resolve(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');
const html = fs.readFileSync(path.resolve(__dirname, '../audio/maletin/index.html'), 'utf8');
const from = engine.indexOf("else if (ROAMS.mode === '1p' && !ROAMS.mini) {");
const to = engine.indexOf('} else { ROAMS.cy = ROAMS.yaw; roamMove(', from);
assert(from > 0 && to > from, 'First person code must exist');
const motion = engine.slice(from + "else if (ROAMS.mode === '1p' && !ROAMS.mini) {".length, to);
const step = new Function('ROAMS', 'K', 'fw', 'dt', 'SPD', 'window', 'roamMove', motion);
function move({keys = {}, fw = 0, touch = null, pad = null, flying = false} = {}) {
  const r = {yaw: 0, cy: 0, p: {x: 0,z: 0}, fly: flying, padState: pad, touchStick: touch};
  const roamMove = (front, side) => {
    r.p.x += Math.sin(r.yaw) * front + Math.cos(r.yaw) * side;
    r.p.z -= Math.cos(r.yaw) * front - Math.sin(r.yaw) * side;
  };
  step(r, keys, fw, 1/30, 1, {ATM_OUT:false}, roamMove);
  return r;
}
const touch = move({touch:{x:0.6,y:0.7}, fw:0.7});
assert(touch.p.x > 0.4 && touch.p.z < -0.5, 'Joystick moves diagonally in first person');
assert.equal(touch.yaw, 0, 'Left stick must not rotate 1p camera');
const analog = move({pad:{lx:-0.6,ly:0.8}, fw:0.8, flying:true});
assert(analog.p.x < -0.3 && analog.p.z < -0.5, 'Gamepad can strafe and fly simultaneously');
const keyboard = move({keys:{d:1}, flying:true});
assert(keyboard.p.x > 0 && keyboard.yaw === 0, 'Keyboard D remains strafe');
const turn = move({keys:{e:1}});
assert(turn.yaw > 0 && turn.p.x === 0 && turn.p.z === 0, 'Q/E remain yaw without phantom movement');
assert(engine.includes('PADSTATE.sprint'), 'Gamepad sprint must survive original movement block');
assert(engine.includes('PADSTATE.down') && engine.includes('PADSTATE.up'), 'Fly and descent controls remain independent');
assert(html.includes('unfire-performance-guard.js?v=20261023textureguard1'), 'Performance sampler still initializes');
assert(html.includes('adaptive-controls.js?v=20261023controls1'), 'Gamepad module still initializes');
assert(html.indexOf('unfire-performance-guard.js') < html.lastIndexOf('game-engine-v50.js?v=20261023gameflightdomev2'), 'GPU sampler loads before engine');
assert(html.indexOf('adaptive-controls.js') < html.lastIndexOf('game-engine-v50.js?v=20261023gameflightdomev2'), 'Adaptive input loads before engine');
console.log('PASS: 1p + gamepad + touch analog combined, turn/strafe, flight, script order.');
