'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('audio/maletin/game-engine-v50.js','utf8');
const all=Array.from({length:20},(_,i)=>i);
function countUnlocked(progress,proof){
 const start=src.indexOf('const unl = () =>'),end=src.indexOf('; let TYPES =',start);
 assert.ok(start>0 && end>start);
 const source=src.slice(start,end+1);
 const ctx={ALLT:all,ROSTER_TOTAL:20,ROSTER_NORMAL_MAX:12,rosterProofValid:()=>!!proof,
   localStorage:{getItem:()=>progress}};
 return vm.runInNewContext('('+source.replace(/^const unl = /,'').replace(/;$/,'')+')()',ctx);
}
test('missions unlock at most twelve of twenty even with legacy progress 99',()=>{
 for(const [progress,total] of [[0,2],[1,3],[9,11],[10,12],[99,12],[1000,12]])
   assert.equal(countUnlocked(progress,false),total);
 assert.equal(countUnlocked(0,true),20);
 assert.equal(countUnlocked(99,true),20);
});
test('all ordinary reward paths stop at 12 and completion does not grant 20',()=>{
 assert.match(src,/window\.__REWARD = \(why\) =>/);
 assert.match(src,/Math\.min\(10,\(Number\(localStorage\.getItem\('unfire_unlock'\)\)/);
 assert.match(src,/localStorage\.setItem\('unfire_unlock', '10'\)/);
 assert.doesNotMatch(src,/localStorage\.setItem\('unfire_unlock', '99'\)/);
 assert.doesNotMatch(src,/localStorage\.setItem\('unfire_unlock',String\(Math\.max\(current,20\)\)\)/);
});
test('private code is never embedded in public source as clear text',()=>{
 assert.match(src,/const ROSTER_FINGERPRINT='[a-f0-9]{64}'/);
 assert.match(src,/const ROSTER_SALT='[a-f0-9]{32}'/);
 assert.match(src,/crypto\.subtle\.digest\('SHA-256',bytes\)/);
 assert.match(src,/ROSTER_PROOF_KEY='unfire_roster_proof_v2'/);
 assert.doesNotMatch(src,/ULTIMATEROBOTS/);
 assert.doesNotMatch(src,/unfire_secret_robots/);
 assert.match(src,/fld\.value='';button\.disabled=false/);
});
test('only unlocked models can be selected and the remaining eight are excluded from normal navigation',()=>{
 assert.match(src,/ALLT\.slice\(0,total\)\.includes\(cfg\.type\)/);
 assert.match(src,/cfg\.type=ALLT\[\(at\+step\+total\)%total\]/);
 assert.match(src,/const total=Math\.max\(1,Math\.min\(ALLT\.length,unl\(\)\)\)/);
 assert.match(src,/if\(!ALLT\.slice\(0,unl\(\)\)\.includes\(cfg\.type\)\)cfg\.type=ALLT\[0\]/);
 assert.match(src,/const ALLT = \[4, 1, 7, 10, 13, 16, 2, 5, 8, 11, 14, 17, 3, 6, 9, 12, 15, 18, 0, 19\]/);
});
