'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const html=fs.readFileSync(path.join(__dirname,'../audio/index.html'),'utf8');
const start=html.indexOf('const Snd={mal:false'),end=html.indexOf('/* ================= Precios',start);
assert(start>0&&end>start,'Live Mal controller unavailable');
const source=html.slice(start,end)+'\n;globalThis.__cinematicMal=Mal;';

function fixture({loaded=true,reduced=false,native=true}={}){
  const trace=[],elements=new Map(),winHandlers=new Map(),docHandlers=new Map(),queue=[];
  let width=390,height=844,ready=loaded;
  const classes=()=>{
    const members=new Set();
    return {
      add:(...v)=>v.forEach(k=>members.add(k)),
      remove:(...v)=>v.forEach(k=>members.delete(k)),
      contains:k=>members.has(k),
      toggle:(k,on)=>{if(on===undefined?!members.has(k):on)members.add(k);else members.delete(k)}
    };
  };
  const element=id=>{
    const e={
      id,style:{},classList:classes(),offsetTop:0,offsetHeight:800,hidden:id==='unfireRestoreFullscreen',events:{},
      addEventListener:(n,f)=>{(e.events[n]??=[]).push(f)},
      click:()=>{(e.events.click||[]).forEach(f=>f({preventDefault(){}}))},
      getBoundingClientRect:()=>{
        const p=e.classList.contains('unfire-case-preview');
        const imm=e.classList.contains('imm');
        const factor=imm&&p?(width<=700?.92:.88):1;
        const w=width*factor,h=height*factor;
        return {left:(width-w)/2,top:(height-h)/2,width:w,height:h,bottom:(height+h)/2};
      },
      scrollIntoView:()=>trace.push('scroll-web'),
      animate:(keyframes,config)=>{
        trace.push({id,type:'animate',keyframes,config});
        return {finished:Promise.resolve(),cancel(){trace.push({type:'cancel',id})}};
      }
    };
    return e;
  };
  for(const id of ['malFrame','heroPin','hero','heroCopy','unfireReturnPlay','unfireRestoreFullscreen','unfireCaseFirstFrame','instrumentos'])elements.set(id,element(id));
  elements.get('malFrame').contentWindow={postMessage:message=>{trace.push({type:'message',message})}};
  const document={
    body:{classList:classes()},documentElement:{classList:classes()},hidden:false,fullscreenElement:null,
    addEventListener:(n,f)=>{(docHandlers.get(n)??(docHandlers.set(n,[]),docHandlers.get(n))).push(f)},
    getElementById:id=>elements.get(id)||null,
    querySelectorAll:()=>[],
    exitFullscreen(){this.fullscreenElement=null;return Promise.resolve();}
  };
  const emit=(name)=>{(winHandlers.get(name)||[]).forEach(f=>f());};
  const pin=elements.get('heroPin');
  if(native)pin.requestFullscreen=()=>{document.fullscreenElement=pin;trace.push({type:'native-fullscreen'});return Promise.resolve()};
  const scene={starts:0,start(){this.starts++},isReady(){return ready},onReady(fn){queue.push(fn)}};
  const context={
    document,location:{origin:'https://unfire.technology'},
    HTMLDialogElement:class{showModal(){}},
    UNFIRE_SCENE:scene,
    addEventListener:(n,f)=>{(winHandlers.get(n)??(winHandlers.set(n,[]),winHandlers.get(n))).push(f)},
    requestAnimationFrame:cb=>cb(),performance:{now:()=>1000},
    scrollY:0,innerHeight:height,innerWidth:width,
    matchMedia:()=>({matches:reduced}),CaseSfx:{play(){}},
    $:sel=>elements.get(sel.slice(1)),console
  };
  context.window=context;
  vm.runInNewContext(source,context,{timeout:2000});
  return {
    document,elements,trace,scene,context,emit,
    resize(w,h){width=w;height=h;context.innerWidth=w;context.innerHeight=h;emit('resize')},
    ready(){ready=true;queue.splice(0).forEach(fn=>fn())},
    tap(){context.__UNFIRE_ENTER_CASE()},
    messages(){return trace.filter(x=>x.type==='message').map(x=>x.message)},
    animations(id){return trace.filter(x=>x.type==='animate'&&x.id===id)}
  };
}

