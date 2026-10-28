'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const nano = require('../audio/maletin/nano-physics.js');
const code = fs.readFileSync(path.resolve(__dirname,'../audio/maletin/game-engine-v50.js'),'utf8');

test('Nimbo uses continuous collision for every follow step, not one final snap-out',()=>{
  assert.match(code,/previousNimboX = w\.position\.x, previousNimboZ = w\.position\.z/);
  assert.match(code,/NANO_PHYSICS\.move2D\(\s*\{ x: previousNimboX, z: previousNimboZ \}/);
  assert.match(code,/const obstacles = outside\s*\? \(window\.__OBSTO/);
  assert.match(code,/radius = ROAMS\.mini \? 0\.22 : 2\.8/);
  assert.doesNotMatch(code,/if \(!window\.ATM_OUT && !ROAMS\.mini && window\.__OBST\) \{ const R = 2\.8/);
});

test('continuous companion collision does not tunnel through a solid desk',()=>{
  const desk={x0:8,x1:18,z0:-3,z1:3,y0:-9,y1:2};
  const body={radius:2.8,height:6.4};
  const result=nano.move2D({x:0,z:0},{x:40,z:0},[desk],body,{footY:-3.2,prePadding:0});
  assert.ok(result.x <= desk.x0-body.radius+0.001,'Nimbo cannot travel across the desk');
  assert.equal(result.blocked,true);
});

test('companion can go around a desk and fly clear above it',()=>{
  const desk={x0:8,x1:18,z0:-3,z1:3,y0:-9,y1:2};
  const body={radius:2.8,height:6.4};
  const around=nano.move2D({x:0,z:9},{x:22,z:0},[desk],body,{footY:-3.2,prePadding:0});
  assert.ok(around.x>19,'Nimbo may go around obstacles');
  const above=nano.move2D({x:0,z:0},{x:22,z:0},[desk],body,{footY:3,prePadding:0});
  assert.ok(above.x>19,'An airborne companion above the furniture should not be blocked');
});

test('player collision remains integrated with the same pure Nano physics',()=>{
  assert.match(code,/NANO_PHYSICS\.move2D\(\{ x: px0, z: pz0 \}/);
  assert.match(code,/const hp = HOST\.pos; if \(hp && HOST\.visible\)/);
});