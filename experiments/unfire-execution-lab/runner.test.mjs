import test from 'node:test';
import assert from 'node:assert/strict';
import { EvidenceRunner, OPERATIONS, STATES, evidenceDigest } from './runner.mjs';
const math=(id='one',dependsOn=[],requiresApproval=false)=>({id,operation:'math.sum',input:[2,3,4],dependsOn,requiresApproval});
function claimed(r,id='one',now=0,leaseMs=10,worker='worker') {
  const t=r.snapshot(id);
  return r.claim(id,{worker,now,leaseMs,expectedRevision:t.revision});
}
function full(r,id='one',now=0,worker='worker') {
  let t=claimed(r,id,now,10,worker);
  r.start(id,{worker,generation:t.generation,now});
  const evidence=r.perform(id,{worker,generation:t.generation,now});
  r.submit(id,{worker,generation:t.generation,now,evidence});
  return r.verify(id,{worker,generation:t.generation,now});
}
test('allowlist is pure and published states are explicit',()=>{
  assert.deepEqual(OPERATIONS,['math.sum','text.uppercase','text.wordCount']);
  assert.deepEqual(STATES,['READY','CLAIMED','RUNNING','EVIDENCE_READY','VERIFIED','FAILED','CANCELLED']);
});
test('true end-to-end synthetic verified result',()=>{
  const r=new EvidenceRunner();r.register(math());
  const final=full(r);
  assert.equal(final.state,'VERIFIED');assert.equal(final.evidence.output,9);
  assert.deepEqual(r.events().map(e=>e.type),['registered','claimed','started','evidence_submitted','verified']);
});
test('CLAIMED is not VERIFIED',()=>{
  const r=new EvidenceRunner();r.register(math());assert.equal(claimed(r).state,'CLAIMED');
});
test('RUNNING is not VERIFIED',()=>{
  const r=new EvidenceRunner();r.register(math());const c=claimed(r);assert.equal(r.start('one',{worker:'worker',generation:c.generation,now:0}).state,'RUNNING');
});
test('EVIDENCE_READY is not VERIFIED',()=>{
  const r=new EvidenceRunner();r.register(math());const c=claimed(r);
  r.start('one',{worker:'worker',generation:c.generation,now:0});
  assert.equal(r.submit('one',{worker:'worker',generation:c.generation,now:0,evidence:r.perform('one',{worker:'worker',generation:c.generation,now:0})}).state,'EVIDENCE_READY');
});
test('independent validation rejects fabricated result with matching checksum',()=>{
  const r=new EvidenceRunner();r.register(math());const c=claimed(r);r.start('one',{worker:'worker',generation:c.generation,now:0});
  const evidence={id:'one',generation:c.generation,output:999,digest:evidenceDigest('one',c.generation,999)};
  r.submit('one',{worker:'worker',generation:c.generation,now:0,evidence});
  const final=r.verify('one',{worker:'worker',generation:c.generation,now:0});
  assert.equal(final.state,'FAILED');assert.match(final.reason,/independent/);
});
test('tampered digest is rejected by verifier',()=>{
  const r=new EvidenceRunner();r.register(math());const c=claimed(r);r.start('one',{worker:'worker',generation:c.generation,now:0});
  const e={id:'one',generation:c.generation,output:9,digest:'0'.repeat(64)};
  r.submit('one',{worker:'worker',generation:c.generation,now:0,evidence:e});
  assert.equal(r.verify('one',{worker:'worker',generation:c.generation,now:0}).state,'FAILED');
});
test('protected task needs explicit approval',()=>{
  const r=new EvidenceRunner();r.register(math('one',[],true));assert.throws(()=>claimed(r),/Approval required/);
  const updated=r.approve('one',1);assert.equal(updated.revision,2);
  assert.equal(claimed(r).state,'CLAIMED');
});
test('stale revision cannot claim or approve twice',()=>{
  const r=new EvidenceRunner();r.register(math('one',[],true));r.approve('one',1);
  assert.throws(()=>r.approve('one',1),/revision/);
  assert.throws(()=>r.claim('one',{worker:'worker',now:0,leaseMs:10,expectedRevision:1}),/revision/);
});
test('dependencies require independently verified predecessor',()=>{
  const r=new EvidenceRunner();r.register(math('one'));r.register(math('two',['one']));
  assert.throws(()=>claimed(r,'two'),/Dependencies unverified/);
  full(r);assert.equal(full(r,'two').state,'VERIFIED');
});
test('a failed predecessor does not unlock descendants',()=>{
  const r=new EvidenceRunner();r.register(math('one'));r.register(math('two',['one']));
  const c=claimed(r);r.start('one',{worker:'worker',generation:c.generation,now:0});
  r.submit('one',{worker:'worker',generation:c.generation,now:0,evidence:{id:'one',generation:c.generation,output:99,digest:evidenceDigest('one',c.generation,99)}});
  assert.equal(r.verify('one',{worker:'worker',generation:c.generation,now:0}).state,'FAILED');
  assert.throws(()=>claimed(r,'two'),/Dependencies unverified/);
});
test('lease expires; stale worker loses rights and token increments',()=>{
  const r=new EvidenceRunner();r.register(math());const c=claimed(r);
  assert.equal(r.expire('one',10).state,'READY');
  assert.throws(()=>r.start('one',{worker:'worker',generation:c.generation,now:11}),/Start rejected/);
  const renewed=claimed(r,'one',11);assert.equal(renewed.generation,c.generation+1);
});
test('expiration after evidence submission erases unverified evidence',()=>{
  const r=new EvidenceRunner();r.register(math());const c=claimed(r);r.start('one',{worker:'worker',generation:c.generation,now:0});
  r.submit('one',{worker:'worker',generation:c.generation,now:0,evidence:r.perform('one',{worker:'worker',generation:c.generation,now:0})});
  const t=r.expire('one',10);assert.equal(t.state,'READY');assert.equal(t.evidence,null);
  assert.throws(()=>r.verify('one',{worker:'worker',generation:c.generation,now:10}),/Verification rejected/);
});
test('claim is exclusive; conflicting worker cannot hijack lease',()=>{
  const r=new EvidenceRunner();r.register(math());const c=claimed(r);
  assert.throws(()=>r.claim('one',{worker:'other',now:1,leaseMs:10,expectedRevision:c.revision}),/Claim rejected/);
  assert.throws(()=>r.start('one',{worker:'other',generation:c.generation,now:1}),/lease/);
});
test('generation fencing rejects former owner after retry',()=>{
  const r=new EvidenceRunner();r.register(math());const c=claimed(r);r.expire('one',10);
  const second=claimed(r,'one',11);assert.notEqual(second.generation,c.generation);
  assert.throws(()=>r.start('one',{worker:'worker',generation:c.generation,now:11}),/lease/);
});
test('after three expired claims, task fails closed',()=>{
  const r=new EvidenceRunner();r.register(math());for(let n=0;n<3;n++){
    claimed(r,'one',n*10);const t=r.expire('one',(n+1)*10);
    assert.equal(t.state,n===2?'FAILED':'READY');
  }
  assert.throws(()=>claimed(r,'one',31),/Claim rejected/);
});
test('STOP cancels work without revoking verified results',()=>{
  const r=new EvidenceRunner();r.register(math('one'));r.register(math('two'));
  full(r);const c=claimed(r,'two');
  const snapshot=r.stop();assert.equal(snapshot[0].state,'VERIFIED');assert.equal(snapshot[1].state,'CANCELLED');
  assert.throws(()=>r.start('two',{worker:'worker',generation:c.generation,now:1}),/Start rejected/);
  assert.equal(r.isStopped,true);
});
test('STOP is idempotent and cancels all pending stages',()=>{
  const r=new EvidenceRunner();r.register(math('one'));r.register(math('two'));
  r.stop();const events=r.events().length;r.stop();assert.equal(r.events().length,events);
  assert.deepEqual(r.snapshots().map(x=>x.state),['CANCELLED','CANCELLED']);
});
test('task submission rejects unsupported fields and shell commands',()=>{
  const r=new EvidenceRunner();assert.throws(()=>r.register({...math(),shell:'rm -rf .'}),/shape/);
  assert.throws(()=>r.register({...math(),operation:'shell.exec'}),/operation/);
  assert.equal(r.snapshots().length,0);
});
test('task cannot use unresolved dependencies or duplicate identifiers',()=>{
  const r=new EvidenceRunner();assert.throws(()=>r.register(math('one',['none'])),/Unresolved/);
  r.register(math());assert.throws(()=>r.register(math()),/Duplicate/);
});
test('strict text and numeric inputs',()=>{
  const r=new EvidenceRunner();assert.throws(()=>r.register({...math(),input:[Infinity]}),/numeric/);
  assert.throws(()=>r.register({...math(),input:[1e308,1e308]}),/sum/);
  assert.throws(()=>r.register({...math(),input:[]}),/numeric/);
  assert.throws(()=>r.register({id:'x',operation:'text.wordCount',input:'a'.repeat(501),dependsOn:[],requiresApproval:false}),/text/);
});
test('word count and uppercase calculate actual pure results',()=>{
  const r=new EvidenceRunner();r.register({id:'words',operation:'text.wordCount',input:'  one  two three ',dependsOn:[],requiresApproval:false});
  r.register({id:'upper',operation:'text.uppercase',input:'hello',dependsOn:['words'],requiresApproval:false});
  assert.equal(full(r,'words').evidence.output,3);
  assert.equal(full(r,'upper').evidence.output,'HELLO');
});
test('snapshots never expose mutable state references',()=>{
  const r=new EvidenceRunner();r.register(math());const s=r.snapshot('one');s.spec.input[0]=777;s.state='VERIFIED';
  assert.equal(r.snapshot('one').spec.input[0],2);assert.equal(r.snapshot('one').state,'READY');
});
test('evidence checksum does not count as execution or proof on its own',()=>{
  const r=new EvidenceRunner();r.register(math());const e=evidenceDigest('one',1,9);
  assert.equal(e.length,64);assert.equal(r.snapshot('one').state,'READY');
});
test('lease deadline exclusive; completion requires live lease',()=>{
  const r=new EvidenceRunner();r.register(math());const c=claimed(r);
  assert.throws(()=>r.start('one',{worker:'worker',generation:c.generation,now:10}),/lease/);
  assert.equal(r.snapshot('one').state,'CLAIMED');
});
test('stop blocks future registration and claims',()=>{
  const r=new EvidenceRunner();r.register(math());r.stop();
  assert.throws(()=>r.register(math('other')),/Registration closed/);
  assert.throws(()=>claimed(r),/Claim rejected/);
});
test('cannot submit evidence while unstarted or when stopped',()=>{
  const r=new EvidenceRunner();r.register(math());const c=claimed(r);
  assert.throws(()=>r.submit('one',{worker:'worker',generation:c.generation,now:0,evidence:{}}),/Submission rejected/);
  r.stop();assert.throws(()=>r.perform('one',{worker:'worker',generation:c.generation,now:0}),/Execution rejected/);
});
test('audit records sequence and transitions without payload values',()=>{
  const r=new EvidenceRunner();r.register(math());full(r);
  const events=r.events();assert.deepEqual(events.map(x=>x.sequence),[1,2,3,4,5]);
  assert.equal(JSON.stringify(events).includes('input'),false);
});
