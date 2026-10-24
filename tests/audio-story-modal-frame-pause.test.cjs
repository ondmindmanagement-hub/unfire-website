'use strict';
// The story menu is opaque: don't run GPU workloads beneath it.
// Static contract plus evaluation of the exact predicate from production.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const src = fs.readFileSync(path.join(__dirname, '../audio/maletin/game-engine-v50.js'),'utf8');
const begin = src.indexOf('  function frame(now) {');
const end = src.indexOf('    // Cap this heavy 3D scene',begin);
assert.ok(begin>0 && end>begin,'Existing animation loop and cap are unchanged');
const frame=src.slice(begin,end);
const predicate=frame.match(/const storyMenuOpen = ([^;]+);\s*if \(([^\n]+)\) \{/);
assert.ok(predicate,'Story menu pause is integrated into original overlay branch');
assert.match(predicate[1], /getElementById\('storyMenu'\)\?\.style\.display === 'block'/);
assert.match(predicate[2], /MAP\.expandedOpen/);
assert.match(predicate[2], /UNFIRE_COINS/);
assert.match(predicate[2], /\|\| storyMenuOpen/);
assert.match(frame, /clock\.getDelta\(\)/);
assert.match(frame, /previousRenderAt = 0/);
assert.match(frame, /adaptivePerf\.since=0/);
assert.match(frame, /if \(MAP\.expandedOpen\) MAP\.tick\(\)/);
assert.doesNotMatch(frame, /setInterval/);
const check=(style, map, coins)=>{
  const node=style==null?null:{style:{display:style}};
  const context={document:{getElementById:(id)=>id==='storyMenu'?node:null},
    MAP:{expandedOpen:map},window:{UNFIRE_COINS:coins?{isOpen:true}:undefined}};
  return vm.runInNewContext('const storyMenuOpen = '+predicate[1]+'; !!('+predicate[2]+')',context,{timeout:1000});
};
assert.equal(check('block',false,false),true,'Opaque story modal pauses WebGL');
assert.equal(check('none',false,false),false,'Closing story modal resumes');
assert.equal(check(null,false,false),false,'Optional story DOM missing is safe');
assert.equal(check('none',true,false),true,'World map still pauses');
assert.equal(check('none',false,true),true,'Offline shop still pauses');
assert.match(src,/S\.renderer\.render\(S\.scene, cam\)/,'Original rendering path is preserved');
console.log('PASS: 5 overlay state transitions, paused GPU while story menu is open');
