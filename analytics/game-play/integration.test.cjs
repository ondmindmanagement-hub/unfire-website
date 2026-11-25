'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const collect=fs.readFileSync(path.join(__dirname,'collector.js'),'utf8');
const load=fs.readFileSync(path.join(__dirname,'loader.js'),'utf8');
test('end-to-end: no pageview or game events until approved, then one play session; revoke blocks future events',()=>{
 const events=[],scripts=[],handlers={},docHandlers={};
 let clock=0;
 const document={
  hidden:false,
  head:{appendChild(script){scripts.push(script);}},
  createElement(tag){assert.equal(tag,'script');return {
   attrs:{},setAttribute(k,v){this.attrs[k]=v;}
  };},
  addEventListener(n,f){docHandlers[n]=f;}
 };
 const w={
  document,
  navigator:{doNotTrack:'0',globalPrivacyControl:false},
  location:{protocol:'https:',hostname:'unfire.technology'},
  performance:{now:()=>clock},
  addEventListener(n,f){handlers[n]=f;},
  __UNFIRE_ANALYTICS_APPROVED:false,
  __UNFIRE_ANALYTICS_RELEASE_APPROVED:false,
  __UNFIRE_ANALYTICS_PRIVACY_GATE:false,
  umami:{track(name,data){events.push({name:name||'pageview',data});return Promise.resolve();}}
 };
 const context={window:w};vm.runInNewContext(load,context);vm.runInNewContext(collect,context);
 const m=w.UnfirePlayMetrics,loader=w.UnfirePlayMetricsLoader;
 const id='a94ad70d-d2ed-458d-85e6-8a14fd128e6d';
 assert.equal(loader.enable(id),false);assert.equal(scripts.length,0);
 w.__UNFIRE_ANALYTICS_RELEASE_APPROVED=true;
 w.__UNFIRE_ANALYTICS_PRIVACY_GATE=true;
 assert.equal(loader.enable(id),true);
 assert.equal(events.length,0);
 assert.equal(scripts.length,1);
 scripts[0].onload();
 assert.deepEqual(events.map(e=>e.name),['pageview']);
 assert.equal(m.start(),true);
 clock+=61000;
 assert.equal(m.end(),true);
 assert.deepEqual(events.map(e=>e.name),['pageview','unfire_game_start','unfire_game_end']);
 assert.equal(events[2].data.duration_bucket,'1_to_5m');
 loader.revoke();
 assert.equal(m.start(),false);
 assert.equal(m.end(),false);
 assert.equal(events.length,3);
 handlers.pagehide();
});
