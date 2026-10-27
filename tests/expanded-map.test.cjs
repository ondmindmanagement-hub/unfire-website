'use strict';
const assert = require('node:assert/strict');
const {test} = require('node:test');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname,'..');
const js = fs.readFileSync(path.join(root,'audio/maletin/expanded-map.js'),'utf8');
const css = fs.readFileSync(path.join(root,'audio/maletin/expanded-map.css'),'utf8');
const engine = fs.readFileSync(path.join(root,'audio/maletin/game-engine-v50.js'),'utf8');
const iframe = fs.readFileSync(path.join(root,'audio/maletin/index.html'),'utf8');
const host = fs.readFileSync(path.join(root,'audio/index.html'),'utf8');

function fixture(w,h) {
  const draws=[], handlers=new Map(), selectors=new Map(), classNames=new Set();
  class Element {
    constructor(id) { this.id=id||'';this.events={};this.hidden=false;this.attrs={};this.style={};this.width=0;this.height=0;this.tagName=id==='ufMapCanvas'?'CANVAS':'DIV'; }
    setAttribute(k,v){this.attrs[k]=v;}
    getBoundingClientRect(){return {width:w,height:h,left:0,top:0};}
    getContext(){
      const ctx={};
      for(const method of ['setTransform','fillRect','clearRect','beginPath','arc','ellipse','fill','stroke','strokeRect','save','restore','moveTo','lineTo','closePath','translate','rotate','strokeText','fillText']){
        ctx[method]=(...args)=>draws.push({method,args});
      }
      return ctx;
    }
    setPointerCapture(id){this.pointerId=id;}
    querySelector(sel){if(!selectors.has(sel))selectors.set(sel,new Element(sel.replace('#','')));return selectors.get(sel);}
    addEventListener(ev,fn){(this.events[ev]??=[]).push(fn);}
    fire(ev,args={}){(this.events[ev]||[]).forEach(fn=>fn(Object.assign({pointerId:1,clientX:12,clientY:15,deltaY:0,key:'',target:this,preventDefault(){this.prevented=true;},stopPropagation(){this.stopped=true;},stopImmediatePropagation(){this.immediate=true;}},args)));}
    focus(){this.focused=true;}
  }
  const container=new Element('body');
  container.classList={add:v=>classNames.add(v),remove:v=>classNames.delete(v)};
  container.appendChild=e=>{container.child=e;};
  const doc={body:container,activeElement:new Element('oldFocus'),createElement:()=>new Element('unfireExpandedMap')};
  const win={devicePixelRatio:3,addEventListener:(k,fn)=>{(handlers.get(k)||handlers.set(k,[]).get(k)).push(fn);}};
  const ctx={window:win,document:doc,Map,Math,Date,Array,Number,String};
  vm.runInNewContext(js,ctx);
  const state={zone:'island',x:40,z:80,yaw:1.2,objective:{x:600,z:0}};
  const api=win.UnfireExpandedMap.create(()=>state,()=>{state.onOpen=(state.onOpen||0)+1;});
  return {win,doc,api,draws,selectors,classNames,state,handlers,container};
}
test('map opens lazily, draws only while open and keeps a single canvas',()=>{
  const f=fixture(390,660);
  assert.equal(f.doc.body.child,undefined);
  f.api.tick();assert.equal(f.draws.length,0);
  f.api.show();
  assert.ok(f.doc.body.child);assert.equal(f.api.isOpen,true);
  assert.equal(f.container.child.hidden,false);
  assert.ok(f.draws.some(x=>x.method==='fillText'));
  assert.ok(f.classNames.has('unfire-map-open'));
  assert.equal(f.state.onOpen,1);
  const canvas=f.selectors.get('#ufMapCanvas');
  assert.ok(canvas.width*canvas.height<=1500000+4000,'limit map bitmap for mobile GPU memory');
  f.api.hide();const n=f.draws.length;f.api.tick();
  assert.equal(f.draws.length,n,'no redraw after closing');
  assert.equal(f.container.child.hidden,true);
  assert.ok(!f.classNames.has('unfire-map-open'));
  f.api.show();assert.equal(f.doc.body.child, f.container.child,'one persistent overlay');
});
test('touch drag, zoom and escape close without exiting roaming',()=>{
  const f=fixture(860,420);f.api.show();
  const cv=f.selectors.get('#ufMapCanvas');
  const n=f.draws.length;
  cv.fire('pointerdown',{pointerId:1,clientX:100,clientY:100});
  cv.fire('pointermove',{pointerId:1,clientX:120,clientY:120});
  assert.ok(f.draws.length>n,'panning redraws');
  cv.fire('pointerdown',{pointerId:2,clientX:200,clientY:200});
  cv.fire('pointermove',{pointerId:2,clientX:220,clientY:220});
  cv.fire('pointerup',{pointerId:1});cv.fire('pointerup',{pointerId:2});
  const before=f.draws.length;f.selectors.get('#ufMapPlus').fire('click');
  assert.ok(f.draws.length>before,'zoom redraws');
  f.selectors.get('#ufMapCenter').fire('click');
  let key={key:'Escape',preventDefault(){this.pd=true;},stopImmediatePropagation(){this.sip=true;}};
  for(const fn of f.handlers.get('keydown'))fn(key);
  assert.equal(f.api.isOpen,false);assert.ok(key.pd&&key.sip,'escape consumed before engine');
  f.api.show();f.selectors.get('#ufMapClose').fire('click');
  assert.equal(f.api.isOpen,false,'close button works');
});
test('map handles three gameplay zones and mission marker without an external library',()=>{
  const f=fixture(320,420);f.api.show();
  for (const zone of ['house','table','island']) {
    f.state.zone=zone;
    f.api.tick();
    assert.ok(f.draws.some(x=>x.method==='strokeRect'));
  }
  assert.equal(f.selectors.get('#ufMapBadge').textContent,'LA ISLA');
  assert.match(js,/objective/);
  assert.doesNotMatch(js,/new THREE\.|requestAnimationFrame|setInterval|fetch\(|XMLHttpRequest/);
});
test('integration, CSS mobile safe areas and atomic host/engine cache',()=>{
  assert.match(engine,/c\.addEventListener\('click', e =>.*expanded\.show\(\)/);
  assert.match(engine,/const expanded = window\.UnfireExpandedMap/);
  assert.match(engine,/if \(expanded\.isOpen\) for \(const k in ROAMS\.k\)/);
  assert.match(engine,/if \(!MAP\.expandedOpen\) S\.renderer\.render\(S\.scene, cam\)/, 'no WebGL render while 2D map is open');
  assert.match(engine,/if \(MAP\.expandedOpen \|\| \(window\.UNFIRE_COINS && window\.UNFIRE_COINS\.isOpen\) \|\| storyMenuOpen\) \{[\s\S]*?clock\.getDelta\(\);[\s\S]*?if \(MAP\.expandedOpen\) MAP\.tick\(\);[\s\S]*?return;/, 'suspend heavy 3D updates under full map, modal shop or story menu');
  assert.match(iframe,/expanded-map\.css\?v=20261027fix1/);
  assert.match(iframe,/expanded-map\.js\?v=20261027fix1/);
  assert.match(iframe,/game-engine-v50\.js\?v=20261027fix1/);
  assert.match(host,/maletin\/index\.html\?v=20261027fix1/);
  assert.match(css,/safe-area-inset-top/);
  assert.match(css,/max-height:430px/);
  assert.match(css,/touch-action:none/);
  assert.match(css,/body\.unfire-map-open #unfireTouchPad/);
});

test('removed robot ship does not appear on either map',()=>{
 const f=fixture(390,660);f.api.show();
 assert.equal(f.draws.filter(d=>d.method==='fillText'&&d.args[0]==='🛸').length,0);
 assert.equal(f.selectors.has('#ufMapShip'),false);
 assert.doesNotMatch(js,/ufMapShip|ROBOT-NAVE|🛸/);
 assert.doesNotMatch(engine,/lunarShip|titan-ship|fillText\('🛸'/);
 assert.doesNotMatch(iframe,/lunar-world\.js/);
});
test('short landscape map stays compact without spaceship UI',()=>{
 assert.match(css,/@media \(max-height:430px\)/);
 assert.doesNotMatch(css,/#ufMapShip/);
});
