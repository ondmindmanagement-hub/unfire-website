'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const html = fs.readFileSync(path.join(__dirname,'../audio/index.html'),'utf8');
const start = html.indexOf('function rect(d){');
const end = html.indexOf("addEventListener('unfire:scene-error'", start);
assert.ok(start>0 && end>start, 'actual Mal.rect runtime is present');
const fn = html.slice(start,end);
function makeRect({width=320,height=568,coarse=true,fine=false,caseLocal=false,passUntil=0}={}){
  const fr={clientWidth:width,clientHeight:height,style:{clipPath:'inset(100% 100% 100% 100%)',pointerEvents:'none'}};
  const matchMedia=q=>({matches:q==='(pointer:coarse)'?coarse:q==='(pointer:fine)'?fine:false});
  const rect = new Function('fr','caseLocal','performance','passUntil','matchMedia',fn+';return rect;')
    (fr,caseLocal,{now:()=>1000},passUntil,matchMedia);
  return {fr,rect};
}
test('touch phone iframe stays fully hit-testable even if incoming case bounds are stale',()=>{
  const {fr,rect}=makeRect();
  rect({zoom:false,rect:[-400,-200,-200,-40]});
  assert.equal(fr.style.pointerEvents,'auto');
  assert.equal(fr.style.clipPath,'none');
});
test('touch landscape/tablet uses same reliable hit-test',()=>{
  for(const [width,height] of [[844,390],[820,1180],[1024,768]]){
    const {fr,rect}=makeRect({width,height});
    rect({zoom:false,rect:[1,1,3,3]});
    assert.equal(fr.style.clipPath,'none',width+'×'+height);
  }
});
test('desktop mouse keeps preexisting no-clip behavior',()=>{
  const {fr,rect}=makeRect({coarse:false,fine:true});
  rect({zoom:false,rect:[5,5,15,15]});
  assert.equal(fr.style.clipPath,'none');
});
test('legacy non-pointer devices keep bounded iframe clipping',()=>{
  const {fr,rect}=makeRect({coarse:false,fine:false});
  rect({zoom:false,rect:[10,20,210,240]});
  assert.match(fr.style.clipPath,/^inset\(/);
});
test('immersive case and recapture after temporary pass remain unchanged',()=>{
  const {fr,rect}=makeRect({caseLocal:true});
  rect({zoom:false,rect:[0,0,0,0]});
  assert.equal(fr.style.clipPath,'none');
  assert.match(html,/window\.__UNFIRE_ENTER_CASE\s*=\s*\(\)\s*=>\s*open\(1050\)/);
  assert.match(html,/d\.entryRequest/);
});
test('pass-to-page 500ms guard is retained for web navigation',()=>{
  const {fr,rect}=makeRect({passUntil:1500});
  rect({zoom:false,rect:[0,0,100,200]});
  assert.equal(fr.style.pointerEvents,'none');
});
