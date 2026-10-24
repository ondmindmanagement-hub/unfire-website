'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const src=fs.readFileSync(path.resolve(__dirname,'../audio/maletin/game-engine-v50.js'),'utf8');
const from=src.indexOf('const propLevel = window.ATM_OUT && window.__PROP');
const to=src.indexOf('if (ROAMS.flyT >',from);
assert(from>0&&to>from,'real vertical flight calculation must remain locatable');
const motion=src.slice(from,to);
function step(cfg={}) {
  const out=cfg.out??true, altitude=cfg.h??200;
  const ROAMS={p:{x:cfg.x??200,z:cfg.z??200},h:altitude,climbV:cfg.climb??100,
    flyH:cfg.target??altitude,mini:!!cfg.mini,pitch:0};
  const K=cfg.keys??{' ':true};
  const window={ATM_OUT:out,__PROP:()=>cfg.prop??1,
    __DOME:cfg.dome===false?null:{c:{x:0,y:26.4,z:40},open:cfg.open??0}};
  const vars={ROAMS,K,window,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
    miniFlight:cfg.miniScale??1,fw:cfg.fw??0,fl:cfg.fl??0,
    hov:cfg.fl??22,dt:cfg.dt??1/30,t:0,NANO_SCALE:0.15,Math};
  vm.runInNewContext(motion,vars,{timeout:300});
  return {ROAMS,window};
}
test('real engine keeps levels capped at x20, not x45',()=>{
  assert.match(src,/const LV = \[1, 3, 8, 20\]/);
  assert.doesNotMatch(src,/const LV = \[1, 3, 8, 20, 45\]/);
});
test('ascend faster as selected thrust rises',()=>{
  const a=step({prop:1,climb:100}).ROAMS.flyH;
  const b=step({prop:8,climb:100}).ROAMS.flyH;
  const c=step({prop:20,climb:100}).ROAMS.flyH;
  assert(a<b && b<c,'vertical speed must follow prop selection');
});
test('descend faster away from land or house',()=>{
  const a=step({prop:1,climb:-110,keys:{f:true},h:250}).ROAMS.vy;
  const b=step({prop:20,climb:-110,keys:{f:true},h:250}).ROAMS.vy;
  assert(b<a,'high prop should increase controlled descent away from land');
});
test('near a closed dome, descending player cannot cross a closed roof',()=>{
  const floor=26.4+8.9+6;
  let s={h:65,target:65};
  for(let i=0;i<180;i++){
    const r=step({h:s.h,target:s.target,x:0,z:40,prop:20,climb:-1200,open:0,
      keys:{f:true},dt:1/30}).ROAMS;
    s={h:s.h+r.vy/30,target:r.flyH};
    assert(s.h>=floor-0.5,'hold above dome until petals open');
    assert(r.vy>=-18,'descent is slow over dome');
  }
});
test('opened dome permits controlled passage below roof holding height',()=>{
  const s=step({h:40,target:40,x:0,z:40,prop:20,climb:-1200,open:0.98,keys:{f:true}});
  assert(s.ROAMS.flyH<40,'can approach opened roof');
  assert(s.ROAMS.vy>=-18,'entry remains slow despite high thrust');
});
test('dome braking is local: no remote height restriction',()=>{
  const s=step({h:60,target:60,x:180,z:160,prop:20,climb:-350,open:0,keys:{f:true}});
  assert(s.ROAMS.flyH<45,'outside dome, full descending freedom');
  assert(s.ROAMS.vy<-18);
});
test('ascent through roof is not braked as a descent',()=>{
  const s=step({h:60,target:60,x:0,z:40,prop:20,climb:180,open:0,keys:{' ':true}});
  assert(s.ROAMS.flyH>60);
  assert(s.ROAMS.vy>0);
});
test('landing speed tapers near ground, no instant downward impact',()=>{
  const s=step({h:12,target:12,x:400,z:400,fl:0,prop:20,climb:-1200,keys:{f:true}});
  assert(s.ROAMS.vy>=-12*2.8-0.01);
  assert(s.ROAMS.flyH>=0,'surface is not penetrated by flight target');
});
test('no high propulsion applied when inside house',()=>{
  const a=step({out:false,h:5,target:5,prop:1,climb:10}).ROAMS.flyH;
  const b=step({out:false,h:5,target:5,prop:20,climb:10}).ROAMS.flyH;
  assert.equal(a,b);
});
test('vertical flight remains finite in all profiles',()=>{
  for(const prop of [1,3,8,20]){
    for(const h of [0,36,65,180,1200]){
      const a=step({prop,h,target:h,climb:-1200,keys:{f:true},x:0,z:40}).ROAMS;
      assert(Number.isFinite(a.flyH)&&Number.isFinite(a.vy));
    }
  }
});
