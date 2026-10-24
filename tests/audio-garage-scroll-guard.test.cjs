'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {install,CSS}=require('../audio/maletin/garage-scroll-guard.js');
function fake(){
  const el=id=>({id,dataset:{},scrollTop:0,attrs:{},listeners:new Map(),
    addEventListener(t,f,opts){this.listeners.set(t+':'+!!(opts&&(opts===true||opts.capture)),f);},
    setAttribute(k,v){this.attrs[k]=v;},querySelectorAll(){return[];},
    contains(x){return x===this||x===list||x===colors||x?.parent===this;}
  });
  const ui=el('onl'),list=el('onT'),colors=el('onC');
  ui.classList={contains:k=>k==='on'||k==='workshop'};
  const styles=[];
  const doc={
    getElementById:id=>({onl:ui,onT:list,onC:colors})[id]||null,
    createElement:tag=>({tagName:tag}),head:{appendChild:x=>styles.push(x)}
  };
  return {doc,ui,list,colors,styles};
}
test('workshop scroll region is native, scoped and touch-pan enabled',()=>{
  const x=fake();assert.equal(install(x.doc),true);
  assert.match(CSS,/touch-action:pan-y/);assert.match(CSS,/max-height:none!important/);
  assert.equal(x.list.attrs.role,'region');assert.equal(x.styles.length,1);
});
test('wheel does not reach window movement handler or prevent native scrolling',()=>{
  const {doc,ui,list}=fake();install(doc);let stop=0,prevent=0;
  ui.listeners.get('wheel:false')({target:list,stopPropagation(){stop++;},preventDefault(){prevent++;}});
  assert.equal(stop,1);assert.equal(prevent,0);
});
test('touch drag inside list does not leak into 3D control',()=>{
  const {doc,ui,list}=fake();install(doc);let n=0;
  ui.listeners.get('touchmove:false')({target:list,stopPropagation(){n++;}});
  assert.equal(n,1);
});
test('robot click preserves list scroll after re-render and restores focus',async()=>{
  const {doc,list}=fake();install(doc);list.scrollTop=312;
  const next={dataset:{t:'7'},focused:false,focus(){this.focused=true;}};
  list.querySelectorAll=()=>[next];
  list.listeners.get('click:true')({target:{closest:()=>({dataset:{t:'7'}})}});
  list.scrollTop=0;await new Promise(queueMicrotask);
  assert.equal(list.scrollTop,312);assert.equal(next.focused,true);
});
test('changing robot color preserves the previously viewed rows',async()=>{
  const {doc,list,colors}=fake();install(doc);list.scrollTop=278;
  colors.listeners.get('click:true')({target:{closest:()=>null}});
  list.scrollTop=0;await new Promise(queueMicrotask);
  assert.equal(list.scrollTop,278);
});
test('repeated installation adds no duplicate handlers',()=>{
  const x=fake();assert.equal(install(x.doc),true);assert.equal(install(x.doc),false);assert.equal(x.styles.length,1);
});

test('garage module is loaded only after game engine and with isolated version tag',()=>{
  const fs=require('node:fs'), path=require('node:path');
  const html=fs.readFileSync(path.join(__dirname,'../audio/maletin/index.html'),'utf8');
  const engine=html.indexOf('<script src="game-engine-v50.js?v=');
  const garage=html.indexOf('<script src="garage-scroll-guard.js?v=20261024combinedqa1" defer>');
  assert.ok(engine>=0 && garage>engine);
  assert.equal(html.split('garage-scroll-guard.js?v=20261024combinedqa1').length-1,1);
});
