'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');
new vm.Script(source, { filename: 'game-engine-v50.js' });
assert.match(source, /picks\.push\(\{ o: gm, f: go, noFocus: true \}\)/, 'machine tap must not route avatar into glass');
assert.match(source, /R\.userData\.gachaFocus = \{[\s\S]*?camWide:[\s\S]*?camTall:[\s\S]*?target:/, 'reward camera supplies landscape and portrait shots');
assert.match(source, /ROAMS\.tgt = null;\s*R\.userData\.gachaFocus = \{/, 'tap interrupts any previous automatic approach');
assert.match(source, /Math\.abs\(yawDelta\) > 0\.045/, 'manual view rotation breaks out of presentation');
assert.match(source, /keys\.w \|\| keys\.a \|\| keys\.s \|\| keys\.d/, 'movement restores player camera');
assert.match(source, /keys\.ArrowUp \|\| keys\.ArrowDown/, 'arrow-key movement restores player camera');
assert.match(source, /gachaFocus = null; \} if \(queued\)/, 'camera expires after reward reveal');
assert.match(source, /ROAMS\.on && !ROAMS\.fly && !CASE_VIEW\.on && !REC\.on && !VIEW\.on && !window\.ATM_OUT/, 'do not override flight, case, recorder, cinematic or exterior');
const apply = source.indexOf('const gachaShot = ROOM.R.userData.gachaFocus');
const render = source.indexOf('S.renderer.render(S.scene, cam);', apply);
assert.ok(apply > source.indexOf('if(CASE_VIEW.on&&ROAMS.on'), 'the reward framing is applied after first-person and case cameras');
assert.ok(render > apply && render - apply < 1800, 'framing precedes the same-frame render');

// Project the machine and prize bounds in multiple viewport shapes.
function project([x,y,z], [ex,ey,ez], [tx,ty,tz], fov, aspect) {
  const dy=ty-ey, dz=tz-ez, norm=Math.hypot(dy,dz), fy=dy/norm, fz=dz/norm;
  const ry=fz, rz=-fy;
  const vx=x-ex, vy=y-ey, vz=z-ez;
  const depth=vy*fy+vz*fz, scale=Math.tan(fov*Math.PI/360);
  assert.ok(depth > 5, 'camera remains outside the machine');
  return {nx:vx/(depth*scale*aspect), ny:(vy*ry+vz*rz)/(depth*scale)};
}
const components = [
  [-4.6,12,0],[4.6,12,0],[0,17.8,0],
  [-3.6,5,10],[3.6,5,10],[0,1,10],[0,9,10],
];
for (const setup of [
  {name:'desktop landscape / third person',eye:[0,10,30],target:[0,6,8],fov:56,aspect:1.5},
  {name:'mobile portrait / first person',eye:[0,12,37],target:[0,6,8],fov:64,aspect:0.5},
  {name:'tablet portrait',eye:[0,12,37],target:[0,6,8],fov:64,aspect:0.7}
]) for(const vertex of components) {
  const {nx,ny}=project(vertex,setup.eye,setup.target,setup.fov,setup.aspect);
  assert.ok(Math.abs(nx)<0.87 && Math.abs(ny)<0.94, setup.name+' clips '+vertex+': '+nx.toFixed(3)+','+ny.toFixed(3));
}
console.log('Gacha camera: syntax, no-auto-approach, cancellation, layer order, 21 viewport-framing checks PASS.');
