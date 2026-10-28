'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const code = fs.readFileSync(path.join(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');
const source = code.match(/  const NIMBO_DESK = \(\(\) => \{[\s\S]*?\n  \}\)\(\);/);
assert.ok(source, 'Desk safety algorithm is present in the real game engine');
const desk = vm.runInNewContext(`(() => { ${source[0]} return NIMBO_DESK; })()`);

test('safe footprint matches actual tabletop plus clearance for Nimbo and arms', () => {
  // Visual desk geometry: 26 x 12.5 at x=0,z=-1.2, upper surface around y=0.
  for (const [x,z] of [[0,-1.2],[13,-1.2],[-13,-1.2],[0,5.05],[0,-7.45]])
    assert.equal(desk.over(x,z),true,`desk surface ${x},${z} must be protected`);
  for (const [x,z] of [[20,0],[0,12],[0,-15]])
    assert.equal(desk.over(x,z),false,`distant place ${x},${z} must not be forced upward`);
  assert.ok(desk.minimumY(false)>5.3, 'normal drone body, dangling arms and bob have generous clearance');
  assert.ok(desk.minimumY(true)>2, 'small drone has its own clearance');
});

test('swept segment catches fast motion THROUGH desk even if both endpoints are outside',()=>{
  assert.equal(desk.crosses(-80,-1.2,80,-1.2),true);
  assert.equal(desk.crosses(0,-30,0,40),true);
  assert.equal(desk.crosses(-80,20,80,20),false);
  assert.equal(desk.crosses(20,-30,20,30),false);
  assert.equal(desk.crosses(0,0,0,0),true);
});

test('resting and following Nimbo never descend into desk and climb before entering it',()=>{
  assert.match(code,/w\.position\.set\(3\.8, 6\.2, 1\.1\)/,'spawn is safely over the tabletop');
  assert.match(code,/const targetY = overDesk \? Math\.max\(idleY, deskFloor/,'idle hover has a minimum');
  assert.match(code,/if \(deskCrossing && w\.position\.y < deskFloor\) \{\s*w\.position\.x = previousNimboX; w\.position\.z = previousNimboZ;/,'wait above desk before entering');
  assert.match(code,/const safeY = overDesk \? Math\.max\(desiredY, deskFloor \+ 0\.5\) : desiredY;/);
  assert.match(code,/w\.position\.x = solved\.x; w\.position\.z = solved\.z;\s*if \(inside && NIMBO_DESK\.over\(/,'guard runs after collision resolution');
  assert.match(code,/w\.position\.set\(3\.8, 6\.2 \+ Math\.sin\(t \* 1\.4\) \* 0\.3, 1\.1\)/,'return to case cannot sweep through the desk');
});

test('both public web layers reference the same refreshed engine version',()=>{
  const host=fs.readFileSync(path.join(__dirname,'../audio/index.html'),'utf8');
  const iframe=fs.readFileSync(path.join(__dirname,'../audio/maletin/index.html'),'utf8');
  assert.match(host,/maletin\/index\.html\?v=20261028nimbo3/);
  assert.match(iframe,/game-engine-v50\.js\?v=20261028nimbo3/);
  assert.doesNotMatch(host,/20261028flight2/);
  assert.doesNotMatch(iframe,/20261028flight2/);
});
