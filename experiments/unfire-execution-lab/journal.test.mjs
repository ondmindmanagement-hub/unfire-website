import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EvidenceRunner } from './runner.mjs';
import { encodeJournal, decodeJournal, auditAfterRestart, MAX_EVENTS } from './journal.mjs';

function verifiedFixture() {
  const runner = new EvidenceRunner();
  runner.register({id:'alpha',operation:'math.sum',input:[17,9],
    dependsOn:[],requiresApproval:false});
  let task=runner.claim('alpha',{worker:'worker_a',now:10,leaseMs:100,expectedRevision:1});
  runner.start('alpha',{worker:'worker_a',generation:task.generation,now:11});
  const evidence=runner.perform('alpha',{worker:'worker_a',generation:task.generation,now:12});
  runner.submit('alpha',{worker:'worker_a',generation:task.generation,now:13,evidence});
  runner.verify('alpha',{worker:'worker_a',generation:task.generation,now:14});
  return runner;
}
test('verified fixture writes exactly five transition events',()=>{
  const runner=verifiedFixture();
  assert.equal(runner.events().length,5);
  assert.equal(runner.snapshot('alpha').state,'VERIFIED');
});
test('canonical encode/decode preserves only transition metadata',()=>{
  const runner=verifiedFixture();
  const text=encodeJournal(runner.events());
  assert.deepEqual(decodeJournal(text),runner.events());
  assert.ok(text.endsWith('\n'));
  assert.equal(text.includes('"input"'),false);
  assert.equal(text.includes('"output"'),false);
  assert.equal(text.includes('"worker"'),false);
  assert.equal(text.includes('worker_a'),false);
});
test('read-only restart audit never revives approval, claims or execution',()=>{
  const audit=auditAfterRestart(encodeJournal(verifiedFixture().events()));
  assert.equal(audit.tasks[0].recordedState,'VERIFIED');
  assert.equal(audit.tasks[0].resumable,false);
  assert.equal(audit.tasks[0].approvalsRestored,false);
  assert.equal(audit.tasks[0].leasesRestored,false);
  assert.match(audit.disclaimer,/cannot restore a task/);
});
test('empty journal is read-only and contains no actionable tasks',()=>{
  assert.deepEqual(decodeJournal(''),[]);
  assert.deepEqual(auditAfterRestart('').tasks,[]);
});
test('modified historical state is detected by checksum chain',()=>{
  const text=encodeJournal(verifiedFixture().events());
  const tampered=text.replace('"state":"RUNNING"','"state":"VERIFIED"');
  assert.notEqual(tampered,text);
  assert.throws(()=>decodeJournal(tampered),/checksum|event|state/i);
});
test('partial final record is rejected as truncation',()=>{
  const encoded=encodeJournal(verifiedFixture().events());
  assert.throws(()=>decodeJournal(encoded.slice(0,-8)),/Truncated|Unreadable/);
});
test('reordered records are rejected by integrity chain',()=>{
  const lines=encodeJournal(verifiedFixture().events()).trimEnd().split('\n');
  [lines[1],lines[2]]=[lines[2],lines[1]];
  assert.throws(()=>decodeJournal(lines.join('\n')+'\n'),/chain|sequence|checksum/);
});
test('extra fields and private payload injection are denied',()=>{
  const input=verifiedFixture().events();
  input[0].input='secret';
  assert.throws(()=>encodeJournal(input),/unapproved fields/);
});
test('fake VERIFIED event cannot follow READY',()=>{
  const raw=verifiedFixture().events().slice(0,1);
  raw.push({sequence:2,type:'verified',taskId:'alpha',state:'VERIFIED',
    revision:2,generation:0});
  assert.throws(()=>encodeJournal(raw),/Invalid journal state transition/);
});
test('sequence numbers and generations must remain monotonic',()=>{
  const entries=verifiedFixture().events();
  entries[1].sequence=3;
  assert.throws(()=>encodeJournal(entries),/Noncontiguous journal sequence/);
  const another=verifiedFixture().events();
  another[1].generation=2;
  assert.throws(()=>encodeJournal(another),/Invalid generation transition/);
});
test('bounded metadata limits reject oversized inputs',()=>{
  const row=verifiedFixture().events()[0];
  assert.throws(()=>encodeJournal(Array(MAX_EVENTS+1).fill(row)),/event limit/);
  assert.throws(()=>decodeJournal('x'.repeat(524289)),/size/);
});
test('journal can be written and reread in a temporary 0600 local file',async()=>{
  const workspace=await mkdtemp(join(tmpdir(),'unfire-journal-test-'));
  try{
    const path=join(workspace,'events.jsonl');
    const journal=encodeJournal(verifiedFixture().events());
    await writeFile(path,journal,{flag:'wx',mode:0o600});
    const readBack=await readFile(path,'utf8');
    assert.deepEqual(decodeJournal(readBack),verifiedFixture().events());
    assert.equal(auditAfterRestart(readBack).tasks[0].resumable,false);
  }finally{
    await rm(workspace,{recursive:true,force:true});
  }
});
