'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {EventEmitter}=require('node:events');
const fs=require('node:fs');
const src=fs.readFileSync('audio/maletin/game-engine-v50.js','utf8');
const start=src.indexOf('    // Public rooms have predictable P2P identifiers');
const end=src.indexOf('    function join(c0) {',start);
assert.ok(start>0 && end>start);
const source=src.slice(start,end);
function harness(){
 const peers=[],messages=[],setups=[],started=[],timers=[];
 class MockPeer extends EventEmitter{
  constructor(id){super();this.id=id;this.connections=[];this.destroyed=false;peers.push(this);}
  connect(remote){const c=new EventEmitter();c.peer=remote;c.open=false;c.closed=false;
    c.close=()=>{c.closed=true};this.connections.push(c);return c;}
  destroy(){this.destroyed=true;}
 }
 const deps=['Peer','VOICE','uiText','save','applyMe','msg','load','setup','started','rnd','setTimeout','clearTimeout'];
 const build=new Function(...deps,`let peer=null,code=null,myId=null,isHost=false;
 ${source}
 return {create,joinPublic,state:()=>({code,isHost,myId,hostWaiting,joining:!!joining,peer})};`);
 const controls=build(MockPeer,{bindPeer(){}},(en)=>en,()=>{},()=>{},m=>messages.push(m),fn=>fn(),
    c=>setups.push(c),()=>started.push(true),()=> 'QW123',
    (fn,ms)=>{const timer={fn,ms,cancelled:false};timers.push(timer);return timer;},
    timer=>{if(timer)timer.cancelled=true;});
 return {peers,messages,setups,started,timers,...controls};
}
test('public host waits in the lobby until a real second player connects',()=>{
 const h=harness();h.create(true);
 assert.equal(h.peers.length,1);
 assert.equal(h.peers[0].id,'unfire-sala-P0001');
 h.peers[0].emit('open','unfire-sala-P0001');
 assert.equal(h.started.length,0,'not launched alone');
 assert.equal(h.state().hostWaiting,true);
 const conn=new EventEmitter();conn.close=()=>{};
 h.peers[0].emit('connection',conn);conn.emit('open');
 assert.equal(h.setups.length,1);assert.equal(h.started.length,1);
 assert.equal(h.state().hostWaiting,false);
});
test('joining a public room uses actual open connections instead of an imaginary room listing',()=>{
 const h=harness();h.joinPublic();
 assert.equal(h.peers.length,1);
 h.peers[0].emit('open','guest-001');
 assert.equal(h.peers[0].connections.length,8);
 assert.equal(h.started.length,0);
 const live=h.peers[0].connections[2];assert.equal(live.peer,'unfire-sala-P0003');
 live.open=true;live.emit('open');
 assert.equal(h.started.length,1);assert.equal(h.setups[0],live);
 assert.equal(h.state().code,'P0003');
 assert.equal(h.state().joining,false);
 assert.ok(h.peers[0].connections.every(c=>c===live||c.closed));
});
test('if no public room connects, quick match ends in the lobby without creating a solo match',()=>{
 const h=harness();h.joinPublic();h.peers[0].emit('open','guest-002');
 assert.equal(h.timers.length,1);
 h.timers[0].fn();
 assert.equal(h.started.length,0);
 assert.equal(h.peers.length,1,'no surprise host created');
 assert.equal(h.peers[0].destroyed,true);
 assert.equal(h.state().code,null);assert.equal(h.state().joining,false);
 assert.ok(h.messages.some(m=>m.includes('No active public room')));
});
test('occupied public host slots advance without stealing an existing room ID',()=>{
 const h=harness();h.create(true);
 h.peers[0].emit('error',{type:'unavailable-id'});
 assert.equal(h.peers.length,2);
 assert.equal(h.peers[1].id,'unfire-sala-P0002');
 assert.equal(h.peers[0].destroyed,true);
 assert.equal(h.started.length,0);
});
test('manual code joining, public joining and private hosting all remain available',()=>{
 assert.match(src,/function join\(c0\)/);
 assert.match(src,/function joinPublic\(\)/);
 assert.match(src,/function create\(publicRoom=false\)/);
 for(const id of ['onJoin','onFind','onHostPublic','onNew'])
   assert.ok(src.includes(`g('${id}').onclick`),id);
 assert.match(src,/if\(ONLINE.joining\|\|ONLINE.waiting\)ONLINE.leave\(\)/);
});
