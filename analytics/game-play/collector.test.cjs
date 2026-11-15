'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'collector.js'),'utf8');
function fixture(o={}){
  let clock=0;const events=[],docHandlers={},windowHandlers={};
  const document={hidden:false,addEventListener(n,fn){docHandlers[n]=fn;}};
  const window={
    document,navigator:Object.assign({globalPrivacyControl:false,doNotTrack:'0'},o.navigator),
    location:{protocol:'https:',hostname:o.hostname||'unfire.technology'},
    __UNFIRE_ANALYTICS_APPROVED:o.approved!==false,
    __UNFIRE_ANALYTICS_RELEASE_APPROVED:o.release!==false,
    __UNFIRE_ANALYTICS_PRIVACY_GATE:o.privacy!==false,
    performance:{now:()=>clock},
    umami:o.tracker===false?undefined:{track(n,p){events.push({name:n,data:p});return Promise.resolve();}},
    addEventListener(n,fn){windowHandlers[n]=fn;}
  };
  vm.runInNewContext(source,{window},{filename:'collector.js'});
  return {window,events,step(ms){clock+=ms;},hide(){document.hidden=true;docHandlers.visibilitychange();},show(){document.hidden=false;docHandlers.visibilitychange();},leave(){windowHandlers.pagehide();}};
}
test('disabled by default without release gate',()=>{
 const f=fixture({approved:false});assert.equal(f.window.UnfirePlayMetrics.start(),false);
 f.window.UnfirePlayMetrics.end();assert.equal(f.events.length,0);
});
test('one game start per entry, buckets active duration',()=>{
 const f=fixture(),m=f.window.UnfirePlayMetrics;
 assert.equal(m.start(),true);assert.equal(m.start(),false);f.step(90000);
 assert.equal(m.end(),true);assert.equal(m.end(),false);
 assert.deepEqual(f.events.map(e=>e.name),['unfire_game_start','unfire_game_end']);
 assert.equal(f.events[1].data.duration_bucket,'1_to_5m');
});
test('page visitor without game entry is not counted as player',()=>{
 const f=fixture();f.step(500000);f.leave();assert.equal(f.events.length,0);
});
test('hidden time excluded from active game duration',()=>{
 const f=fixture(),m=f.window.UnfirePlayMetrics;
 m.start();f.step(40000);f.hide();f.step(900000);f.show();f.step(35000);m.end();
 assert.equal(f.events[1].data.duration_bucket,'1_to_5m');
});
test('privacy preferences suppress events',()=>{
 for(const navigator of [{globalPrivacyControl:true},{doNotTrack:'1'},{msDoNotTrack:'1'}]){
  const f=fixture({navigator});f.window.UnfirePlayMetrics.start();
  f.window.UnfirePlayMetrics.end();assert.equal(f.events.length,0);
 }
});
test('preview and absent vendor cannot transmit',()=>{
 for(const opt of [{hostname:'localhost'},{tracker:false}]){
  const f=fixture(opt);assert.equal(f.window.UnfirePlayMetrics.start(),false);
  f.window.UnfirePlayMetrics.end();assert.equal(f.events.length,0);
 }
});
test('pagehide ends only one event',()=>{
 const f=fixture();f.window.UnfirePlayMetrics.start();f.step(14000);
 f.leave();f.leave();assert.equal(f.events.length,2);
 assert.equal(f.events[1].data.duration_bucket,'under_1m');
});
test('re-entry is a new session, not a unique person',()=>{
 const f=fixture(),m=f.window.UnfirePlayMetrics;
 m.start();m.end();m.start();m.end();
 assert.equal(f.events.filter(e=>e.name==='unfire_game_start').length,2);
});
test('vendor errors are isolated from gameplay',()=>{
 const f=fixture();f.window.umami.track=()=>{throw new Error('blocked');};
 assert.doesNotThrow(()=>{f.window.UnfirePlayMetrics.start();f.window.UnfirePlayMetrics.end();});
});
test('no storage or direct transmission in adapter',()=>{
 assert.doesNotMatch(source,/localStorage|sessionStorage|document\.cookie|sendBeacon|fetch\s*\(|XMLHttpRequest|identify\s*\(|setInterval|new\s+Worker/);
});

test('revocation and release freeze block subsequent game events',()=>{
 const f=fixture(),m=f.window.UnfirePlayMetrics;
 m.start();f.window.__UNFIRE_ANALYTICS_PRIVACY_GATE=false;m.end();
 assert.deepEqual(f.events.map(e=>e.name),['unfire_game_start']);
 const g=fixture(),n=g.window.UnfirePlayMetrics;
 g.window.__UNFIRE_ANALYTICS_RELEASE_APPROVED=false;n.start();n.end();
 assert.equal(g.events.length,0);
});

test('late tracker authorization counts active session from approval, not from earlier play',()=>{
 const f=fixture({approved:false}),m=f.window.UnfirePlayMetrics;
 assert.equal(m.start(),false);
 f.step(600000);
 f.window.__UNFIRE_ANALYTICS_APPROVED=true;
 assert.equal(m.onTrackerReady(),true);
 f.step(65000);
 m.end();
 assert.deepEqual(f.events.map(e=>e.name),['unfire_game_start','unfire_game_end']);
 assert.equal(f.events[1].data.duration_bucket,'1_to_5m');
});
test('entry completed before permission never creates a retroactive player',()=>{
 const f=fixture({approved:false}),m=f.window.UnfirePlayMetrics;
 m.start();f.step(23000);m.end();
 f.window.__UNFIRE_ANALYTICS_APPROVED=true;
 assert.equal(m.onTrackerReady(),false);
 assert.equal(f.events.length,0);
});
