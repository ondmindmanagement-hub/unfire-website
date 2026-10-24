'use strict';
// Deterministic CPU-only invariant checks for Unfire Audio's NANO and normal
// movement. No WebGL/browser, timers, network, assets or write-side effects.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const N=require('../audio/maletin/nano-physics.js');

function random(seed) {
  let v=seed>>>0;
  return () => {
    v=(Math.imul(v,1664525)+1013904223)>>>0;
    return v/4294967296;
  };
}
const close=(a,b,eps=1e-7)=>Math.abs(a-b)<=eps;
const finite=(p,fields)=>fields.forEach(k=>assert.ok(Number.isFinite(p[k]),k+' not finite: '+p[k]));

test('scale changes preserve finite and proportionate movement/collision budgets',()=>{
  const full=N.profile(false),small=N.profile(true);
  assert.ok(small.height < full.height && small.radius < full.radius);
  assert.ok(small.walkSpeed < full.walkSpeed && small.walkSpeed > 0);
  assert.ok(small.runSpeed > small.walkSpeed && small.flightSpeed > 0);
  assert.ok(small.eyeHeight < full.eyeHeight && small.cameraNear < full.cameraNear);
  for(const p of [full,small]) finite(p,
    ['height','scale','radius','walkSpeed','runSpeed','gravity','terminalFall','eyeHeight','cameraNear']);
  assert.ok(close(small.height,N.NANO_HEIGHT));
  assert.ok(close(full.height,N.NORMAL_HEIGHT));
});

test('first / second / third person camera cycles and remains finite at every scale',()=>{
  for(const nano of [false,true]){
    const p=N.profile(nano);
    let mode='3p';
    for(let k=0;k<300;k++){
      const pose=N.cameraPose(mode,
        {nano,x:-30,z:24,footY:-8.9,yaw:k*0.17,pitch:Math.sin(k)*0.8},p);
      assert.equal(pose.mode,mode);
      finite(pose.position,['x','y','z']);
      finite(pose.target,['x','y','z']);
      assert.ok(pose.near>0 && Number.isFinite(pose.near));
      assert.equal(pose.showAvatar,mode!=='1p');
      mode=N.nextCameraMode(mode);
    }
    assert.equal(mode,'3p');
  }
  assert.equal(N.nextCameraMode('3pl'),'2p');
  assert.equal(N.nextCameraMode('libre'),'2p');
});

test('long movements cannot tunnel across a padded solid doorway obstruction',()=>{
  // Existing engine boxes include ~1.1m padding. Physical wall is x 4..6,
  // z 4..8 after converting to real bounds.
  const wall={x0:2.9,x1:7.1,z0:2.9,z1:9.1,y0:-12,y1:20};
  for(const nano of [false,true]){
    const p=N.profile(nano);
    // Start within one bounded NANO step of the wall so both sizes reach it.
    const start={x:0,z:6};
    const many=N.move2D(start,{x:60,z:0},[wall],p,{footY:-8.9,prePadding:1.1});
    finite(many,['x','z','distance']);
    assert.ok(many.blocked,'Wall collision never signalled');
    assert.ok(many.x <= 4-p.radius+1e-6,
      'Moved through solid wall at size '+(nano?'nano':'normal')+': '+many.x);
    assert.ok(N.penetration(many.x,many.z,[wall],p,-8.9,1.1)<1e-6);
    const noWalls=N.move2D(start,{x:60,z:0},[],p,{footY:-8.9,prePadding:1.1});
    assert.ok(noWalls.x > start.x && noWalls.distance<=60+1e-6);
    if(noWalls.truncated) assert.ok(noWalls.distance<60);
  }
});

test('seeded walk fuzz never creates intersection from a collision-free start',()=>{
  const rng=random(20261024);
  const obstacles=[
    {x0:-3.1,x1:3.1,z0:3.9,z1:10.1,y0:-12,y1:22},
    {x0:9,x1:14,z0:-9,z1:-1,y0:-12,y1:25},
    {x0:-18,x1:-12,z0:-12,z1:-6,y0:-12,y1:25}
  ];
  for(const isNano of [false,true]){
    const p=N.profile(isNano);
    let state={x:-25,z:20,vx:0,vz:0};
    for(let k=0;k<2200;k++){
      const dt=k%73===0?1.3:0.005+rng()*0.09;
      const dir=(rng()*2-1)*Math.PI;
      const out=N.updateWalk(state,{
        x:Math.cos(dir),z:Math.sin(dir),run:k%9===0,slow:k%5===0
      },p,dt,{obstacles,footY:-8.9,prePadding:1.1});
      finite(out,['x','z','vx','vz','distance']);
      assert.ok(N.penetration(out.x,out.z,obstacles,p,-8.9,1.1)<1e-6,
        'Collision at step '+k+' (nano='+isNano+') '+JSON.stringify(out));
      // dt is clamped to 50ms. No teleporting on a stalled rendering frame.
      assert.ok(out.distance<=p.runSpeed*0.05+1e-5,
        'Per-step displacement exceeded bounded speed at step '+k);
      state=out;
    }
  }
});

test('size morph never returns an unsafe successful spawn',()=>{
  const obstacles=[
    {x0:-2.6,x1:2.6,z0:2.4,z1:7.6,y0:-12,y1:20},
    {x0:7,x1:12,z0:1,z1:6,y0:-12,y1:20}
  ];
  const rng=random(490017);
  for(let k=0;k<320;k++){
    const p=N.profile(k%2===0);
    const origin={x:rng()*22-10,z:rng()*18-5};
    const out=N.safeMorphPosition(origin,p,obstacles,{footY:-8.9,prePadding:1.1});
    finite(out,['x','z']);
    if(out.safe){
      assert.ok(N.penetration(out.x,out.z,obstacles,p,-8.9,1.1)<1e-6,
        'Morph claimed a safe spawn inside an obstacle');
    } else {
      assert.equal(out.moved,false,'Failed morph cannot move player');
      assert.equal(out.x,origin.x);
      assert.equal(out.z,origin.z);
    }
  }
});

test('flight/fall never crosses floor or ceiling even after stalled frame',()=>{
  for(const nano of [false,true]){
    const p=N.profile(nano),floor=-8.9,ceiling=60;
    let s={h:floor,vy:0};
    for(let k=0;k<700;k++){
      const up=k<180?1:0,down=k>=180&&k<330?1:0;
      const fly=k<420;
      const out=N.updateVertical(s,{floor,ceiling,fly,up,down},p,
        k%13===0?0.5:1/60);
      finite(out,['h','vy']);
      assert.ok(out.h>=floor-1e-6,'Falls through floor');
      assert.ok(out.h+p.height<=ceiling+1e-6,'Passes through ceiling');
      s=out;
    }
  }
});

test('invalid delta and intent values cannot turn positions into NaN',()=>{
  const p=N.profile(true);
  const result=N.move2D({x:-4,z:2},{x:NaN,z:Infinity},[],p);
  finite(result,['x','z','distance']);
  assert.ok(close(result.x,-4)&&close(result.z,2));
  const walk=N.updateWalk({x:2,z:2,vx:NaN,vz:Infinity},
    {x:NaN,z:Infinity},p,NaN);
  finite(walk,['x','z','vx','vz']);
});

test('free-play mode alone determines whether story progression is allowed',()=>{
  for(const mode of ['robot','nano','minirobot'])
    assert.equal(N.missionsEnabled(mode),false);
  for(const mode of ['story','human','normal'])
    assert.equal(N.missionsEnabled(mode),true);
});
