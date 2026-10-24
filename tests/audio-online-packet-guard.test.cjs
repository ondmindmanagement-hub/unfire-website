'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const engine=fs.readFileSync(path.join(__dirname,'../audio/maletin/game-engine-v50.js'),'utf8');
const begin=engine.indexOf('    function safePacket(raw, c) {');
const end=engine.indexOf('    function setup(c)',begin);
assert.ok(begin>0&&end>begin,'packet guard exists before any PeerJS setup');
const guard=engine.slice(begin,end);
const colorList=['#3d8bff','#ff2fb0','#2bd96b','#ffd21a','#ff7a1f','#9b6bff','#ffffff','#222222'];
const base={id:'player-1',n:'Robot Player',c:'#3d8bff',t:4,x:100,z:80,h:5,y:1.4,sc:2,f:1,o:1,m:1,v:0,q:1};
const c={peer:'player-1'};
function check(raw,{host=true,peers=0,conn=c}={}){
 const R=Object.create(null);
 for(let i=0;i<peers;i++)R['peer-'+i]={};
 const sandbox={raw,c:conn,isHost:host,R,MUTANTS:{list:Array.from({length:20},()=>({}))},COLS:colorList,result:undefined};
 vm.runInNewContext(guard+';result=safePacket(raw,c);',sandbox,{timeout:350});
 return sandbox.result?JSON.parse(JSON.stringify(sandbox.result)):null;
}
test('valid robot state is accepted from bound PeerJS sender',()=>{
 assert.deepEqual(check(base),base);
});
test('spoofed identity cannot be relayed to other guests by the host',()=>{
 assert.equal(check({...base,id:'player-2'}),null);
 assert.ok(check({...base,id:'player-2'},{host:false}),'guest receives relayed peer state from its trusted host connection');
});
test('prototype keys, unsafe identifiers and malformed messages never enter remote players map',()=>{
 for(const id of ['__proto__','constructor','prototype','bad key','',42,'x'.repeat(100)])
  assert.equal(check({...base,id}),null,String(id));
 for(const raw of [null,0,'hello',[],{id:'player-1'},Object.create(null)])
  assert.equal(check(raw),null);
 assert.match(engine,/const R = Object\.create\(null\)/);
});
test('NaN/infinite/extreme coordinates and illegal avatar/color are rejected',()=>{
 for(const k of ['x','z','h','y']){
  for(const value of [NaN,Infinity,-Infinity,'3'])
   assert.equal(check({...base,[k]:value}),null,k+': '+value);
 }
 for(const bad of [{x:40000},{z:-30000},{h:15000},{t:-1},{t:200},{t:1.3},{c:'<red>'},{n:{} }])
  assert.equal(check({...base,...bad}),null,JSON.stringify(bad));
});
test('note and goodbye events are bounded and allowed for correct sender only',()=>{
 assert.deepEqual(check({id:'player-1',nt:5}),{id:'player-1',nt:5});
 assert.deepEqual(check({id:'player-1',bye:1}),{id:'player-1',bye:1});
 for(const nt of [-1,30,99,NaN,1.2,'0'])assert.equal(check({id:'player-1',nt}),null);
 assert.equal(check({id:'other',bye:1}),null);
 assert.equal(check({id:'player-1',bye:'yes'}),null);
});
test('input is normalized, name length bounded, excess peers refused',()=>{
 const v=check({...base,n:'A'.repeat(400),sc:Infinity,f:true,o:'yes'});
 assert.equal(v.n.length,20);
 assert.equal(v.sc,0);
 assert.equal(v.f,0);
 assert.equal(v.o,0);
 assert.equal(check(base,{peers:40}),null);
});
test('setup validates BEFORE any side effects or retransmission; throttling per connection',()=>{
 const region=engine.slice(end,engine.indexOf('    function create()',end));
 const sanity=region.indexOf('const d=safePacket(raw,c)');
 const receive=region.indexOf('else recv(d)');
 const relay=region.indexOf('o.send(d)');
 assert.ok(sanity>0 && sanity<receive&&receive<relay);
 assert.match(region,/if\(\+\+rateCount>40\)return/);
 assert.match(region,/if\(!d\|\|d\.id===myId\)return/);
 assert.ok(!region.includes("recv(raw)"));
});
