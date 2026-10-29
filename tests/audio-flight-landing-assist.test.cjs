'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname,'../audio/maletin/game-engine-v50.js'),'utf8');

function createRig() {
  const begin=source.indexOf('  { const LV = [1, 3, 8];');
  const end=source.indexOf('  // líneas de velocidad',begin);
  assert.ok(begin>0 && end>begin,'Found isolated flight UI block');
  const elements=new Map();
  let ms=1000, hudUpdate=null;
  const window={ATM_OUT:true,__SKYDEV:()=>[]};
  const ROAMS={on:true,fly:true,p:{x:3000,z:3000},h:50};
  const document={
    body:{appendChild(){}},head:{appendChild(){}},
    createElement(){return {style:{},addEventListener(){},innerHTML:'',id:''};},
    getElementById(id){if(!elements.has(id))elements.set(id,{textContent:'',onclick:null});return elements.get(id);}
  };
  const env={window,ROAMS,document,performance:{now:()=>ms},
    setInterval(fn){hudUpdate=fn;},addEventListener(){},hap(){}};
  vm.runInNewContext(source.slice(begin,end),env,{timeout:750});
  assert.equal(typeof window.__PROP,'function');
  function advance(seconds=2,step=0.05){
    const n=Math.ceil(seconds/step);
    for(let i=0;i<n;i++){ms+=step*1000;window.__PROP();}
    return window.__PROP();
  }
  return {window,ROAMS,elements,advance,hud:()=>hudUpdate&&hudUpdate(),
    up:()=>elements.get('prUp').onclick(),down:()=>elements.get('prDn').onclick()};
}

test('selector never exposes x20 or x45 and preserves x8 as the maximum',()=>{
  const rig=createRig();
  for(let i=0;i<12;i++)rig.up();
  assert.ok(rig.advance(2.5)>7.8);
  rig.hud();
  assert.match(rig.elements.get('prT').textContent,/PROPULSIÓN x8/);
  assert.doesNotMatch(rig.elements.get('prT').textContent,/x(?:20|45)/);
});

test('flight slows smoothly before the main island and recovers the stored selection when leaving',()=>{
  const r=createRig();for(let i=0;i<3;i++)r.up();
  const full=r.advance(3);assert.ok(full>7.8);
  r.ROAMS.p.x=1260;r.ROAMS.p.z=0;r.ROAMS.h=38;
  const halfway=r.advance(0.4);assert.ok(halfway<full&&halfway>0);
  r.ROAMS.p.x=40;r.ROAMS.p.z=0;
  const slowed=r.advance(3);
  assert.ok(slowed<4, 'at the shore it is slow enough for approach');
  r.hud();assert.match(r.elements.get('prT').textContent,/cerca x/);
  r.ROAMS.p.x=3500;r.ROAMS.p.z=2800;
  const restored=r.advance(3);assert.ok(restored>7.8);
  r.hud();assert.match(r.elements.get('prT').textContent,/PROPULSIÓN x8/);
});

test('the house, secondary islands and raised approach are handled without sudden values',()=>{
  const r=createRig();for(let i=0;i<3;i++)r.up();r.advance(3);
  for(const [x,z,h] of [[0,40,15],[-760,-760,24],[600,0,20],[80,-500,27],[-420,120,20],[300,420,18],[-360,-380,40]]) {
    r.ROAMS.p.x=x;r.ROAMS.p.z=z;r.ROAMS.h=h;
    const speed=r.advance(1.8);
    assert.ok(speed>0&&speed<8,'approach speed bounded near '+x+','+z);
    r.ROAMS.p.x=3800;r.ROAMS.p.z=3800;
    assert.ok(r.advance(1)>speed, 'restore begins on exit');
  }
  r.ROAMS.p.x=0;r.ROAMS.p.z=0;r.ROAMS.h=1600;
  assert.ok(r.advance(3)>7.8, 'high transit altitude preserves selected thrust');
});

test('flight off resets only effective speed, not the selected value',()=>{
  const r=createRig();for(let i=0;i<3;i++)r.up();r.advance(2);
  r.ROAMS.p.x=0;r.ROAMS.p.z=40;r.advance(2);
  r.ROAMS.fly=false;assert.equal(r.window.__PROP(),1);
  r.ROAMS.p.x=4500;r.ROAMS.p.z=4500;r.ROAMS.fly=true;
  assert.ok(r.advance(3)>7.8);
});

test('1p and 3p both apply the same propulsor during outdoor flight; trackpad and case untouched',()=>{
  assert.match(source,/if \(GTA\)[\s\S]*?2\.6 \* flightProp/);
  assert.match(source,/else if \(ROAMS\.mode === '1p'\)[^\n]*?2\.6 \* flightProp/);
  assert.match(source,/const LV = \[1, 3, 8\]/);
  assert.match(source,/const flightProp = window\.ATM_OUT && ROAMS\.fly && window\.__PROP/);
  assert.doesNotMatch(source,/const LV = \[1, 3, 8, 20\]/);
  assert.match(source,/outsideName\.rotation\.y=Math\.PI;/);
  assert.match(source,/side:THREE\.FrontSide/);
  assert.match(source,/g\.fillText\('SALIDA', 128, 140\)/,'inside door still says SALIDA');
  assert.match(source,/g\.fillText\('Unfire',256,215\)/,'outside gets Unfire');
  assert.match(source,/g\.fillText\('Robots',256,326\)/,'outside gets Robots');
});
