import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openDurablePolicy } from './durable-policy.mjs';

const F1='A'.repeat(64), F2='B'.repeat(64), F3='C'.repeat(64);
const fail=(fn,code)=>assert.throws(fn,e=>e.code===code);
function setup(t) {
  const dir=mkdtempSync(join(tmpdir(),'unfire-bridge-durable-'));
  const dbPath=join(dir,'metadata.sqlite');
  const store=openDurablePolicy({dbPath});
  // Windows requires releasing SQLite handles before removing a temporary DB.
  t.after(()=>{
    store.close();
    rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:50});
  });
  for(const [nodeId,platform,fingerprint] of [['mac','macos',F1],['win','windows',F2],['linux','linux',F3]]) {
    store.enroll({tenant:'school',nodeId,platform,fingerprint,approved:true});
    store.connect({tenant:'school',nodeId,approved:true});
  }
  store.issueGrant({tenant:'school',nodeId:'mac',grantId:'grant-send',capability:'synthetic.send',now:1000,expiresAt:1500,approved:true});
  store.issueGrant({tenant:'school',nodeId:'linux',grantId:'grant-receive',capability:'synthetic.receive',now:1000,expiresAt:1500,approved:true});
  const packet={tenant:'school',messageId:'m1',fromNodeId:'mac',toNodeId:'linux',fingerprint:F1,
    sendGrantId:'grant-send',receiveGrantId:'grant-receive',operation:'synthetic.echo',
    payload:'synthetic',issuedAt:1000,expiresAt:1500,now:1100};
  return {store,dbPath,packet};
}
test('valid synthetic approval is metadata-only and never authorizes actions',t=>{
  const {store,packet}=setup(t);
  assert.deepEqual(store.acceptSynthetic(packet),{status:'accepted_synthetic',messageId:'m1',targetPlatform:'linux',externalActionAllowed:false});
  assert.equal(store.snapshot({tenant:'school'}).accepted,1);
});
test('replay rejected in same process',t=>{const {store,packet}=setup(t);store.acceptSynthetic(packet);fail(()=>store.acceptSynthetic(packet),'REPLAY');});
test('replay rejected after database close and reopen',t=>{
  const {store,dbPath,packet}=setup(t);
  store.acceptSynthetic(packet);store.close();
  const next=openDurablePolicy({dbPath});try{fail(()=>next.acceptSynthetic(packet),'REPLAY');}finally{next.close();}
});
test('replay rejected across a second independent SQLite connection',t=>{
  const {store,dbPath,packet}=setup(t);store.acceptSynthetic(packet);
  const next=openDurablePolicy({dbPath});try{fail(()=>next.acceptSynthetic(packet),'REPLAY');}finally{next.close();}
});
test('STOP remains active after close and reopen',t=>{
  const {store,dbPath,packet}=setup(t);store.stop({tenant:'school'});store.close();
  const next=openDurablePolicy({dbPath});try{
    assert.equal(next.snapshot({tenant:'school'}).stopped,true);
    fail(()=>next.acceptSynthetic(packet),'TENANT_STOPPED');
    fail(()=>next.connect({tenant:'school',nodeId:'mac',approved:true}),'TENANT_STOPPED');
  }finally{next.close();}
});
test('STOP is permanent within the research protocol',t=>{
  const {store,packet}=setup(t);store.stop({tenant:'school'});
  fail(()=>store.issueGrant({tenant:'school',nodeId:'mac',grantId:'again',capability:'synthetic.send',approved:true,now:1100,expiresAt:1200}),'TENANT_STOPPED');
  fail(()=>store.acceptSynthetic(packet),'TENANT_STOPPED');
});
test('revoking grant persists across reopen',t=>{
  const {store,dbPath,packet}=setup(t);store.revokeGrant({tenant:'school',grantId:'grant-send'});store.close();
  const next=openDurablePolicy({dbPath});try{fail(()=>next.acceptSynthetic(packet),'GRANT_DENIED');}finally{next.close();}
});
test('revoking node persists across reopen',t=>{
  const {store,dbPath,packet}=setup(t);store.revokeNode({tenant:'school',nodeId:'mac'});store.close();
  const next=openDurablePolicy({dbPath});try{fail(()=>next.acceptSynthetic(packet),'NODE_DENIED');}finally{next.close();}
});
test('disconnect blocks accepted transfer',t=>{
  const {store,packet}=setup(t);store.disconnect({tenant:'school',nodeId:'linux'});
  fail(()=>store.acceptSynthetic(packet),'NODE_DISCONNECTED');
});
test('unknown or extra fields rejected',t=>{
  const {store,packet}=setup(t);fail(()=>store.acceptSynthetic({...packet,remoteExec:'x'}),'INVALID_INPUT');
});
test('invalid fingerprint rejected before any side effect',t=>{
  const {store,packet}=setup(t);fail(()=>store.acceptSynthetic({...packet,fingerprint:'invalid'}),'INVALID_FINGERPRINT');
});
test('mismatched pinned fingerprint refused',t=>{
  const {store,packet}=setup(t);fail(()=>store.acceptSynthetic({...packet,fingerprint:F2}),'IDENTITY_MISMATCH');
});
test('unknown operation refused',t=>{
  const {store,packet}=setup(t);fail(()=>store.acceptSynthetic({...packet,operation:'shell.execute'}),'OPERATION_DENIED');
});
test('UTF-8 payload byte bounds enforced',t=>{
  const {store,packet}=setup(t);fail(()=>store.acceptSynthetic({...packet,payload:'🙂'.repeat(65)}),'PAYLOAD_DENIED');
});
test('expired message refused',t=>{
  const {store,packet}=setup(t);fail(()=>store.acceptSynthetic({...packet,now:1500}),'MESSAGE_EXPIRED');
});
test('expired grant refused',t=>{
  const {store,packet}=setup(t);store.revokeGrant({tenant:'school',grantId:'grant-send'});
  fail(()=>store.acceptSynthetic(packet),'GRANT_DENIED');
});
test('clock rollback blocked persistently after reopen',t=>{
  const {store,dbPath,packet}=setup(t);store.acceptSynthetic(packet);store.close();
  const next=openDurablePolicy({dbPath});
  try{fail(()=>next.acceptSynthetic({...packet,messageId:'m2',now:1050}),'CLOCK_ROLLBACK');}finally{next.close();}
});
test('denied request does not consume replay identifier',t=>{
  const {store,packet}=setup(t);
  fail(()=>store.acceptSynthetic({...packet,fingerprint:F2}),'IDENTITY_MISMATCH');
  assert.equal(store.acceptSynthetic(packet).status,'accepted_synthetic');
});
test('tenant isolation applies to claims and grants',t=>{
  const {store,packet}=setup(t);
  fail(()=>store.acceptSynthetic({...packet,tenant:'another'}),'NODE_DENIED');
  fail(()=>store.revokeGrant({tenant:'another',grantId:'grant-send'}),'GRANT_DENIED');
});
test('no enrollment without consent',t=>{
  const {store}=setup(t);
  fail(()=>store.enroll({tenant:'other',nodeId:'x',platform:'macos',fingerprint:'D'.repeat(64),approved:false}),'CONSENT_REQUIRED');
});
test('same fingerprint cannot enroll across tenants',t=>{
  const {store}=setup(t);
  fail(()=>store.enroll({tenant:'other',nodeId:'copy',platform:'linux',fingerprint:F1,approved:true}),'ALREADY_ENROLLED');
});
test('unknown platform denied',t=>{
  const {store}=setup(t);
  fail(()=>store.enroll({tenant:'other',nodeId:'x',platform:'android',fingerprint:'D'.repeat(64),approved:true}),'PLATFORM_DENIED');
});
test('only allowlisted grant capabilities',t=>{
  const {store}=setup(t);
  fail(()=>store.issueGrant({tenant:'school',nodeId:'mac',grantId:'danger',capability:'file.write',now:1000,expiresAt:1400,approved:true}),'CAPABILITY_DENIED');
});
test('grant expiry bounded',t=>{
  const {store}=setup(t);
  fail(()=>store.issueGrant({tenant:'school',nodeId:'mac',grantId:'long',capability:'synthetic.send',now:1000,expiresAt:100000,approved:true}),'INVALID_EXPIRY');
});
test('duplicate grant IDs are refused',t=>{
  const {store}=setup(t);
  fail(()=>store.issueGrant({tenant:'school',nodeId:'mac',grantId:'grant-send',capability:'synthetic.send',now:1000,expiresAt:1500,approved:true}),'GRANT_ALREADY_EXISTS');
});
test('same node cannot be source and recipient',t=>{
  const {store,packet}=setup(t);fail(()=>store.acceptSynthetic({...packet,toNodeId:'mac'}),'SAME_NODE');
});
test('closed store rejects reads',t=>{
  const {store}=setup(t);store.close();fail(()=>store.snapshot({tenant:'school'}),'STORE_CLOSED');
});
test('replay state is persisted and visible from a second Node process',t=>{
  const {store,dbPath,packet}=setup(t);store.acceptSynthetic(packet);
  const file=fileURLToPath(new URL('./read-state-fixture.mjs',import.meta.url));
  const child=spawnSync(process.execPath,[file,dbPath,'school'],{encoding:'utf8',timeout:10000});
  assert.equal(child.status,0,child.stderr);
  assert.deepEqual(JSON.parse(child.stdout),{tenant:'school',stopped:false,lastTime:1100,enrolled:3,accepted:1});
});
test('STOP state is visible from a second Node process',t=>{
  const {store,dbPath}=setup(t);store.stop({tenant:'school'});
  const file=fileURLToPath(new URL('./read-state-fixture.mjs',import.meta.url));
  const child=spawnSync(process.execPath,[file,dbPath,'school'],{encoding:'utf8',timeout:10000});
  assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout).stopped,true);
});
