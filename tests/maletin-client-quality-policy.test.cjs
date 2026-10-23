'use strict';
const assert = require('node:assert/strict');
const Q = require('../audio/maletin/client-quality-policy.js');
const make = (nav = {}, extra = {}) => Q.profile({ navigator: nav, dpr: 3, ...extra });
assert.deepEqual(Q.network({}), { kind: 'unknown', known: false, saveData: false });
assert.equal(make({ hardwareConcurrency: 2 }).render, 'economy');
assert.equal(make({ hardwareConcurrency: 12, deviceMemory: 8 }).render, 'high');
assert.equal(make({ hardwareConcurrency: 12, deviceMemory: 8 }, { stableFps: 36 }).render, 'economy');
assert.equal(make({ hardwareConcurrency: 12, deviceMemory: 8 }, { stableFps: 48 }).render, 'balanced');
assert.equal(make({ connection: { effectiveType: '3g' } }).assetPolicy, 'on-demand');
assert.equal(make({ connection: { downlink: 0.7, rtt: 100 } }).allowLargePreloads, false);
assert.equal(make({ connection: { saveData: true, effectiveType: '4g' } }).saveData, true);
assert.equal(make({ onLine: false, connection: { effectiveType: '4g' } }).assetPolicy, 'on-demand');
assert.equal(make({ hardwareConcurrency: 12, deviceMemory: 8, connection: { effectiveType: '3g' } }).render, 'high');
assert.equal(make({}).assetPolicy, 'essential-first'); // Safari network API absent: no invented Wi-Fi quality
assert.equal(make({}, { reducedMotion: true }).reducedMotion, true);
assert.ok(make({}).maxDpr <= 1.65);
let changeCb;
const connection = { effectiveType: '4g', addEventListener: (type, fn) => { changeCb = fn; }, removeEventListener: () => {} };
const fake = { navigator: { connection }, devicePixelRatio: 2,
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  addEventListener() {}, removeEventListener() {} };
let events = 0, last = null;
const dispose = Q.observe(p => { events++; last = p; }, fake);
assert.equal(events, 1);
changeCb();
assert.equal(events, 1); // no duplicate emission
connection.effectiveType = '3g';
changeCb();
assert.equal(events, 2);
assert.equal(last.assetPolicy, 'on-demand');
dispose();
console.log('PASS 16 passive client-quality policy assertions');
