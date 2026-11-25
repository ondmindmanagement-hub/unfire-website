'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
const {render}=require('./host-integration-preview.cjs');
const source=(
 '<html><head><title>Game</title></head><body>\n'+
 '<iframe id="malFrame"></iframe>\n'+
 'const enterGame=()=>{\n'+
 'try{fr.contentWindow.postMessage({unfire:1,entryStart:true,vis:true},location.origin);}catch(_){}\n'+
 '};const resumeGame=()=>{\n'+
 'try{fr.contentWindow.postMessage({unfire:1,vis:true,entryResume:true},location.origin);}catch(e){}\n'+
 '};function exitGame(){\n    caseLocal=false;webReturn=true;parked=1;\n}\n'+
 '</body></html>'
);
test('creates only two staged script tags and exactly 3 lifecycle hooks',()=>{
 const out=render(source);
 assert.equal((out.match(/analytics\/game-play\/collector\.js/g)||[]).length,1);
 assert.equal((out.match(/analytics\/game-play\/loader\.js/g)||[]).length,1);
 assert.equal((out.match(/UnfirePlayMetrics\?\.start\(\)/g)||[]).length,2);
 assert.equal((out.match(/UnfirePlayMetrics\?\.end\(\)/g)||[]).length,1);
 assert.ok(out.includes('const enterGame=()=>'));
 assert.ok(out.includes('function exitGame(){'));
});
test('no external vendor URL, account identifier, gate bypass or credential',()=>{
 const out=render(source);
 assert.doesNotMatch(out,/cloud\.umami\.is|website-id|__UNFIRE_ANALYTICS_APPROVED\s*=\s*true/);
});
test('refuses duplicates and upstream host changes',()=>{
 const out=render(source);
 assert.throws(()=>render(out),/already integrated/);
 assert.throws(()=>render(source.replace('entryStart:true','entryStart:false')),/contract mismatch/);
 assert.throws(()=>render(source.replace('malFrame','wrongFrame')),/Unrecognized/);
});
test('reads only; source bytes stay unchanged',()=>{
 const old=source.slice();
 render(source);
 assert.equal(source,old);
});
