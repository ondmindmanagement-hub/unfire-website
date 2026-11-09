'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const host=fs.readFileSync('audio/index.html','utf8');
const frame=fs.readFileSync('audio/maletin/index.html','utf8');
const engine=fs.readFileSync('audio/maletin/game-engine-v50.js','utf8');
const collect=(source,pattern)=>[...source.matchAll(pattern)].map(match=>match[1]);
test('one fresh cache token for host iframe, fallback and both engine loads',()=>{
  const hostVersions=collect(host,/maletin\/index\.html\?v=([a-zA-Z0-9_-]+)/g);
  const engineVersions=collect(frame,/game-engine-v50\.js\?v=([a-zA-Z0-9_-]+)/g);
  assert.equal(hostVersions.length,2);
  assert.equal(engineVersions.length,2);
  assert.equal(new Set(hostVersions).size,1);
  assert.equal(new Set(engineVersions).size,1);
  assert.equal(hostVersions[0],engineVersions[0]);
  // Pin the shape (dated token) and reject retired tokens, instead of a single stale value.
  assert.match(hostVersions[0],/^2026\d{4}[a-z0-9]+$/);
  for (const retired of ['20261028nimbo3english4','20261104hudmatch4','20261108smoothfly1','20261108mobilelite1','20261109flightpace1','20261109steadyfly1','20261109snowsoft1','20261109snowall1']) assert.notEqual(hostVersions[0],retired);
});
test('the actual canvas accepts tap without browser scroll cancellation',()=>{
  assert.match(frame,/#cv\s*\{[^}]*touch-action:none/);
  assert.match(engine,/activeTouchPointers/);
  assert.match(engine,/pointercancel/);
  assert.match(engine,/resetTapPointers/);
});
test('the procedural lid uses foreground wall time while game physics stays bounded',()=>{
  assert.match(engine,/const foregroundFrameTime = previousRenderAt/);
  assert.match(engine,/const actualFrameTime = Math.min\(0\.18, foregroundFrameTime\)/);
  assert.match(engine,/lidMotion\.elapsed=Math\.min\(lidMotion\.duration,lidMotion\.elapsed\+foregroundFrameTime\)/);
});
