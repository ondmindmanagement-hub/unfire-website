'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const engine=fs.readFileSync('audio/maletin/game-engine-v50.js','utf8');
test('indoor walking is not artificially slowed and accounts for dropped frames',()=>{
 assert.match(engine,/window\.ATM_OUT \? 1\.55 : 1\.0/);
 assert.match(engine,/const walkDt = ROAMS\.fly \? dt : Math\.min\(0\.10, foregroundFrameTime\)/);
 assert.match(engine,/roamMoveSmooth\(walkDt \* ROAMS\.vvS/);
 assert.match(engine,/roamMoveSmooth\(fw \* walkDt \* ROAMS\.vvS/);
 assert.match(engine,/const cameraDt=Math\.min\(0\.10,foregroundFrameTime\)/);
 assert.match(engine,/ROAMS\.cp\.lerp\(want, 1 - Math\.exp\(-rate \* cameraDt\)\)/);
});
test('walking collision substeps preserve displacement in a slow frame',()=>{
 const start=engine.indexOf('function roamMoveSmooth('), end=engine.indexOf('function roamMove(',start+1);
 assert.ok(start>0 && end>start);
 const source=engine.slice(start,end);
 let moves=[];const fn=new Function('roamMove',source+';return roamMoveSmooth;')((f,s)=>moves.push([f,s]));
 for(const [duration,steps] of [[0.033,1],[0.090,2],[0.200,3]]){
  moves=[];fn(8,4,duration);
  assert.equal(moves.length,steps);
  assert.ok(Math.abs(moves.reduce((sum,p)=>sum+p[0],0)-8)<1e-9);
  assert.ok(Math.abs(moves.reduce((sum,p)=>sum+p[1],0)-4)<1e-9);
 }
 assert.match(engine,/NANO_PHYSICS\.move2D/,'existing swept collision engine retained');
});
test('GPU work is reduced without removing house details or game systems',()=>{
 assert.match(engine,/shadowMap\.needsUpdate=Q\.f%\(window\.ATM_OUT\?9:7\)/);
 assert.match(engine,/!\(frameN % \(window\.__LOWFPS \? 14 : 8\)\)/);
 assert.match(engine,/!MAP\.expandedOpen/);
 assert.match(engine,/window\.ATM_OUT \? 33 : 25/);
 assert.match(engine,/const crumbNode=\$\('crumb'\);if\(crumbNode\.innerHTML!==breadcrumb\)/);
 assert.match(engine,/S\.renderer\.render\(S\.scene, cam\)/);
 assert.match(engine,/if \(document\.hidden \|\| !frameVisible\)/);
});
test('adaptive quality degrades slowly and returns to original pixel density when stable',()=>{
 assert.match(engine,/const sustainedSlow=/);
 assert.match(engine,/const sustainedFast=/);
 assert.match(engine,/adaptivePerf\.fast\/samples>=0\.8/);
 assert.match(engine,/now-adaptivePerf\.lastChange>=24000/);
 assert.match(engine,/Math\.min\(Q\.max,Math\.round\(\(current\+0\.05\)/);
 assert.match(engine,/dataset\.unfireAdaptiveQuality=next<Q\.max/);
});
