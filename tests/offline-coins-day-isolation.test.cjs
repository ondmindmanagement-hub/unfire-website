'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../audio/maletin/coins-shop.js'),'utf8');

function harness({balance=0,claimedDate=null,claimedIds=[]}={}) {
  const clock = { ms: Date.parse('2026-10-24T23:58:00Z') };
  class ClockDate extends Date {
    constructor(...args) { super(...(args.length ? args : [clock.ms])); }
    static now() { return clock.ms; }
    // The app deliberately uses the player's LOCAL calendar. Keep the mocked
    // calendar on UTC for this deterministic midnight test across CI/Europe/Madrid.
    getFullYear() { return this.getUTCFullYear(); }
    getMonth() { return this.getUTCMonth(); }
    getDate() { return this.getUTCDate(); }
  }
  class El {
    constructor() {
      this.children=[]; this.slots={}; this.style={}; this.dataset={}; this.attrs={};
      const values = new Set();
      this.classList={add:key=>values.add(key),remove:key=>values.delete(key),contains:key=>values.has(key)};
    }
    querySelector(s) { return this.slots[s]||(this.slots[s]=new El()); }
    appendChild(child) { this.children.push(child); return child; }
    addEventListener() {}
    setAttribute(k,v) { this.attrs[k]=v; }
    focus() {}
  }
  class Obj {
    constructor() {
      this.userData={}; this.visible=true;
      this.position={set(x,y,z){this.x=x;this.y=y;this.z=z;}};
      this.scale={setScalar(v){this.x=v;this.y=v;this.z=v;}};
      this.rotation={set(x,y,z){this.x=x;this.y=y;this.z=z;}};
    }
    updateMatrix() { this.matrix={}; }
    setMatrixAt() {}
  }
  class Mesh extends Obj {
    constructor(geometry, material) { super(); this.geometry=geometry; this.material=material; }
  }
  class Material { constructor() { this.color={set(){}}; this.opacity=1; } }
  const THREE={
    MeshStandardMaterial:Material,MeshBasicMaterial:Material,
    Mesh,InstancedMesh:class extends Mesh { constructor(geometry,material,count){super(geometry,material);this.instanceMatrix={needsUpdate:false};this.count=count;} },
    TorusGeometry:class{},RingGeometry:class{},BoxGeometry:class{},Object3D:Obj,DoubleSide:2
  };
  const store=new Map();
  if (balance) store.set('unfire_offline_coins_v1',JSON.stringify({balance,owned:['robot-4','robot-1'],morph:'robot-4'}));
  if (claimedDate) store.set('unfire_offline_coin_claims_v1',JSON.stringify({date:claimedDate,ids:claimedIds}));
  const localStorage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
  const document={body:new El(),activeElement:new El(),createElement:()=>new El()};
  const scene=[];
  const S={scene:{add:v=>scene.push(v),remove(){}}};
  let online=false;
  const window={ATM_OUT:false,ONLINE_ON:()=>online};
  const sandbox={window,document,THREE,localStorage,addEventListener(){},Date:ClockDate,Math,JSON,Set};
  vm.runInNewContext(source,sandbox,{timeout:3000,filename:'coins-shop.js'});
  const ROAMS={on:true,mini:false,p:{x:-30,z:24},h:0,k:{},moving:false};
  const MUTANTS={list:Array.from({length:20},(_,id)=>({name:'Robot '+id}))};
  const api=window.UNFIRE_COINS_BOOT({ROAMS,THREE,S,MUTANTS});
  return {api,ROAMS,scene,store,setOnline:v=>{online=v;},setClock:iso=>{clock.ms=Date.parse(iso);},
    tick(n=1){for(let i=0;i<n;i++)api.tick(.016,i/60);}};
}

test('decorations bought offline disappear online and while not roaming',()=>{
  const h=harness({balance:60});
  assert.equal(h.scene.length,4,'one instanced coin mesh plus three visual effects');
  h.api.open();
  assert.equal(h.api.buy('deco'),true);
  h.tick();
  assert.equal(h.scene[3].visible,true,'lamp appears in offline roaming');
  h.setOnline(true);
  h.tick();
  assert.equal(h.scene[3].visible,false,'offline decoration must not leak into online rooms');
  h.setOnline(false);
  h.ROAMS.on=false;
  h.tick();
  assert.equal(h.scene[3].visible,false,'decoration hidden outside roaming');
  h.ROAMS.on=true;
  h.tick();
  assert.equal(h.scene[3].visible,true,'owned decoration restored when offline roaming resumes');
});

test('coins renew across midnight without reload, but cannot be renewed by rolling clock back',()=>{
  const h=harness();
  h.tick(3);
  assert.equal(h.api.balance,1);
  h.tick(25);
  assert.equal(h.api.balance,1,'same spawn cannot be claimed twice on one day');
  h.ROAMS.p.x=999;h.ROAMS.p.z=999;
  h.setClock('2026-10-25T00:03:00Z');
  h.tick(100);
  const claims=JSON.parse(h.store.get('unfire_offline_coin_claims_v1'));
  assert.equal(claims.date,'2026-10-25');
  assert.deepEqual(claims.ids,[]);
  h.ROAMS.p.x=-30;h.ROAMS.p.z=24;
  h.tick(3);
  assert.equal(h.api.balance,2,'new daily coin can be collected without page reload');
  h.ROAMS.p.x=999;h.ROAMS.p.z=999;
  h.setClock('2026-10-24T23:59:00Z');
  h.tick(100);
  h.ROAMS.p.x=-30;h.ROAMS.p.z=24;
  h.tick(3);
  assert.equal(h.api.balance,2,'clock rollback cannot replenish claimed spawn in the same session');
});

test('a saved future claim date is not reset by reopening while local clock is behind',()=>{
  const h=harness({balance:7,claimedDate:'2026-10-26',claimedIds:[0]});
  h.tick(6);
  assert.equal(h.api.balance,7,'reloading with an earlier local date keeps prior claim set');
});
