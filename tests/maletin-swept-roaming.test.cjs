'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {sweep} = require('../audio/maletin/swept-roaming.js');
const engine = fs.readFileSync(path.join(__dirname, '../audio/maletin/game-engine-v50.js'), 'utf8');
const index = fs.readFileSync(path.join(__dirname, '../audio/maletin/index.html'), 'utf8');
const moveBlock = engine.slice(engine.indexOf('  function roamMove(f, side = 0) {'), engine.indexOf("  addEventListener('keydown',", engine.indexOf('  function roamMove(f, side = 0) {')));

function box(x0,x1,z0,z1,y1=10) {return {x0,x1,z0,z1,y1};}
function moveHarness({out=false,x=0,z=30,yaw=0,h=0,boxes=[]} = {}) {
  const ROAMS={yaw, h, mini:false, p:{x,y:4.5,z}};
  const B={x:77.5,z0:-14,z1:93.5};
  const win={ATM_OUT:out,__OBST:out?[]:boxes,__OBSTO:out?boxes:[],__RB:out?{x:12000,z0:-12000,z1:12000}:B,UnfireSweptMotion:{sweep}};
  let transitions=[];
  const ATM={setOut(next){transitions.push(next);win.ATM_OUT=next;win.__RB=next?{x:12000,z0:-12000,z1:12000}:B;}};
  const context={ROAMS,window:win,ATM,clamp:(v,a,b)=>Math.min(b,Math.max(a,v)),Math,console};
  vm.runInNewContext(moveBlock+';globalThis.__move=roamMove;',context);
  return {roam:(f,side=0)=>context.__move(f,side),ROAMS,win,transitions};
}
test('crosses a thin box in the middle of a huge movement without tunneling', ()=>{
  const B=[box(1,1.05,10,14)];
  const r=sweep(-20,12,90,0,B,0);
  assert.ok(r.x<1&&r.x>0.7, 'stops at wall');
  assert.equal(r.blocked,true);
});
test('diagonal flight cannot skip a centered obstacle between endpoints',()=>{
  const r=sweep(-10,-10,20,20,[box(-1,1,-1,1)],0);
  assert.equal(r.blocked,true);
  assert.ok(!(r.x>1&&r.z>1), 'trajectory must not cross straight through box');
});
test('slides alongside a wall without locking both axes',()=>{
  const r=sweep(-10,0,20,8,[box(0,1,-10,10)],0);
  assert.ok(r.x<0);
  assert.ok(r.z>6);
});
test('multi-hit route stops at a second wall without the old stuck teleport',()=>{
  const walls=[box(0,0.1,-10,10),box(-10,10,5,5.1)];
  const r=sweep(-2,0,20,20,walls,0);
  assert.ok(r.x<0.01&&r.z<5.01,JSON.stringify(r));
});
test('walls beneath the flying robot do not block exploration',()=>{
  const r=sweep(-20,0,100,0,[box(0,1,-2,2,10)],50);
  assert.equal(r.x,80);
  assert.equal(r.blocked,false);
});
test('supports recovery when spawning inside collider instead of trapping the player',()=>{
  const r=sweep(0,0,7,0,[box(-1,1,-1,1)],0);
  assert.equal(r.x,7);
});
test('empty geometry allows fast travel across the outside map',()=>{
  const r=sweep(0,0,9000,5400,[],0);
  assert.equal(r.x,9000); assert.equal(r.z,5400);
});
test('invalid coordinates never loop or generate a huge workload',()=>{
  const r=sweep(0,0,NaN,100,[box(1,2,0,2)],0);
  assert.equal(r.x,0); assert.equal(r.z,0);
});
test('actual controller crosses the door outward and inward without scene reload',()=>{
  const game=moveHarness({x:-30,z:90,yaw:Math.PI});
  game.roam(15);
  assert.equal(game.win.ATM_OUT,true,'door opens outward');
  game.ROAMS.yaw=0;
  game.ROAMS.p.z=100;
  game.roam(11);
  assert.equal(game.win.ATM_OUT,false,'door returns inside');
  assert.ok(game.transitions.length===2);
});
test('actual controller keeps walking and flying movement below/above obstacles',()=>{
  const b=[box(1,3,24,26,15)];
  const game=moveHarness({x:-10,z:25,yaw:Math.PI/2,boxes:b});
  game.roam(40);
  assert.ok(game.ROAMS.p.x<1,'blocked near ground');
  game.ROAMS.h=90;
  game.roam(30);
  assert.ok(game.ROAMS.p.x>3,'free flight over obstacle');
});
test('holding movement against wall never teleports through on 40+ attempts',()=>{
  const game=moveHarness({x:-10,z:25,yaw:Math.PI/2,boxes:[box(1,5,24,26,40)]});
  for(let i=0;i<80;i++)game.roam(15);
  assert.ok(game.ROAMS.p.x<1,'cannot force past wall');
});
test('all devices use same sweep geometry and the browser loads it before engine',()=>{
  const src='swept-roaming.js?v=20261023sweptmotion1';
  assert.equal(index.split(src).length-1,1);
  assert.ok(index.indexOf(src)<index.lastIndexOf('src="game-engine-v50.js'));
  assert.match(moveBlock,/UnfireSweptMotion\.sweep\(/);
  assert.doesNotMatch(moveBlock,/ROAMS\.stkN/);
});
