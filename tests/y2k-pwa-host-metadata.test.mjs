import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const host = readFileSync(path.join(root, 'audio/index.html'), 'utf8');
const worker = readFileSync(path.join(root, 'audio/y2k-service-worker.js'), 'utf8');
const register = readFileSync(path.join(root,'audio/js/y2k-pwa-register.js'), 'utf8');
const manifest = JSON.parse(readFileSync(path.join(root, 'audio/game.webmanifest'), 'utf8'));
const matches = (text, pattern) => Array.from(text.matchAll(pattern)).length;

test('host includes exactly one deferred PWA entrypoint and keeps original game navigation', () => {
  assert.equal(matches(host, /<script defer src="\/audio\/js\/y2k-pwa-register\.js"><\/script>/g), 1);
  assert.equal(matches(host, /<link rel="manifest" href="game\.webmanifest">/g), 1);
  assert.match(host, /<link rel="canonical" href="https:\/\/unfire\.technology\/audio\/"/);
  assert.ok(!host.includes('skipWaiting('));
  assert.ok(!host.includes('clients.claim('));
  assert.equal(manifest.id, '/audio/');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
});

test('selected brand in title, mobile, social cards and structured data', () => {
  assert.match(host, /<meta name="apple-mobile-web-app-title" content="Y2K ROBOTS">/);
  assert.match(host, /<title>Y2K ROBOTS \| Free 3D Robot Adventure<\/title>/);
  assert.match(host, /<meta property="og:title" content="Y2K ROBOTS \| Free 3D Robot Adventure">/);
  assert.match(host, /<meta name="twitter:title" content="Y2K ROBOTS \| Free 3D Robot Adventure">/);
  assert.match(host, /"@type":"VideoGame","name":"Y2K ROBOTS"/);
  assert.equal(manifest.name, 'Y2K ROBOTS');
});

test('host registration is an opt-in, network-only service worker and never caches music', () => {
  assert.match(register, /window\.addEventListener\('load', register/);
  assert.match(register, /hostname === 'unfire\.technology'/);
  assert.match(worker, /event\.respondWith\(fetch\(request\)\)/);
  assert.doesNotMatch(worker.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,''), /\bcaches\s*\.|\bskipWaiting\(/);
});