test('direct boot retains preview on the SAME page until case tap',()=>{
  const h=fixture();
  assert(h.document.body.classList.contains('immOn'));
  assert(h.elements.get('heroPin').classList.contains('unfire-case-preview'));
  assert.equal(h.scene.starts,1);
  assert(!h.messages().some(m=>m.entryStart));
  assert(!source.includes('window.open('),'The case-opening controller never creates another tab');
});
test('first tap synchronizes 1.05-second zoom with the actual lid opening',()=>{
  const h=fixture();
  h.tap();
  const animation=h.animations('heroPin')[0];
  assert(animation);
  assert.equal(animation.config.duration,1050);
  assert.match(animation.config.easing,/cubic-bezier/);
  const opened=h.messages().filter(m=>m.entryStart);
  assert.equal(opened.length,1);
  assert(h.trace.findIndex(x=>x===animation)<h.trace.findIndex(x=>x.type==='message'&&x.message.entryStart));
  assert(!h.elements.get('heroPin').classList.contains('unfire-case-preview'));
  assert(h.document.body.classList.contains('immOn'));
  h.tap();
  assert.equal(h.messages().filter(m=>m.entryStart).length,1,'No duplicate lid sound/animation');
});
test('slow 3D boot holds preview and starts animation only once ready',()=>{
  const h=fixture({loaded:false});
  h.tap();
  assert(h.elements.get('heroPin').classList.contains('unfire-case-preview'));
  assert.equal(h.animations('heroPin').length,0);
  assert(!h.messages().some(m=>m.entryStart));
  h.ready();
  assert.equal(h.animations('heroPin').length,1);
  assert.equal(h.messages().filter(m=>m.entryStart).length,1);
});
test('portrait-to-landscape and back smooth iframe without recreating game',()=>{
  const h=fixture();h.tap();
  const starts=h.scene.starts;
  h.resize(844,390);
  assert.equal(h.animations('malFrame').length,1);
  assert.equal(h.animations('malFrame')[0].config.duration,320);
  h.resize(820,390);
  assert.equal(h.animations('malFrame').length,1,'Only orientation flip animates');
  h.resize(390,844);
  assert.equal(h.animations('malFrame').length,2);
  assert.equal(h.scene.starts,starts);
  assert(h.document.body.classList.contains('immOn'));
});
test('reduced-motion skips scale effects but still plays game',()=>{
  const h=fixture({reduced:true});h.tap();
  assert.equal(h.animations('heroPin').length,0);
  h.resize(844,390);
  assert.equal(h.animations('malFrame').length,0);
  assert.equal(h.messages().filter(m=>m.entryStart).length,1);
});
test('iPhone style without native fullscreen stays in CSS viewport',()=>{
  const h=fixture({native:false});h.tap();h.resize(844,390);
  assert(h.document.documentElement.classList.contains('immOn'));
  assert.equal(h.messages().filter(m=>m.entryStart).length,1);
  assert(!h.trace.some(x=>x.type==='native-fullscreen'));
});
test('user exit prevents rotation from reopening the game or website loop',async()=>{
  const h=fixture();h.tap();h.context.__cinematicMal.exitGame();
  h.resize(844,390);
  assert(!h.document.body.classList.contains('immOn'));
  assert.equal(h.animations('malFrame').length,0);
  await Promise.resolve();await Promise.resolve();
  assert(h.elements.get('heroPin').classList.contains('web-return'));
});
test('source preserves dynamic viewport safe-area and actual 3D, never forces orientation',()=>{
  assert.match(html,/width:100dvw!important/);
  assert.match(html,/height:100dvh!important/);
  assert.match(html,/env\(safe-area-inset-top\)/);
  assert.match(html,/entryStart:true/);
  assert(!html.includes('screen.orientation.lock('));
});
