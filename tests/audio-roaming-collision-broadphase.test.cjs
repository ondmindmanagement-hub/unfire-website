'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../audio/maletin/collision-nearby.js'), 'utf8');
const root = {};
vm.runInNewContext(source, { window: root }, { timeout: 1000 });
const { nearby, diagnostics } = root.UnfireCollisionNearby;
const intersects = (b,x,z,p) => b.x0 <= x+p && b.x1 >= x-p && b.z0 <= z+p && b.z1 >= z-p;
function required(boxes,x,z,p) {
  return boxes.filter(b => intersects(b,x,z,p));
}
function assertSuperset(boxes,x,z,p,label) {
  const result=nearby(boxes,x,z,p);
  const found=new Set(result);
  for(const box of required(boxes,x,z,p)) assert(found.has(box), label+': missed obstacle');
  assert.equal(result.length,new Set(result).size,label+': duplicate obstacle');
}
test('indoor furniture grid includes all colliders touching player, props and NPCs', () => {
  const b=[];
  for(let x=-84; x<=84; x+=6) for(let z=-21;z<=100;z+=6)
    b.push({x0:x,x1:x+2.2,z0:z,z1:z+3.1,y1:-3});
  for(const p of [0,1,2.2,4,8]) for(let x=-81;x<82;x+=17)
    for(let z=-18;z<98;z+=19) assertSuperset(b,x+0.9,z+1.3,p,'indoor');
  const d=diagnostics(b);
  assert.equal(d.indexed,true);
  assert.ok(d.cachedQueries<=48);
  assert.ok(nearby(b,0,40,2).length<b.length/2,'broadphase actually reduces tests');
});
test('exterior at high travel speed and boundaries includes thin walls and large structures', () => {
  const b=[];
  for(let i=0;i<1250;i++) {
    const x=((i*83)%1900)-950,z=((i*47)%1700)-850;
    b.push({x0:x,x1:x+1.1,z0:z,z1:z+2,y1:-5});
  }
  b.push({x0:-1800,x1:1800,z0:-2,z1:1,y1:35}); // long barrier, index must not discard
  b.push({x0:598.99,x1:599.01,z0:-35,z1:60,y1:66});
  for(let x=-1000;x<=1000;x+=41) for(let z=-900;z<=900;z+=59)
    assertSuperset(b,x,z,10,'exterior-speed');
  assertSuperset(b,600,40,2.5,'thin-wall');
});
test('a box spanning many cells remains collidable', () => {
  const b=Array.from({length:90},(_,i)=>({x0:i*30,x1:i*30+4,z0:i*7,z1:i*7+6}));
  const big={x0:-80000,x1:80000,z0:-30,z1:30};
  b.push(big);
  assert(nearby(b,900,15,1).includes(big));
  assert(nearby(b,-6000,0,1).includes(big));
});
test('index invalidates on append (outdoor collision grid completion)', () => {
  const b=Array.from({length:40},(_,i)=>({x0:i*10,x1:i*10+2,z0:0,z1:10}));
  nearby(b,500,0,3);
  const later={x0:500,x1:501,z0:0,z1:1}; b.push(later);
  assert(nearby(b,500,0,2).includes(later));
});
test('unsafe or mutable sources always use the original list instead of missing collisions', () => {
  assert.equal(nearby(null,1,1,2).length,0);
  const b=Array.from({length:25},(_,i)=>({x0:i,x1:i+2,z0:0,z1:2}));
  assert.strictEqual(nearby(b,NaN,0,1),b);
  assert.strictEqual(nearby(b,0,0,-1),b);
  assert.strictEqual(nearby(b,0,0,999999),b);
  b[1]={x0:Infinity,x1:10,z0:0,z1:10};
  assert.strictEqual(nearby(b,5,5,2),b);
});
test('candidate selection has no timers, scene mutation, secondary render loop or external requests', () => {
  assert.doesNotMatch(source,/requestAnimationFrame\s*\(|setInterval\s*\(|setTimeout\s*\(|\.render\s*\(/);
  assert.doesNotMatch(source,/\bfetch\s*\(|sendBeacon\s*\(/);
  assert.match(source,/WeakMap/);
});
test('runtime integrates interior, object-object world, floor and exterior ball collision', () => {
  const engine=fs.readFileSync(path.join(__dirname,'../audio/maletin/game-engine-v50.js'),'utf8');
  const html=fs.readFileSync(path.join(__dirname,'../audio/maletin/index.html'),'utf8');
  assert(html.includes('collision-nearby.js?v=20261024nano1'));
  assert(html.indexOf('collision-nearby.js') < html.lastIndexOf('game-engine-v50.js?v='));
  assert.match(engine,/COLLISION\(window\.__OBST, p\.x, p\.z, 1\)/);
  assert.match(engine,/COLLISION\(OB, cx, cz, q\.r \+ 2\)/);
  assert.match(engine,/COLLISION\(OB, hp\.x, hp\.z, 1\)/);
  assert.match(engine,/COLLISION\(window\.__OBSTO, ROAMS\.p\.x, ROAMS\.p\.z, 1\)/);
  assert.match(engine,/COLLISION\(q\.out \? window\.__OBSTO : window\.__OBST, P\.x, P\.z, q\.r \+ 2\)/);
});
