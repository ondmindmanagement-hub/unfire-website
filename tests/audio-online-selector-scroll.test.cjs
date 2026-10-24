'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {install,CSS}=require('../audio/maletin/garage-scroll-guard.js');
function fake(mode='online'){
  const make=id=>({
    id,dataset:{},scrollTop:0,attrs:{},listeners:new Map(),
    addEventListener(type,fn,options){this.listeners.set(type+':'+!!(options&&(options===true||options.capture)),fn);},
    setAttribute(key,val){this.attrs[key]=val;},
    querySelectorAll(){return[];}
  });
  const ui=make('onl'),list=make('onT'),colors=make('onC');
  const classes=new Set(['on']);
  if(mode==='workshop')classes.add('workshop');
  if(mode==='hidden')classes.delete('on');
  ui.classList={contains:key=>classes.has(key)};
  ui.contains=x=>x===ui||x===list||x===colors||x?.parent===ui;
  const styles=[];
  const doc={
    getElementById:id=>({onl:ui,onT:list,onC:colors})[id]||null,
    createElement:tag=>({tagName:tag}),
    head:{appendChild:x=>styles.push(x)}
  };
  assert.equal(install(doc),true);
  return {doc,ui,list,colors,styles};
}
const event=target=>({target,stops:0,cancels:0,stopPropagation(){this.stops++;},preventDefault(){this.cancels++;}});
test('online selector has bounded, two-column native scroll and keyboard focus style',()=>{
  const x=fake('online');
  assert.match(CSS,/#onl\.on:not\(\.workshop\) #onT/);
  assert.match(CSS,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(CSS,/max-height:calc\(100dvh - 20px\)/);
  assert.match(CSS,/touch-action:pan-y/);
  assert.match(CSS,/:focus-visible/);
  assert.equal(x.list.attrs.role,'region');
  assert.equal(x.list.attrs.tabindex,'0');
});
for(const mode of ['online','workshop']){
  test(mode+': trackpad inside avatar list is native scroll and never reaches 3D wheel listener',()=>{
    const {ui,list}=fake(mode);
    const e=event(list);
    ui.listeners.get('wheel:false')(e);
    assert.equal(e.stops,1);
    assert.equal(e.cancels,0);
  });
  test(mode+': touch drag in robot list does not become game touch control',()=>{
    const {ui,list}=fake(mode);
    const e=event(list);
    ui.listeners.get('touchmove:false')(e);
    assert.equal(e.stops,1);
    assert.equal(e.cancels,0);
  });
}
test('online: selecting a robot keeps list offset and restores keyboard focus after repaint',async()=>{
  const {list}=fake('online');
  list.scrollTop=257;
  const selected={dataset:{t:'7'},focused:false,focus(){this.focused=true;}};
  list.querySelectorAll=()=>[selected];
  list.listeners.get('click:true')({target:{closest:()=>({dataset:{t:'7'}})}});
  list.scrollTop=0;
  await new Promise(queueMicrotask);
  assert.equal(list.scrollTop,257);
  assert.equal(selected.focused,true);
});
test('online: changing color does not scroll the chosen robot out of view',async()=>{
  const {list,colors}=fake('online');
  list.scrollTop=198;
  colors.listeners.get('click:true')({target:{closest:()=>null}});
  list.scrollTop=0;
  await new Promise(queueMicrotask);
  assert.equal(list.scrollTop,198);
});
test('hidden selector does not intercept the game or schedule a restore',async()=>{
  const {ui,list}=fake('hidden');
  const e=event(list);
  ui.listeners.get('wheel:false')(e);
  assert.equal(e.stops,0);
  list.scrollTop=120;
  list.listeners.get('click:true')({target:{closest:()=>({dataset:{t:'4'}})}});
  list.scrollTop=0;
  await new Promise(queueMicrotask);
  assert.equal(list.scrollTop,0);
});
test('events outside selector are not swallowed and install is idempotent',()=>{
  const {doc,ui,styles}=fake('online');
  const e=event({id:'outside'});
  ui.listeners.get('wheel:false')(e);
  assert.equal(e.stops,0);
  assert.equal(install(doc),false);
  assert.equal(styles.length,1);
});
