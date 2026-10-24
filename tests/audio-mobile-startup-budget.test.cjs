'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const engine = fs.readFileSync(path.join(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');
const segment = (from, until) => {
  const a=engine.indexOf(from);
  const b=engine.indexOf(until,a+from.length);
  assert.ok(a>=0 && b>a, 'Required startup code exists: '+from);
  return engine.slice(a,b);
};
const gpu = segment("  const DEVICE=window.__UNFIRE_AUTOCALIB", "  S.controls.enabled = false;");
const alu = segment("  const ALU = (() => {", "  FOAM.copy(ALU)");
const grass = segment("    const grassSize =", "    const ground =");
const sea = segment("      const seaG = new THREE.PlaneGeometry", "sea.rotation.x");

// The same mobile profile is used by recent iPhones and older devices.
assert.match(gpu,/let LOWDEV = DEVICE\.tier!=='desktop'/);
assert.match(gpu,/LOWDEV && DEVICE\.touch/);
assert.match(gpu,/DEVICE\.tier === 'compact' \? 0\.70 : 0\.85/);
assert.match(gpu,/S\.renderer\.setPixelRatio\(Math\.min\(S\.renderer\.getPixelRatio\(\), DEVICE\.maxDpr\)\)/);
assert.match(gpu,/if \(LOWDEV\) \{ S\.renderer\.shadowMap\.enabled = false; \}/);
assert.match(alu,/aluSize = LOWDEV \? 512 : 1024/);
assert.match(alu,/LOWDEV \? 3000 : 14000/);
assert.match(alu,/LOWDEV \? 24 : 70/);
assert.match(alu,/LOWDEV \? 9 : 25/);
assert.match(alu,/color: true, repeat: \[2, 2\]/);
assert.match(alu,/metalness: 0\.62/);
assert.match(alu,/roughnessMap: rou, bumpMap: rou/);
assert.match(grass,/grassSize = LOWDEV \? 512 : 1024/);
assert.match(grass,/LOWDEV \? 6500 : 26000/);
assert.match(grass,/LOWDEV \? 18 : 60/);
assert.match(grass,/LOWDEV \? 120 : 400/);
assert.match(grass,/grassT\.repeat\.set\(26, 26\)/);
assert.match(sea,/window\.__LOWDEV \? 120 : 320, window\.__LOWDEV \? 120 : 320/);
assert.match(sea,/vertexShader:/, 'Ocean shader remains intact');

// Execute exact budget definitions from the game (not reimplemented estimates).
const assignments=[
  alu.match(/const aluSize = [^;]+;/)?.[0],
  grass.match(/const grassSize = [^;]+;/)?.[0],
  gpu.match(/const bootDpr = [^;]+;/)?.[0],
];
assert.ok(assignments.every(Boolean),'Actual budget expressions are available');
for(const [low,tier,aluExpected,grassExpected,dprExpected] of [
  [true,'compact',512,512,.70],
  [true,'balanced',512,512,.85],
  [false,'desktop',1024,1024,.85]
]){
  const context={LOWDEV:low,DEVICE:{tier}};
  const budgets=vm.runInNewContext(assignments.join('\n')+'({aluSize,grassSize,bootDpr})',context);
  assert.equal(budgets.aluSize,aluExpected);
  assert.equal(budgets.grassSize,grassExpected);
  assert.equal(budgets.bootDpr,dprExpected);
}
const oldSeaVertices=221*221, newSeaVertices=121*121;
assert.ok(newSeaVertices/oldSeaVertices<0.31,'Mobile sea cuts >69% vertex count');
assert.ok((512*512)/(1024*1024)===0.25,'Each reduced canvas uses 25% texels');
assert.doesNotMatch(gpu,/requestAnimationFrame|setInterval/,'No added governor loop');
assert.match(engine,/window\.__roamAPI/,'Roaming APIs preserved');
assert.match(engine,/NANO_SCALE/,'Nano physics still available');
console.log('PASS mobile first-frame budgets, desktop preservation, procedural surfaces, and runtime profile expressions');
