'use strict';
// Isolated static + runtime-expression contracts for the secondary WebGL renderer.
// Does not instantiate WebGL; browser/device QA remains a release gate.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../audio/maletin/index.html'), 'utf8');
const signature = '  function createStage(canvas) {';
const begin = html.indexOf(signature);
assert.ok(begin >= 0, 'Secondary WebGL createStage exists');
assert.equal(html.indexOf(signature, begin + 1), -1, 'Only one createStage declaration');
const end = html.indexOf('\n  return { finishMaterial', begin);
assert.ok(end > begin, 'Stage is isolated within its owning helper');
const block = html.slice(begin, end);

assert.match(html.slice(0, begin), /window\.__UNFIRE_AUTOCALIB=detect\(\)/);
assert.match(block, /const stageBudget = window\.__UNFIRE_AUTOCALIB/);
assert.match(block, /antialias: !stageCompact/);
assert.match(block, /powerPreference: stageCompact \? 'default' : 'high-performance'/);
assert.match(block, /renderer\.shadowMap\.enabled = !stageCompact/);
assert.match(block, /renderer\.setPixelRatio\(stageDpr\)/);
assert.doesNotMatch(block, /setPixelRatio\(Math\.min\(2/);
assert.match(block, /key\.castShadow = !stageCompact/);
assert.match(block, /key\.shadow\.mapSize\.set\(stageShadowMapSize, stageShadowMapSize\)/);
assert.doesNotMatch(block, /setTimeout|setInterval|requestAnimationFrame/);

// Execute the EXACT five budget expressions copied from production code; the
// assertions will fail if a profile refactor changes its runtime contract.
const expr = block.match(/^\s*const stage(?:Budget|Compact|Balanced|Dpr|ShadowMapSize) = .*;$/gm) || [];
assert.equal(expr.length, 5, 'All five budget definitions are unique');
const runBudget = (device, dpr) => vm.runInNewContext(
  expr.join('\n') + '\n({stageCompact,stageBalanced,stageDpr,stageShadowMapSize})',
  {window: {devicePixelRatio:dpr, __UNFIRE_AUTOCALIB:device}}, {timeout:1000}
);
for (const [profile, dpr, expectedDpr, expectedShadow] of [
  [{tier:'compact', maxDpr:0.8}, 3, 0.8, 512],
  [{tier:'balanced', maxDpr:1}, 3, 1, 1024],
  [{tier:'desktop', maxDpr:1.5}, 3, 1.5, 2048],
  [undefined, 3, 1.5, 2048],
  [{tier:'compact', maxDpr:0.8}, 0.5, 0.5, 512],
]) {
  const got=runBudget(profile,dpr);
  assert.equal(got.stageDpr, expectedDpr);
  assert.equal(got.stageShadowMapSize, expectedShadow);
  assert.equal(got.stageCompact, (profile?.tier||'desktop')==='compact');
  assert.equal(got.stageBalanced, (profile?.tier||'desktop')==='balanced');
}
assert.match(html, /game-engine-v50\.js\?v=/, 'Main game engine still included');
console.log('PASS: secondary stage budget, unchanged main engine, 5 device profiles');
