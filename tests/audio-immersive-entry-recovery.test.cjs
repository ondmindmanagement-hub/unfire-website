'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const html=fs.readFileSync(path.join(__dirname,'../audio/index.html'),'utf8');
const start=html.indexOf('const Snd={mal:false');
const end=html.indexOf('/* ================= Precios',start);
assert(start>0&&end>start,'The actual host game immersion controller must exist');
const source=html.slice(start,end)+'\n;globalThis.__testMal=Mal;';

function createHost(options={}){
  const docHandlers=new Map(),winHandlers=new Map(),messages=[];
  const classes=()=>{const s=new Set();return {
    add:(...names)=>names.forEach(name=>s.add(name)),
    remove:(...names)=>names.forEach(name=>s.delete(name)),
    contains:name=>s.has(name),
    toggle:(name,on)=>{if(on===undefined? !s.has(name):on)s.add(name);else s.delete(name);}
  }};
  const element=(id)=>({
    id,classList:classes(),style:{},hidden:id==='unfireRestoreFullscreen',
    handlers:{},offsetTop:0,offsetHeight:800,
    addEventListener(name,callback){(this.handlers[name]??=[]).push(callback)},
    click(){for(const cb of this.handlers.click||[])cb({preventDefault(){},stopPropagation(){}})},
    getBoundingClientRect(){return {left:0,top:0,right:390,bottom:844,width:390,height:844}},
    scrollIntoView(){this.scrolled=true}
  });
  const els=new Map();
  for(const id of ['malFrame','heroPin','hero','heroCopy','unfireReturnPlay','unfireRestoreFullscreen','unfireCaseFirstFrame','instrumentos'])els.set(id,element(id));
  const frame=els.get('malFrame');
  frame.contentWindow={postMessage:(message)=>messages.push(message)};
  const document={
    body:{classList:classes()},
    documentElement:{classList:classes()},
    hidden:false,fullscreenElement:null,webkitFullscreenElement:null,
    addEventListener(name,cb){(docHandlers.get(name)??(docHandlers.set(name,[]),docHandlers.get(name))).push(cb)},
    getElementById:id=>els.get(id)||null,
    querySelectorAll:()=>[],
    exitFullscreen(){this.fullscreenElement=null;emitDoc('fullscreenchange');return Promise.resolve()}
  };
  if(options.noWebgl)document.documentElement.classList.add('no-webgl');
  function emitDoc(name){for(const cb of docHandlers.get(name)||[])cb()}
  function emitWindow(name){for(const cb of winHandlers.get(name)||[])cb()}
  const pin=els.get('heroPin');
  let nativeRequests=0;
  pin.requestFullscreen=()=>{
    nativeRequests++;
    document.fullscreenElement=pin;
    emitDoc('fullscreenchange');
    return Promise.resolve();
  };
  const scene={starts:0,start(){this.starts++},isReady:()=>true,onReady(cb){cb()}};
  const context={
    document,location:{origin:"https://unfire.technology"},HTMLDialogElement:class HTMLDialogElement{showModal(){}},UNFIRE_SCENE:scene,
    addEventListener(name,cb){(winHandlers.get(name)??(winHandlers.set(name,[]),winHandlers.get(name))).push(cb)},
    requestAnimationFrame(cb){cb()},
    scrollY:0,innerHeight:844,performance:{now:()=>1000},
    matchMedia:()=>({matches:false}),
    CaseSfx:{play(){}},
    $:name=>els.get(name.slice(1)),
    console
  };
  context.window=context;
  vm.runInNewContext(source,context,{timeout:1500});
  return {document,context,els,scene,messages,emitDoc,emitWindow,nativeRequests:()=>nativeRequests,Mal:context.__testMal};
}

