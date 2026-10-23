'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const engine = fs.readFileSync('audio/maletin/game-engine-v50.js','utf8');
const start = engine.indexOf('  function prewarmRoamingObstacles() {');
const end = engine.indexOf('  const VER = /ver=', start);
assert(start > 0 && end > start);
const fragment = engine.slice(start,end);
class Vector {
  constructor(x=0,y=0,z=0) {this.x=x;this.y=y;this.z=z;}
}
class Box {
  constructor(){this.min=new Vector();this.max=new Vector();}
  setFromObject(o) {
    this.min = new Vector(...o.bounds.slice(0,3));
    this.max = new Vector(...o.bounds.slice(3));
    return this;
  }
  isEmpty() {return this.max.x<this.min.x || this.max.y<this.min.y || this.max.z<this.min.z;}
  getSize(v) {v.x=this.max.x-this.min.x;v.y=this.max.y-this.min.y;v.z=this.max.z-this.min.z;return v;}
  getCenter(v) {v.x=(this.max.x+this.min.x)/2;v.y=(this.max.y+this.min.y)/2;v.z=(this.max.z+this.min.z)/2;return v;}
}
function node(bounds,extra={}) {
  return {bounds,visible:true,isMesh:true,isLight:false,isSprite:false,isPoints:false,
    userData:{},children:[],position:{x:0,z:0},updateMatrixWorld(){},
    ...extra};
}
function harness(opts={}) {
  const chair=node([14,-8.7,20,16,-7.7,22]);
  const pillar=node([25,-8.9,30,27,-0.8,32]); // tall solid furniture
  const hidden=node([38,-8.9,45,40,-0.8,47],{visible:false});
  const roots=[chair,pillar,hidden];
  const ROOM={R:{children:roots}}, ROAMS={on:false}, document={hidden:false};
  const window={};
  const jobs=[];
  let clock=0;
  const ctx={
    ROOM,ROAMS,document,window,LOWDEV:true,
    THREE:{Box3:Box,Vector3:Vector,AdditiveBlending:2},
    V:(x,y,z)=>new Vector(x,y,z),
    setTimeout(fn){jobs.push(fn);return jobs.length;},
    performance:{now(){clock+=.05;return clock;}},
    Math,Set
  };
  vm.runInNewContext(fragment,ctx,{timeout:1000});
  if(opts.enterImmediately) {ROAMS.on=true;}
  else ctx.prewarmRoamingProps();
  function flush(max=100) {
    let n=0;
    while(jobs.length && n++<max) jobs.shift()();
    assert(n < max,'bounded prewarm cannot loop forever');
  }
  return {ctx,chair,pillar,hidden,window,ROOM,ROAMS,document,jobs,flush};
}
test('prewarm builds movable props and full obstacles without changing hitboxes',()=>{
  const h=harness();h.flush();
  assert.equal(h.window.__PROPS.length,1);
  assert.strictEqual(h.window.__PROPS[0].o,h.chair);
  assert.equal(h.window.__OBST.length,1);
  const b=h.window.__OBST[0];
  assert.equal(b.x0,23.9); assert.equal(b.x1,28.1);
  assert.equal(b.z0,28.9); assert.equal(b.z1,33.1);
  assert.equal(b.y1,-.8);
});
test('prewarm never commits partial collision data when walking starts',()=>{
  const h=harness();
  assert.equal(h.jobs.length,1);
  h.ROAMS.on=true;
  h.flush();
  assert.equal(h.window.__PROPS,undefined);
  assert.equal(h.window.__OBST,undefined);
});
test('prewarm does not start when tab hidden or player already walking',()=>{
  const h=harness({enterImmediately:true});
  assert.equal(h.jobs.length,0);
  const z=harness(); z.document.hidden=true; z.flush();
  assert.equal(z.window.__PROPS,undefined);
});
test('original complete collision fallback still exists in active gameplay',()=>{
  assert.match(engine,/if \(!window\.__PROPS\) \{ const L = \[\]/);
  assert.match(engine,/window\.__OBST = window\.__buildObst\(\)/);
  assert.match(engine,/if \(LOWDEV\) setTimeout\(prewarmRoamingProps, 350\)/);
  assert.match(fragment,/performance\.now\(\) \+ 2\.5/);
  assert.match(fragment,/!ROAMS\.on && !window\.__OBST && !document\.hidden/);
});
