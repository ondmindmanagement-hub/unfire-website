'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const Physics=require('../audio/maletin/nano-physics.js');
const engine=fs.readFileSync(path.resolve(__dirname,'../audio/maletin/game-engine-v50.js'),'utf8');

class Vec {
  constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}
  copy(v){this.x=v.x;this.y=v.y;this.z=v.z;return this;}
  lerpVectors(a,b,t){this.x=a.x+(b.x-a.x)*t;this.y=a.y+(b.y-a.y)*t;this.z=a.z+(b.z-a.z)*t;return this;}
}
class Primitive {
  constructor(){this.position=new Vec();this.rotation={x:0,y:0,z:0};this.scale={value:1,setScalar(v){this.value=v;}};this.children=[];this.visible=true;}
  add(...parts){this.children.push(...parts);}
}
class Mesh extends Primitive {constructor(geom,material){super();this.geometry=geom;this.material=material;}}
const fakeThree={Group:Primitive,Mesh,
  SphereGeometry:class{},TorusGeometry:class{},
  MeshStandardMaterial:class{}};
function cinematicContext(){
  const start=engine.indexOf('const NANO_CINEMA = (() => {');
  const end=engine.indexOf('  const MIX =',start);
  assert(start>0&&end>start,'NANO morph must be owned by existing engine, ahead of MIX');
  const world={on:true,mini:false,fly:true,h:5,yaw:0,cy:0,p:{x:0,z:10},k:{w:1}};
  const items=[];
  const context={THREE:fakeThree,Y2K:{led:()=>({})},ROAMS:world,
    S:{scene:{add(o){items.push(o);}}},
    V:(...x)=>new Vec(...x),TAU:Math.PI*2,H2:Math.PI/2,
    window:{ATM_OUT:true}};
  const cinema=vm.runInNewContext(engine.slice(start,end)+'\n NANO_CINEMA;',context,{timeout:900});
  return {cinema,world,items};
}
test('nano dimensions equal miniature case robots, and remain collision-sized',()=>{
  const n=Physics.profile(true),normal=Physics.profile(false);
  assert.equal(n.height,0.24);
  assert.equal(normal.height,10.5);
  assert.equal(n.scale,0.24/10.5);
  assert(n.radius<0.1&&n.speedScale>0);
  assert.match(engine,/const NANO_SCALE = 0\.24 \/ 10\.5;/);
  assert.match(engine,/AV\.w\.scale\.setScalar\(AV\.baseScale\*\(ROAMS\.mini\?NANO_SCALE:1\)\*NANO_CINEMA\.avatarFactor\(\)\)/);
});
test('sphere starts at full robot chest, physically moves and unfolds into the very same nano avatar',()=>{
  const {cinema,world,items}=cinematicContext();
  assert.equal(cinema.start(),true);
  assert.equal(cinema.busy(),true);
  assert.equal(items.length,1,'one reusable sphere group');
  const sphere=items[0];
  assert(sphere.position.y>0,'sphere launches from chest above foot');
  assert.equal(world.mini,false,'full character must not vanish on activation');
  for(let k=0;k<15;k++)cinema.tick(0.07);
  assert.equal(world.mini,true,'reveal actually enables nano');
  assert(sphere.children[0].position.y>0,'top hemisphere procedurally opens');
  assert(sphere.children[1].position.y<0,'bottom hemisphere procedurally opens');
  assert(cinema.avatarFactor()>0 && cinema.avatarFactor()<1,'robot progressively unfolds from sphere');
  assert.equal(cinema.start(),false,'cannot double spawn a second nano during transition');
  for(let k=0;k<12;k++)cinema.tick(0.07);
  assert.equal(cinema.busy(),false);
  assert.equal(sphere.visible,false,'sphere hidden once one playable nano is fully revealed');
  assert.equal(cinema.avatarFactor(),1);
  assert.equal(items.length,1,'subsequent frames never create a new mesh collection');
});
test('nano-only sky flight responds to x1 x3 x8 without excessive cruise speed',()=>{
  const {cinema,world}=cinematicContext();
  world.mini=true;
  const a=cinema.cruise(10,1,false,false);
  const b=cinema.cruise(10,3,false,false);
  const c=cinema.cruise(10,8,false,false);
  assert(a>=50&&a<b&&b<c&&c<=190);
  assert(cinema.cruise(10,20,false,false)<=190,'untrusted multiplier still bounded');
  assert(cinema.cruise(10,45,false,false)<=190,'legacy multiplier still bounded');
  assert(cinema.cruise(10,8,true,false)<=190,'sprint still bounded');
  assert(cinema.cruise(10,8,false,true)<c,'precision mode remains useful');
  world.mini=false;
  assert.equal(cinema.cruise(333,8,true,false),333,'normal robot cruise unchanged');
  world.mini=true;world.fly=false;
  assert.equal(cinema.cruise(34,8,true,false),34,'nano on ground unchanged');
  assert.match(engine,/const LV = \[1, 3, 8\]/,'UI offers only approved multiplier levels');
});
test('miniaturized capsule visibly flies small, grows, opens existing case, and resets on reuse',()=>{
  const i=engine.indexOf('const CAPS=(()=>{'),end=engine.indexOf('  // PROPULSIÓN:',i);
  assert(i>0 && end>i);
  const code=engine.slice(i,end);
  assert.match(code,/launchNano=!!ROAMS\.mini/);
  assert.match(code,/capsule\.scale\.setScalar\(launchNano \? NANO_SCALE : 1\)/);
  assert.match(code,/const travel=launchNano \? Math\.min\(1,u\/0\.63\) : u/);
  assert.match(code,/const grow=Math\.max\(0,Math\.min\(1,\(u-0\.60\)\/0\.4\)\)/);
  assert.match(code,/capsule\.scale\.setScalar\(NANO_SCALE\+\(1-NANO_SCALE\)\*eased\)/);
  assert.match(code,/if\(u>=1\)\{\s*cancel\(\);openCaseInGame\(target\)/);
  assert.match(code,/const cancel=.*capsule\.scale\.setScalar\(1\)/);
});
test('nano can leave a tabletop and fall onto the real floor without camera teleport',()=>{
  const p=Physics.profile(true);
  const start={x:0,z:0};
  const edge=Physics.move2D(start,{x:3,z:0},[],p,{footY:0});
  assert(edge.x>2.5);
  let altitude=8.9,vy=0; // tabletop height relative to the room floor -8.9
  for(let k=0;k<420;k++){
    const s=Physics.updateVertical({h:altitude,vy},{fly:false,floor:0,ceiling:60},p,1/60);
    altitude=s.h;vy=s.vy;
    assert(Number.isFinite(altitude) && altitude>=0,'robot must not fall through floor');
  }
  assert.equal(altitude,0,'mini lands instead of remaining a floating camera');
  assert.match(engine,/const moved = NANO_PHYSICS\.move2D/);
  assert.match(engine,/ROAMS\.fl = fl/);
});
