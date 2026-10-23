// Deterministic first-person locomotion and camera regression without WebGL.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.resolve(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');
new vm.Script(code, { filename: 'game-engine-v50.js' });
let checks = 0;
const check = (condition, label) => { assert(condition, label); checks++; };

function between(a, b) {
  const i = code.indexOf(a), j = code.indexOf(b, i + a.length);
  check(i >= 0 && j > i, 'unique engine block: ' + a.slice(0, 55));
  return code.slice(i + a.length, j);
}
const motion = between(
  "else if (ROAMS.mode === '1p' && !ROAMS.mini) {",
  "} else { ROAMS.cy = ROAMS.yaw; roamMove(");
const step = new Function('ROAMS', 'K', 'fw', 'dt', 'SPD', 'window', 'roamMove', motion);
function move(K, fw = 0, flying = false) {
  const r = { yaw: 0, cy: 0, p: { x: 0, z: 0 }, fly: flying };
  const roamMove = (front, side) => {
    r.p.x += Math.sin(r.yaw) * front + Math.cos(r.yaw) * side;
    r.p.z -= Math.cos(r.yaw) * front - Math.sin(r.yaw) * side;
  };
  step(r, K, fw, 1 / 60, 1, { ATM_OUT: false }, roamMove);
  return r;
}
const speed = 34 / 60;
let p = move({ w: 1 }, 1);
check(p.p.z < -0.99 * speed && Math.abs(p.p.x) < 0.001, 'W moves forward in 1p');
p = move({ d: 1 });
check(p.p.x > 0.99 * speed && Math.abs(p.yaw) < 0.001, 'D strafes right without rotating view');
p = move({ a: 1 });
check(p.p.x < -0.99 * speed && Math.abs(p.yaw) < 0.001, 'A strafes left without rotating view');
p = move({ ArrowRight: 1 });
check(p.yaw > 0 && Math.abs(p.p.x) < 0.001, 'right arrow rotates without translating');
p = move({ e: 1 });
check(p.yaw > 0 && Math.abs(p.p.z) < 0.001, 'E rotates even when standing still');
p = move({ w: 1, d: 1 }, 1);
check(Math.hypot(p.p.x, p.p.z) <= speed + 0.001, 'diagonal movement does not gain speed');
p = move({ d: 1 }, 0, true);
check(p.p.x > 0, 'strafe works while flying');
check(code.includes("(ROAMS.mode === '1p' && (K.q || K.e))"), 'turn-only input executes 1p motion path');
check(code.includes("ROAMS.moving = !!(fw || sd2 || (ROAMS.mode === '1p' && (K.a || K.d)))"), 'strafe, analog controls and keyboard continue walk animation');

class Vec {
  constructor(x, y, z) { this.x = x; this.y = y; this.z = z; }
  clone() { return new Vec(this.x, this.y, this.z); }
  copy(o) { this.x = o.x; this.y = o.y; this.z = o.z; return this; }
  distanceToSquared(o) { return (this.x - o.x) ** 2 + (this.y - o.y) ** 2 + (this.z - o.z) ** 2; }
  lerp(o, f) { this.x += (o.x - this.x) * f; this.y += (o.y - this.y) * f; this.z += (o.z - this.z) * f; return this; }
}
const V = (x, y, z) => new Vec(x, y, z);
const cameraBody = between(
  "if (FP) {\n        const outside =",
  "\n      } else { ROAMS.ep = null; }");
const cameraStep = new Function('ROAMS', 'window', 'V', 'cam', 'dt',
  "const outside =" + cameraBody);
const r = { yaw: 0, pitch: 0.2, p: { x: 0, z: 0 }, h: 8 };
const cam = { position: V(0, 0, 0), lookAt(x, y, z) { this.target = [x, y, z]; } };
cameraStep(r, { ATM_OUT: false }, V, cam, 1 / 60);
check(Math.abs(cam.position.y - (-8.9 + 8 + 9.6)) < 0.001, 'eye height is independent of animated head');
check(Math.abs(cam.position.z + 1.1) < 0.001, 'first-person eye has forward clearance');
check(Math.abs(cam.near - 0.12) < 0.001, 'near clipping plane kept valid indoors');
r.h += 100;
cameraStep(r, { ATM_OUT: false }, V, cam, 1 / 60);
check(Math.abs(cam.position.y - (-8.9 + 108 + 9.6)) < 0.001, 'fast flight altitude snaps instead of dragging into avatar');
r.p.x = 200;
cameraStep(r, { ATM_OUT: false }, V, cam, 1 / 60);
check(Math.abs(cam.position.x - 200) < 0.001, 'teleport snaps camera instead of crossing walls');
cameraStep(r, { ATM_OUT: true }, V, cam, 1 / 60);
check(r._fpOut === true && cam.near === 0.18, 'outside transition resets camera and near clipping');
check(!cameraBody.includes('hd.getWorldPosition'), 'animated head can no longer drive first-person view');
check(code.includes("} else { ROAMS.ep = null; }"), 'switching camera mode resets the previous eye smoothing');
check(code.includes('const AV = ROAMS.av, hd = AV && AV.r0'), 'missing avatar/head rig does not block first-person view');
console.log('PASS: ' + checks + ' first-person movement, flight, teleport, rig and camera assertions');
