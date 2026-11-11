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

assert.equal(Q.network({}, 0.7).kind, 'constrained');
assert.equal(Q.network({}, 2.7).kind, 'moderate');
assert.equal(Q.network({}, 9).kind, 'good');
assert.equal(Q.network({ connection: { effectiveType: '4g' } }, 0.8).kind, 'constrained');
assert.equal(Q.network({ connection: { effectiveType: '2g' } }, 30).kind, 'constrained');
assert.equal(Q.network({ connection: { saveData: true } }, 80).kind, 'constrained');
assert.equal(make({ hardwareConcurrency: 12, deviceMemory: 8 }, { observedMbps: 0.9 }).render, 'high'); // network != GPU
assert.equal(make({}, { observedMbps: 0.9 }).assetPolicy, 'on-demand');
const item = (i, bytes = 100000, interval = 300) => ({
  name: 'https://unfire.technology/audio/img/frame' + i + '.webp',
  transferSize: bytes, responseStart: 5000 + i * 500,
  responseEnd: 5000 + i * 500 + interval
});
const sample = (items) => ({ location: { origin: 'https://unfire.technology' },
  performance: { now: () => 30000, getEntriesByType: () => items } });
assert.equal(Q.estimateResourceMbps(sample([item(1), item(2)])), null); // too few samples
assert.ok(Q.estimateResourceMbps(sample([item(1), item(2), item(3)])) > 2);
assert.equal(Q.capture({ ...sample([item(1), item(2), item(3)]), navigator: {} }).network, 'moderate');
assert.equal(Q.estimateResourceMbps(sample([item(1, 0), item(2, 0), item(3, 0)])), null); // cached data ignored
assert.equal(Q.estimateResourceMbps(sample([item(1), { ...item(2), name: 'https://evil.test/asset' }, item(3)])), null); // origin isolation
assert.equal(Q.estimateResourceMbps(sample([item(1), { ...item(2), responseEnd: 1000 }, item(3)])), null); // invalid timing
assert.equal(Q.estimateResourceMbps(sample([item(1), item(2), item(3)].map(e=>({ ...e, responseEnd:e.responseStart+100000 })))), null); // invalid durations
assert.equal(Q.estimateResourceMbps({}), null); // APIs missing
console.log('PASS 32 passive client-quality policy assertions');

