'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const engine = fs.readFileSync(
  path.join(__dirname, '..', 'audio', 'maletin', 'game-engine-v50.js'), 'utf8'
);
function extract(pattern, label) {
  const match = engine.match(pattern);
  assert.ok(match, label + ' was not found in the actual engine source');
  return match[1];
}
const walkFormula = extract(/const walkDt = ([^;]+);/, 'movement elapsed-time formula');
const climbFormula = extract(
  /(ROAMS\.climbV = K\[' '\] \? [^;]+); \/\/ Vertical thrust/,
  'vertical flight controls'
);
function flyForTwoSeconds(hz) {
  const elapsed = 1 / hz;
  const samples = 2 * hz;
  const walk = new Function('ROAMS', 'dt', 'foregroundFrameTime', 'window',
    'return (' + walkFormula + ');');
  const climb = new Function('ROAMS', 'K', 'window', 'dt', 'flightDt',
    climbFormula + ';');
  const roams = {fly:true,climbV:0,perkF:1,mini:false};
  const keys = {' ':true};
  const globals = {ATM_OUT:true,__dts:1};
  let horizontal = 0, height = 22, targetHeight = 22;
  for (let i = 0; i < samples; i++) {
    const dt = Math.min(0.05, elapsed);
    const frameDt = walk(roams,dt,elapsed,globals);
    const flightDt = roams.fly ? frameDt : dt;
    climb(roams,keys,globals,dt,flightDt);
    horizontal += 250 * flightDt;
    targetHeight += roams.climbV * flightDt;
    const velocity = Math.min(650,(targetHeight-height)*6);
    height += velocity*flightDt;
  }
  return {horizontal,height};
}

test('flight integrates elapsed foreground time, even when GPU frames drop', () => {
  assert.match(engine, /const flightDt = ROAMS\.fly \? walkDt : dt;/);
  const reference = flyForTwoSeconds(60);
  for (const hz of [60,30,15,10]) {
    const flight = flyForTwoSeconds(hz);
    assert.ok(Math.abs(flight.horizontal - 500) < 0.01,
      hz+'Hz horizontal: '+flight.horizontal+' vs expected 500');
    assert.ok(Math.abs(flight.height/reference.height-1) < 0.2,
      hz+'Hz vertical: '+flight.height+' vs 60Hz '+reference.height);
  }
});

test('high-speed travel retains swept NANO collisions and bounded delta', () => {
  assert.match(engine,/function roamMoveSmooth\(f, side, elapsed\)/);
  assert.match(engine,/Math\.min\(3,Math\.ceil\(elapsed\/0\.045\)\)/);
  assert.match(engine,/NANO_PHYSICS\.move2D/);
  assert.match(engine,/Math\.min\(0\.10, foregroundFrameTime\)/);
  assert.match(engine,/ROAMS\.h \+= ROAMS\.vy \* \(ROAMS\.fly \? flightDt : dt\)/);
  assert.equal((engine.match(/1 - Math\.exp\(-3\.2 \* flightDt\)/g)||[]).length,2,
    'third-person and first-person flight speed smoothing must be frame-consistent');
});

test('higher flight FPS is conditional; slow devices and hidden tabs retain protection', () => {
  assert.match(engine,/window\.ATM_OUT \? \(ROAMS\.fly \? 15 : 33\) : 25/);
  assert.match(engine,/LOWDEV \? \(DEVICE\.tier==='compact' \? \(!DEVICE\.touch && \(navigator\.hardwareConcurrency\|\|4\)>=6 \? 30 : 42\) : 33\)/);
  assert.match(engine,/SOFTWARE_WEBGL && previousRenderAt && now - previousRenderAt < 80/);
  assert.match(engine,/window\.ATM_OUT\?\(ROAMS\.fly\?1\/50:1\/30\):1\/35/);
  assert.match(engine,/if \(document\.hidden \|\| !frameVisible\)/);
  assert.match(engine,/if \(settingsHudOpen\)/);
});


test('compact pacing upgrades only capable non-touch browsers, preserving mobile/slow guards', () => {
  const pacingExpression = extract(
    /previousRenderAt < \((.+)\)\) return;/,
    'outdoor and compact render interval expression'
  );
  const pace = new Function('LOWDEV','DEVICE','navigator','window','ROAMS',
    'return (' + pacingExpression + ');'
  );
  const evalPacing = (tier, touch, cores, lowDev = true, outside = true, flying = true) =>
    pace(lowDev, {tier,touch}, {hardwareConcurrency:cores}, {ATM_OUT:outside}, {fly:flying});
  assert.equal(evalPacing('compact',false,12),30,'fast non-touch compact can render at 30ms');
  assert.equal(evalPacing('compact',false,6),30,'six-core non-touch compact can render at 30ms');
  assert.equal(evalPacing('compact',true,12),42,'touch hardware retains thermal budget');
  assert.equal(evalPacing('compact',true,4),42,'low-core touch retains 42ms');
  assert.equal(evalPacing('compact',false,4),42,'low-core desktop retains 42ms');
  assert.equal(evalPacing('balanced',false,12),33,'balanced device unchanged');
  assert.equal(evalPacing('desktop',false,12,false,true,true),15,
    'capable outdoor flying retains 15ms pacing');
  assert.equal(evalPacing('desktop',false,12,false,true,false),33,
    'capable outdoor walking retains 33ms pacing');
  assert.equal(evalPacing('desktop',false,12,false,false,false),25,
    'interior pacing unchanged');
  assert.match(engine,/SOFTWARE_WEBGL && previousRenderAt && now - previousRenderAt < 80/,
    'software driver slow path remains a separate leading guard');
});
