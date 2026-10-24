'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');
const found = source.match(/function softwareWebGL\(renderer\) \{[\s\S]*?\n  \}/);
assert.ok(found, 'software renderer detection is part of the real engine');
const detect = vm.runInNewContext(found[0] + '\nsoftwareWebGL;', {});
function renderer(name, supported = true) {
  const gl = {
    RENDERER: 1,
    getExtension: () => supported ? { UNMASKED_RENDERER_WEBGL: 2 } : null,
    getParameter: (parameter) => parameter === 2 ? name : (supported ? 'WebKit WebGL' : name)
  };
  return { getContext: () => gl };
}
test('software GPU detection uses the renderer, never browser or OS strings', () => {
  for (const name of [
    'WebKit WebGL (Google SwiftShader)',
    'ANGLE (Google, Vulkan 1.3, SwiftShader Device (LLVM 10))',
    'llvmpipe (LLVM 17.0.6)',
    'Mesa Offscreen',
    'Lavapipe Mesa'
  ]) assert.equal(detect(renderer(name)), true, name);
  for (const name of [
    'ANGLE (Apple, Apple M3 Pro, OpenGL)',
    'ANGLE (NVIDIA GeForce RTX 4070, Vulkan)',
    'AMD Radeon Pro',
    'Intel Iris Xe'
  ]) assert.equal(detect(renderer(name)), false, name);
  assert.equal(detect(renderer('WebKit WebGL', false)), false);
  assert.equal(detect({ getContext() { throw new Error('context lost'); } }), false);
});
test('real software GPUs get a lower draw budget without changing controls and missions', () => {
  assert.match(source, /if \(softwareWebGL\(S\.renderer\)\) \{\s*LOWDEV = true;/);
  assert.match(source, /DEVICE\.maxDpr = Math\.min\(DEVICE\.maxDpr, 0\.60\)/);
  assert.match(source, /S\.renderer\.setPixelRatio\(Math\.min\(S\.renderer\.getPixelRatio\(\), DEVICE\.maxDpr\)\)/);
  assert.match(source, /if \(LOWDEV\) \{ S\.renderer\.shadowMap\.enabled = false;/);
  assert.match(source, /if \(previousRenderAt && now - previousRenderAt < \(LOWDEV/);
  assert.match(source, /ROAMS\.mini \? NANO_SCALE : 1/);
  assert.match(source, /window\.UNFIRE_COINS\.tick\(dt,t\)/);
  assert.match(source, /MAP\.expandedOpen/);
  assert.match(source, /if \(MAP\.expandedOpen \|\| \(window\.UNFIRE_COINS && window\.UNFIRE_COINS\.isOpen\)\)/,
    'the actual 3D loop must stop rendering while offline shop is open');
});
