// Y2K visual and media recovery contract: lightweight, no GPU or paid network.
'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const game=path.join(root,'audio/maletin/game-engine-v50.js'),index=path.join(root,'audio/maletin/index.html');
const s=fs.readFileSync(game,'utf8'),html=fs.readFileSync(index,'utf8');
test('reconciled engine parses, original room retains separate nonoverlapping ROOMC v2',()=>{
 cp.execFileSync('node',['--check',game],{stdio:'pipe'});
 assert.match(s,/window\.__RC = ROOMC\(/);
 assert.match(html,/window\.ROOMC = function/);
 assert.match(s,/if \(false\) \{ const MM =/); // prevent old duplicate poster layer
 assert.match(s,/if \(false\) PI2\(5, 7,/); // prevent original duplicate wall artwork
 assert.match(s,/if \(false\) mkWin\(/); // do not overlay videos with old windows
});
test('ceiling star original material restored via GPU instancing',()=>{
 assert.doesNotMatch(s,/for \(let i = 0; i < 0; i\+\+\)/);
 assert.match(s,/InstancedMesh\(new THREE.PlaneGeometry\(1, 1\), STM, n\)/);
 assert.match(s,/LOWDEV \? 38 : 108/);
});
test('real shader-based sky reveals starry space during attainable flight',()=>{
 assert.match(html,/milky = img\('s_milky.jpg'\)/);
 assert.match(html,/smoothstep\(330.0, 950.0, alt\)/);
 assert.match(html,/smoothstep\(700.0, 1550.0, alt\)/);
 assert.match(html,/D\.sky\.material = skyMat/);
});
test('far outside landscape builds earlier but stays lazy and mobile budgeted',()=>{
 assert.match(s,/discoverSpace = LOWDEV \? \(h >= 500 \|\| range >= 900\) : \(h >= 180 \|\| range >= 350\)/);
 assert.match(s,/if \(!out \|\| !discoverSpace\) return;/);
});
test('ROOMC original video windows and credited photo assets present',()=>{
 for(const key of ['v_reef','v_jelly','v_steens','v_waves']) assert.match(html,new RegExp('vid\\(\\\''+key+'\\.mp4\\\'\\)'));
 assert.match(html,/s_milky_w.jpg/);
 assert.match(html,/a_jupiter_w.jpg/);
 const credits=JSON.parse(fs.readFileSync(path.join(root,'audio/media/credits.json'),'utf8'));
 for(const key of ['v_jelly','v_reef','v_steens','v_waves']){
   assert.ok(fs.statSync(path.join(root,'audio/media',key+'.mp4')).size>1000);
   assert.ok(credits[key]?.lic && credits[key]?.src && credits[key]?.art);
 }
 for(const f of ['s_milky.jpg','s_milky_w.jpg','a_jupiter.jpg','a_jupiter_w.jpg']){
   assert.ok(fs.statSync(path.join(root,'audio/media',f)).size>1000);
 }
});
