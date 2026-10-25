'use strict';
// Water locomotion regression: ocean movement must glide, not play walking steps.
// Static guard for the existing engine contract; gameplay still needs device QA.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const engine = fs.readFileSync(
  path.join(__dirname, '..', 'audio', 'maletin', 'game-engine-v50.js'),
  'utf8'
);
const avatar = engine.match(/GS\.foot\(AV,[^\n]*AV\.r0\.update\(3\.7, dt, \{[^\n]*mood:/);
assert.ok(avatar, 'Avatar audio + animation updates must exist in the engine');
assert.match(avatar[0], /ROAMS\.wet \|\| !ROAMS\.moving \? null/,
  'Gliding across water must not emit walking footsteps');
assert.match(avatar[0], /ROAMS\.wet \? null : ROAMS\.moving/,
  'Gliding on water must not use walk or run animation');
assert.match(avatar[0], /ROAMS\.run \? 'run' : 'walk'/,
  'Walking and running on land must remain enabled');
assert.match(avatar[0], /ROAMS\.air && !ROAMS\.wet \? 'fly'/,
  'Airborne flight must remain enabled');
assert.match(engine, /const surf = !!\(window\.ATM_OUT && ROAMS\.wet && !ROAMS\.fly && ROAMS\.board\)/,
  'Optional surfboard/trick mode must remain unchanged');
assert.match(engine, /ROAMS\.wet = !!window\.ATM_OUT && !\(window\.__LAND/,
  'Water/land detection must remain enabled');
console.log('PASS: water glide without footsteps; land walk, flight and surfboard preserved');
