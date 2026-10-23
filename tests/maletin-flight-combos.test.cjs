// Flight combos: isolated deterministic input tests plus source/physics guards.
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const engine = fs.readFileSync(path.resolve(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');
new vm.Script(engine, { filename: 'game-engine-v50.js' });
const start = engine.indexOf('  const FLIGHT_TAPS = ');
const end = engine.indexOf('  const roamB = ', start);
assert(start > 0 && end > start, 'Flight combo state/functions must be declared once');
const src = engine.slice(start, end);
assert(!src.includes('setInterval(') && !src.includes('setTimeout('), 'Combos must not schedule repeated work');
let now = 2000, haptics = 0, particles = 0;
const messages = [];
const ROAMS = { on: true, mini: false, fly: true, h: 180, fl: 0, p: { x: 0, z: 0 }, k: {} };
const sandbox = {
  ROAMS, REC: { on: false }, performance: { now: () => now },
  window: { ATM_OUT: true, __SPRAY: () => { particles++; } },
  document: { getElementById: () => null },
  say: (msg) => messages.push(msg), hap: () => { haptics++; }
};
vm.runInNewContext(src + '\nthis.tapFlight = flightTap; this.resetFlightCombos = resetFlightCombos;', sandbox);
function press(dir, afterMs) { now += afterMs; sandbox.tapFlight(dir); }
press('down', 0);
assert.equal(ROAMS.slam, undefined, 'Single down retains normal descent');
press('down', 180);
assert.equal(ROAMS.slam, true, 'Double down starts hero landing');
assert.equal(ROAMS.boostT, 0, 'Landing cancels boost');
assert.equal(ROAMS.slamV, 280, 'Landing starts with strong downward speed');
press('up', 1200); press('up', 140); press('up', 140);
assert.equal(ROAMS.slam, false, 'Triple up cancels a pending dive');
assert(ROAMS.boostT > 0 && ROAMS.climbV >= 500, 'Triple up triggers strong upward impulse');
assert(particles > 0 && haptics > 0 && messages.length === 2, 'Effects occur at activation only');
sandbox.resetFlightCombos();
ROAMS.boostT = 0; ROAMS.fly = true;
press('up', 800); press('up', 500); press('up', 500);
assert.equal(ROAMS.boostT, 0, 'Slow presses do not trigger triple tap');
sandbox.resetFlightCombos();
ROAMS.mini = true;
press('down', 10); press('down', 120);
assert.equal(ROAMS.slam, false, 'Robot mini mode does not trigger flight combos');
ROAMS.mini = false; ROAMS.fly = false;
sandbox.resetFlightCombos();
press('down', 200); press('down', 130);
assert.equal(ROAMS.slam, false, 'Ground descent cannot trigger landing');
assert(engine.includes("flightTap('down'); ROAMS.k.s = 1"), 'Touch down preserves regular hold input');
assert(engine.includes("flightTap('up'); if (ROAMS.board"), 'Touch up preserves existing surf logic');
assert(engine.includes("!e.repeat && (k === 'ArrowDown' || k === 'ArrowUp')"), 'Keyboard ignores repeats');
assert(engine.includes("if (ROAMS.slam && ROAMS.fly && !ROAMS.mini)"), 'Physics handles active slam');
assert(engine.includes('ROAMS.h + ROAMS.vy * dt <= fl + 0.02'), 'Landing checks next frame against real floor');
assert(engine.includes('ROAMS.h = fl; ROAMS.vy = 0; ROAMS.slam = false;'), 'Landing clamps to floor without tunneling');
assert(engine.includes('ROAMS.boostT > 0 ? (window.ATM_OUT ? 500 : 38)'), 'Boost overrides ordinary climb temporarily');
assert(engine.includes("settingsHud.insertBefore(guideButton"), 'Settings contains control guide entry');
assert(engine.includes("aria-label', 'Guía de controles'"), 'Guide has accessible dialog label');
assert(engine.includes('El aterrizaje respeta el suelo y las plataformas'), 'Guide explains safe landing');
console.log('PASS: flight combos, timing, cooldown, keyboard/touch, landing bounds and settings guide.');
