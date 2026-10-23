'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname,'../audio/maletin/door-cinema.js'),'utf8');
const nodes = new Map(), documentListeners = {}, windowListeners = {};
let scheduled = new Map(), nextTimer = 1, callbackOrder = [];
const createElement = (tag) => {
  const classes = new Set();
  const node = {
    tagName: tag.toUpperCase(), isConnected:false,
    dataset:{}, attributes:{}, children:[], textContent:'', innerHTML:'', offsetWidth:1,
    classList:{
      add(v){ classes.add(v); }, remove(v){ classes.delete(v); },
      contains(v){ return classes.has(v); }
    },
    setAttribute(name,value){this.attributes[name]=String(value);},
    removeAttribute(name){delete this.attributes[name];}
  };
  Object.defineProperty(node,'id',{
    get(){return this._id;},
    set(v){this._id=v;nodes.set(v,this);}
  });
  return node;
};
const head = {appendChild(n){n.isConnected=true;}},
      body = {appendChild(n){n.isConnected=true;}};
const document = {
  head, body, hidden:false,
  createElement,
  getElementById(id){return nodes.get(id)||null;},
  addEventListener(type,fn){documentListeners[type]=fn;}
};
const window = {
  document,
  setTimeout(fn,delay){const id=nextTimer++;scheduled.set(id,{fn,delay});return id;},
  clearTimeout(id){scheduled.delete(id);},
  addEventListener(type,fn){windowListeners[type]=fn;}
};
vm.runInNewContext(source,{window}, {timeout:500});
const api=window.UNFIRE_DOOR_CINEMA;
assert(api && Object.isFrozen(api));
assert.equal(api.duration,580);
const state={on:true,mini:false,fly:false,x:-30,z:93,previous:false,next:true};
const negativeCases=[
  {...state,on:false},{...state,mini:true},{...state,fly:true},
  {...state,previous:true},{...state,x:-22},{...state,z:101},
  {...state,z:87},{...state,x:Infinity},{...state,z:NaN},
  {...state,next:false},{...state,previous:0,next:0},null
];
for(const item of negativeCases){
  assert.equal(api.actualDoorCross(item),false, 'must skip unsafe crossing: '+JSON.stringify(item));
  assert.equal(api.cross(item),false);
}
assert.equal(nodes.has('unfireDoorCinema'),false,'DOM lazy, nothing created for normal gameplay');
assert.equal(api.cross(state),true,'real door out starts');
const layer=nodes.get('unfireDoorCinema');
assert(layer,'one reusable overlay');
assert.equal(layer.attributes['aria-hidden'],'true');
assert.equal(layer.dataset.direction,'outside');
assert.equal(layer.classList.contains('play'),true);
assert(source.includes('pointer-events:none'),'never intercept taps');
assert(source.includes('prefers-reduced-motion:reduce'),'accessible reduced motion');
assert(source.includes('contain:layout paint style'),'isolate paint');
assert.equal(scheduled.size,1);
assert.equal([...scheduled.values()][0].delay,580);
const previousTimeout=[...scheduled.values()][0].fn;
const backward={...state,previous:true,next:false,z:92.8};
assert.equal(api.cross(backward),true,'real door in starts');
assert.equal(layer.dataset.direction,'inside');
assert.equal(nodes.get('unfireDoorCinema'),layer,'reuse DOM, no extra canvas');
assert.equal(scheduled.size,1,'old cleanup timer is cleared');
previousTimeout();
assert.equal(layer.classList.contains('play'),true,'stale callback must not cancel new crossing');
[...scheduled.values()][0].fn();
assert.equal(layer.classList.contains('play'),false,'bounded cleanup after 580ms');
assert.equal(scheduled.size,0);
assert.equal(api.cross(state),true);
document.hidden=true;
documentListeners.visibilitychange();
assert.equal(layer.classList.contains('play'),false,'background hidden resets');
assert.equal(scheduled.size,0);
assert.equal(api.cross(state),false,'hidden document must not animate');
document.hidden=false;
assert.equal(api.cross(state),true);
windowListeners.pagehide();
assert.equal(layer.classList.contains('play'),false,'navigation clears animation');
assert.equal(scheduled.size,0);
console.log('door-cinema: 28+ guards/reuse/cleanup/accessibility checks PASS');
