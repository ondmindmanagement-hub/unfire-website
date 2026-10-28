// Isolated Y2K visual-regression contract. Do not require paid services or GPU.
'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const cp=require('node:child_process');
const root=path.resolve(__dirname,'../..');
const game=path.join(root,'audio/maletin/game-engine-v50.js');
const s=fs.readFileSync(game,'utf8');
test('game engine parses and original authored posters are enabled',()=>{
 cp.execFileSync('node',['--check',game],{stdio:'pipe'});
 assert.doesNotMatch(s,/if \(false\) \{ const MM =/);
 assert.doesNotMatch(s,/if \(false\) \{ let sd = 3;/);
 assert.doesNotMatch(s,/if \(false\) PI2\(5, 7,/);
 assert.doesNotMatch(s,/if \(false\) P\(4, 5\.5,/);
});
test('original illustrated windows are enabled without unlicensed Earth video',()=>{
 assert.doesNotMatch(s,/if \(false\) mkWin\(/);
 assert.match(s,/mkWin\(30, RZ - 0\.15/);
 assert.match(s,/mkWin\(-RX \+ 0\.15/);
 assert.match(s,/mkWin\(RX - 0\.15/);
 assert.match(s,/if \(false\) \{ const vid = document.createElement\('video'\)/);
 assert.match(s,/if \(false\) \{ const surf = new THREE.Group/);
});
test('ceiling stars use one instanced draw and mobile limit',()=>{
 assert.doesNotMatch(s,/for \(let i = 0; i < 0; i\+\+\)/);
 assert.match(s,/InstancedMesh\(new THREE.PlaneGeometry\(1, 1\), STM, n\)/);
 assert.match(s,/LOWDEV \? 38 : 108/);
});
test('night sky and far world remain visible on elevated outdoor exploration',()=>{
 assert.match(s,/for \(let i = 0; i < 900; i\+\+\)/);
 assert.match(s,/aboveClouds = !!window.ATM_OUT && ROAMS.on && \(ROAMS.h \|\| 0\) > 320/);
 assert.match(s,/if \(skyM.map !== nextSkyMap\)/);
 assert.match(s,/discoverSpace = LOWDEV \? \(h >= 500 \|\| range >= 900\) : \(h >= 180 \|\| range >= 350\)/);
 assert.match(s,/if \(!out \|\| !discoverSpace\) return;/);
});
test('existing floating-screen videos exist and each has recorded attribution',()=>{
 const credits=JSON.parse(fs.readFileSync(path.join(root,'audio/media/credits.json'),'utf8'));
 for(const key of ['v_jelly','v_reef','v_steens','v_waves']){
   assert.ok(fs.statSync(path.join(root,'audio/media',key+'.mp4')).size>1000,key+' is absent');
   assert.ok(credits[key]?.lic && credits[key]?.src && credits[key]?.art,'attribution absent: '+key);
 }
});
