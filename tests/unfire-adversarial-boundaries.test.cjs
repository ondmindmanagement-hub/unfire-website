'use strict';

// A narrow, dependency-free adversarial test of the real host trust guard.
// This does not send messages, open network connections or modify the app.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'audio', 'index.html'), 'utf8');
const listener = /addEventListener\('message',e=>\{\s*if\s*\(\s*(e\.source\s*!==\s*fr\.contentWindow\s*\|\|\s*e\.origin\s*!==\s*location\.origin)\s*\)\s*return\s*;\s*const d=e\.data/;
const matches = [...html.matchAll(new RegExp(listener.source, 'g'))];

test('the real game host rejects messages before reading their commands', () => {
  assert.equal(matches.length, 1, 'Expected one reviewed, guarded game-host listener');
  const match = matches[0];
  assert.ok(match.index >= 0);
  assert.ok(match[0].indexOf('return;') < match[0].indexOf('const d=e.data'));
});

test('independent synthetic origin/source scenarios challenge the actual guard expression', () => {
  assert.equal(matches.length, 1, 'A changed guard requires security review');
  // Expression is captured by a restrictive regex from our own checked-in source.
  // This only evaluates the isolated boolean predicate, never a message handler.
  const reject = new Function('e', 'fr', 'location', 'return Boolean(' + matches[0][1] + ');');
  const trustedWindow = {};
  const otherWindow = {};
  const fr = { contentWindow: trustedWindow };
  const location = { origin: 'https://unfire.test' };
  const scenarios = [
    { name: 'same origin and exact iframe window', source: trustedWindow, origin: location.origin, shouldReject: false },
    { name: 'foreign origin using correct frame', source: trustedWindow, origin: 'https://other.invalid', shouldReject: true },
    { name: 'same origin from unrelated frame', source: otherWindow, origin: location.origin, shouldReject: true },
    { name: 'foreign origin and unrelated frame', source: otherWindow, origin: 'https://other.invalid', shouldReject: true },
    { name: 'missing origin', source: trustedWindow, origin: '', shouldReject: true },
    { name: 'lookalike subdomain', source: trustedWindow, origin: 'https://sub.unfire.test', shouldReject: true },
    { name: 'lookalike scheme', source: trustedWindow, origin: 'http://unfire.test', shouldReject: true }
  ];
  for (const scenario of scenarios) {
    const event = { source: scenario.source, origin: scenario.origin, data: { unfire: 1, buy: 'synthetic-test' } };
    assert.equal(reject(event, fr, location), scenario.shouldReject, scenario.name);
  }
});
