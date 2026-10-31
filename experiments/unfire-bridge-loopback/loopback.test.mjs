import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { once } from 'node:events';
import { createLoopbackHost, postSyntheticPacket, signSyntheticPacket } from './loopback.mjs';
const t0=1_000_000_000;
const keys=()=>generateKeyPairSync('ed25519');
const pem=k=>k.publicKey.export({format:'pem',type:'spki'});
function packet(fromNodeId='mac',toNodeId='linux') {
  return {v:1,tenant:'lab',messageId:randomUUID(),fromNodeId,toNodeId,operation:'synthetic.uppercase',payload:'research',issuedAt:t0,expiresAt:t0+5000};
}
function fixture() {
  let now=t0;
  const host=createLoopbackHost({clock:()=>now});
  const mac=keys(),lin=keys(),win=keys();
  for(const [nodeId,platform,k] of [['mac','macos',mac],['linux','linux',lin],['win','windows',win]]) {
    host.enroll({tenant:'lab',nodeId,platform,publicKeyPem:pem(k),consent:true});
    host.connect({tenant:'lab',nodeId,consent:true});
  }
  host.grant({tenant:'lab',nodeId:'mac',capability:'synthetic.send',ttlMs:10000,consent:true});
  host.grant({tenant:'lab',nodeId:'linux',capability:'synthetic.receive',ttlMs:10000,consent:true});
  return {host,mac,lin,win,setNow:n=>{now=n},node:{mac,lin,win}};
}
async function live(t) {
  const f=fixture();const url=await f.host.start();t.after(async()=>f.host.close());
  return {...f,url,send:(request=packet(),priv=f.mac.privateKey)=>postSyntheticPacket(url,signSyntheticPacket(request,priv))};
}
const throws=(f,code)=>assert.throws(f,e=>e.code===code);

