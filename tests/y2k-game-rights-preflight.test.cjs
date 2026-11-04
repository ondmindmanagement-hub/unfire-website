'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {check,REQUIRED}=require('../scripts/y2k-game-rights-preflight.cjs');
const actual=JSON.parse(fs.readFileSync(path.join(__dirname,'../.github/y2k-game-rights-release.json'),'utf8'));
const clone=v=>JSON.parse(JSON.stringify(v));
const fakeEvidence='https://example.invalid/review-evidence/123';
test('current real decision is blocked, structurally valid',()=>{
 assert.equal(actual.release_authorized,false);
 assert.deepEqual(check(actual,'audit'),[]);
 assert.ok(check(actual,'release').some(s=>s.includes('not yet legally cleared')));
});
test('cannot claim release while any required rights gate is blocked',()=>{
 const x=clone(actual);x.release_authorized=true;x.release_reviewer='Authorized reviewer';x.release_reviewed_utc='2026-11-04';
 const errors=check(x,'release');
 assert.ok(errors.some(s=>s.includes('while gate blocked')));
});
test('missing one required gate fails even in audit mode',()=>{
 const x=clone(actual);delete x.checks[REQUIRED[0]];
 assert.ok(check(x,'audit').some(s=>s.includes('missing required gate')));
});
test('a claimed verified gate needs evidence references and date',()=>{
 const x=clone(actual);x.checks[REQUIRED[0]].status='verified';
 const errors=check(x,'audit');
 assert.ok(errors.some(s=>s.includes('lacks adequate evidence')));
 assert.ok(errors.some(s=>s.includes('lacks review date')));
});
test('synthetic fully documented fixture passes structural checks only',()=>{
 const x=clone(actual);
 for(const k of REQUIRED)x.checks[k]={status:'verified',evidence:[fakeEvidence],reviewed_utc:'2026-11-04'};
 x.release_authorized=true;x.release_reviewer='Independent legal and release reviewer';x.release_reviewed_utc='2026-11-04';
 assert.deepEqual(check(x,'release'),[]);
 assert.equal(actual.release_authorized,false,'the real JSON is unaffected by this synthetic fixture');
});