test('direct visit to Audio shows the real 3D game viewport without opening lid automatically',()=>{
  const h=createHost();
  assert(h.document.body.classList.contains('immOn'));
  assert(h.document.documentElement.classList.contains('immOn'));
  assert(h.els.get('heroPin').classList.contains('imm'));
  assert.equal(h.scene.starts,1);
  assert.equal(h.nativeRequests(),0,'native fullscreen requires a user gesture');
  assert(!h.messages.some(m=>m.entryStart),'case lid remains a player decision');
  assert.equal(h.els.get('unfireRestoreFullscreen').hidden,true);
});

test('first deliberate case action still enters game from automatic immersion',()=>{
  const h=createHost();
  h.context.window.__UNFIRE_ENTER_CASE();
  assert.equal(h.nativeRequests(),1,'native fullscreen only from a case gesture');
  assert(h.messages.some(m=>m.entryStart),'case click must initiate real entry sequence');
  assert(h.document.body.classList.contains('immOn'));
});

test('browser Escape/native fullscreen loss keeps game and allows restoring fullscreen',()=>{
  const h=createHost();
  h.context.window.__UNFIRE_ENTER_CASE();
  assert(h.document.fullscreenElement);
  h.document.fullscreenElement=null;
  h.emitDoc('fullscreenchange');
  assert(h.document.body.classList.contains('immOn'));
  assert(h.els.get('heroPin').classList.contains('imm'));
  assert.equal(h.els.get('unfireRestoreFullscreen').hidden,false);
  h.els.get('unfireRestoreFullscreen').click();
  assert.equal(h.nativeRequests(),2);
  assert.equal(h.els.get('unfireRestoreFullscreen').hidden,true);
});

test('orientation change, returning to tab and pageshow repair CSS immersion',()=>{
  const h=createHost();
  h.document.body.classList.remove('immOn');
  h.document.documentElement.classList.remove('immOn');
  h.els.get('heroPin').classList.remove('imm');
  h.emitWindow('orientationchange');
  assert(h.document.body.classList.contains('immOn'));
  assert(h.document.documentElement.classList.contains('immOn'));
  h.document.body.classList.remove('immOn');
  h.emitWindow('pageshow');
  assert(h.document.body.classList.contains('immOn'));
  assert.equal(h.nativeRequests(),0,'no spurious native fullscreen request');
});

test('explicit exit is the only route to website and does not auto-reactivate',async()=>{
  const h=createHost();
  h.context.window.__UNFIRE_ENTER_CASE();
  h.document.fullscreenElement=null;
  h.emitDoc('fullscreenchange');
  assert.equal(h.els.get('unfireRestoreFullscreen').hidden,false);
  h.Mal.exitGame();
  assert(!h.document.body.classList.contains('immOn'));
  assert(h.els.get('heroPin').classList.contains('web-return'));
  assert.equal(h.els.get('unfireRestoreFullscreen').hidden,true);
  h.emitWindow('pageshow');
  h.emitWindow('focus');
  assert(!h.document.body.classList.contains('immOn'),'pageshow must never override explicit user exit');
  await Promise.resolve();await Promise.resolve();
  assert(h.els.get('instrumentos').scrolled,'exit navigates to the actual product site');
});

test('WebGL unsupported preserves the existing accessible website fallback',()=>{
  const h=createHost({noWebgl:true});
  assert.equal(h.scene.starts,0);
  assert(!h.document.body.classList.contains('immOn'));
  assert.equal(h.nativeRequests(),0);
});

test('host keeps one intentional exit from engine and fallback recovery is accessible',()=>{
  assert(html.includes('if(d.exitGame){caseLocal=false;Mal.exitGame();}'));
  assert.match(html,/<button id="unfireRestoreFullscreen" type="button" hidden aria-label="Volver a pantalla completa sin reiniciar el juego">/);
  assert.match(html,/#unfireRestoreFullscreen\[hidden\]\{display:none!important\}/);
  assert.match(html,/Mal\.bootImmersiveCase\(\)/);
  assert.match(html,/id="unfireReturnPlay"/);
  assert.match(html,/webReturn=true;parked=1/);
});