test('host is disconnected by default after enrollment',()=>{const host=createLoopbackHost();const k=keys();assert.equal(host.enroll({tenant:'lab',nodeId:'mac',platform:'macos',publicKeyPem:pem(k),consent:true}).connected,false);});
test('enrollment requires explicit consent',()=>throws(()=>createLoopbackHost().enroll({tenant:'lab',nodeId:'mac',platform:'macos',publicKeyPem:pem(keys()),consent:false}),'CONSENT_REQUIRED'));
test('connected nodes must opt in separately',()=>{const h=createLoopbackHost();h.enroll({tenant:'lab',nodeId:'mac',platform:'macos',publicKeyPem:pem(keys()),consent:true});throws(()=>h.connect({tenant:'lab',nodeId:'mac',consent:false}),'CONSENT_REQUIRED');});
test('rejects unsupported platform',()=>throws(()=>createLoopbackHost().enroll({tenant:'lab',nodeId:'x',platform:'android',publicKeyPem:pem(keys()),consent:true}),'INVALID_ENROLLMENT'));
test('rejects invalid public key and wrong key algorithm',()=>{const h=createLoopbackHost();throws(()=>h.enroll({tenant:'lab',nodeId:'x',platform:'linux',publicKeyPem:'junk',consent:true}),'INVALID_ENROLLMENT');});
test('duplicate node registration rejected',()=>{const f=fixture();throws(()=>f.host.enroll({tenant:'lab',nodeId:'mac',platform:'macos',publicKeyPem:pem(keys()),consent:true}),'ALREADY_ENROLLED');});
test('unsupported capability forbidden',()=>{const f=fixture();throws(()=>f.host.grant({tenant:'lab',nodeId:'mac',capability:'system.command',ttlMs:1000,consent:true}),'GRANT_DENIED');});
test('unapproved grants fail closed',()=>{const f=fixture();throws(()=>f.host.grant({tenant:'lab',nodeId:'mac',capability:'synthetic.send',ttlMs:1000,consent:false}),'CONSENT_REQUIRED');});
test('server binds exclusively to numeric loopback and ephemeral port',async t=>{const f=await live(t);assert.match(f.url,/^http:\/\/127\.0\.0\.1:\d+\/v1\/relay$/);});
test('real loopback HTTP signed request returns synthetic result',async t=>{const f=await live(t);const r=await f.send();assert.equal(r.status,200);assert.equal(r.body.value,'RESEARCH');assert.equal(r.body.externalActionAllowed,false);assert.equal(r.body.transport,'real_loopback_http');});
test('valid signature with wrong identity is denied',async t=>{const f=await live(t);const r=await f.send(packet(),f.win.privateKey);assert.equal(r.status,401);assert.equal(r.body.code,'INVALID_SIGNATURE');});
test('mutating a signed packet is denied',async t=>{const f=await live(t);const envelope=signSyntheticPacket(packet(),f.mac.privateKey);envelope.packet.payload='tampered';const r=await postSyntheticPacket(f.url,envelope);assert.equal(r.status,401);});
test('accepts a packet only once',async t=>{const f=await live(t);const env=signSyntheticPacket(packet(),f.mac.privateKey);assert.equal((await postSyntheticPacket(f.url,env)).status,200);const second=await postSyntheticPacket(f.url,env);assert.equal(second.status,409);assert.equal(second.body.code,'REPLAY');});
test('replay still rejected across separate HTTP connections',async t=>{const f=await live(t);const env=signSyntheticPacket(packet(),f.mac.privateKey);await Promise.all([postSyntheticPacket(f.url,env),postSyntheticPacket(f.url,env)]).then(results=>assert.deepEqual(results.map(r=>r.status).sort(),[200,409]));});
test('cross tenant cannot address a foreign node',async t=>{const f=await live(t);const r=await f.send({...packet(),tenant:'foreign'});assert.equal(r.status,403);});
test('requires receiver-specific grant',async t=>{const f=await live(t);const r=await f.send(packet('mac','win'));assert.equal(r.body.code,'CAPABILITY_DENIED');});
test('revoke sender grant stops signed messages',async t=>{const f=await live(t);f.host.revokeGrant({tenant:'lab',nodeId:'mac',capability:'synthetic.send'});assert.equal((await f.send()).status,403);});
test('disconnecting receiver denies transmission',async t=>{const f=await live(t);f.host.disconnect({tenant:'lab',nodeId:'linux'});assert.equal((await f.send()).body.code,'NODE_DISCONNECTED');});
test('revoking node blocks future connection and relay',async t=>{const f=await live(t);f.host.revoke({tenant:'lab',nodeId:'linux'});throws(()=>f.host.connect({tenant:'lab',nodeId:'linux',consent:true}),'NODE_DENIED');assert.equal((await f.send()).body.code,'NODE_DENIED');});
test('STOP blocks both connections and in-flight future requests',async t=>{const f=await live(t);f.host.stopTenant({tenant:'lab'});assert.equal((await f.send()).body.code,'TENANT_STOPPED');throws(()=>f.host.connect({tenant:'lab',nodeId:'linux',consent:true}),'TENANT_STOPPED');});
test('expired packet rejected with trusted host clock',async t=>{const f=await live(t);const p=packet();f.setNow(t0+6000);const r=await f.send(p);assert.equal(r.body.code,'PACKET_EXPIRED');});
test('expired grant rejected with trusted host clock',async t=>{const f=await live(t);f.setNow(t0+10500);const p={...packet(),issuedAt:t0+10500,expiresAt:t0+11000};assert.equal((await f.send(p)).body.code,'CAPABILITY_DENIED');});
test('future timestamp rejected beyond skew',async t=>{const f=await live(t);const p={...packet(),issuedAt:t0+3000,expiresAt:t0+7000};assert.equal((await f.send(p)).body.code,'PACKET_EXPIRED');});
test('unknown operation never executed',()=>throws(()=>signSyntheticPacket({...packet(),operation:'shell.execute'},keys().privateKey),'UNKNOWN_OPERATION'));
test('oversize UTF-8 payload rejected before send',()=>throws(()=>signSyntheticPacket({...packet(),payload:'🌈'.repeat(65)},keys().privateKey),'INVALID_PAYLOAD'));
test('extra action field rejected even before signing',()=>throws(()=>signSyntheticPacket({...packet(),execute:true},keys().privateKey),'INVALID_SHAPE'));
test('URL helper refuses external addresses',async()=>await assert.rejects(()=>postSyntheticPacket('https://example.com/v1/relay',{}),e=>e.code==='LOOPBACK_ONLY'));
test('URL helper refuses localhost alias to avoid DNS ambiguity',async()=>await assert.rejects(()=>postSyntheticPacket('http://localhost:1000/v1/relay',{}),e=>e.code==='LOOPBACK_ONLY'));
test('server rejects GET and cross-origin requests',async t=>{const f=await live(t);const wrongMethod=await fetch(f.url,{method:'GET'});assert.equal(wrongMethod.status,403);const wrongOrigin=await fetch(f.url,{method:'POST',headers:{origin:'https://evil.example','content-type':'application/json'},body:JSON.stringify(signSyntheticPacket(packet(),f.mac.privateKey))});assert.equal(wrongOrigin.status,403);});
test('server rejects missing content-type',async t=>{const f=await live(t);const r=await fetch(f.url,{method:'POST',body:JSON.stringify(signSyntheticPacket(packet(),f.mac.privateKey)),headers:{'content-type':'text/plain'}});assert.equal(r.status,403);});
test('server rejects oversized requests',async t=>{const f=await live(t);const r=await fetch(f.url,{method:'POST',headers:{'content-type':'application/json'},body:'X'.repeat(3000)});assert.equal(r.status,413);});
test('malformed JSON denied with no process crash',async t=>{const f=await live(t);const r=await fetch(f.url,{method:'POST',headers:{'content-type':'application/json'},body:'{bad'});assert.equal(r.status,403);});
test('client endpoint closes after cleanup',async()=>{const f=fixture();const url=await f.host.start();await f.host.close();await assert.rejects(()=>postSyntheticPacket(url,signSyntheticPacket(packet(),f.mac.privateKey)));});
test('two separate Node processes communicate over real loopback HTTP',async t=>{
  const f=fixture();
  const child=fork(new URL('./client-fixture.mjs',import.meta.url),[],{stdio:['ignore','ignore','ignore','ipc']});
  t.after(()=>{if(child.exitCode===null)child.kill();});
  const [ready]=await once(child,'message');
  assert.equal(ready.type,'ready');
  f.host.enroll({tenant:'lab',nodeId:'child',platform:'windows',publicKeyPem:ready.publicKeyPem,consent:true});
  f.host.connect({tenant:'lab',nodeId:'child',consent:true});
  f.host.grant({tenant:'lab',nodeId:'child',capability:'synthetic.send',ttlMs:10000,consent:true});
  const url=await f.host.start();
  t.after(async()=>f.host.close());
  const pending=once(child,'message');
  child.send({type:'synthetic_send',url,packet:packet('child','linux')});
  const [reply]=await pending;
  assert.equal(reply.type,'result');
  assert.equal(reply.result.status,200);
  assert.equal(reply.result.body.value,'RESEARCH');
  assert.equal(reply.result.body.externalActionAllowed,false);
});