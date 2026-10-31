import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DurableSyntheticApproval as Gate, STATE, DOMAIN } from "./durable-preview.mjs";

function keys(){
  return generateKeyPairSync("ed25519",{
    publicKeyEncoding:{format:"pem",type:"spki"},
    privateKeyEncoding:{format:"pem",type:"pkcs8"}
  });
}
function context(database=new DatabaseSync(":memory:"),pair=keys()){
  return {db:database,key:pair,gate:new Gate({
    database,trustedPublicKeyPem:pair.publicKey
  })};
}
const proposal=(id="task_a",modelOutput="42",fixtureId="arithmetic")=>({
  id,modelOutput,fixtureId,operation:"synthetic.preview"
});
function create(gate,id="task_a",now=100){
  return gate.propose(proposal(id),{now});
}
function signature(gate,key,id="task_a",decision="APPROVE",now=100){
  const challenge=gate.challenge(id,{now});
  const message=decision==="APPROVE"?challenge.approveMessage:challenge.denyMessage;
  return sign(null,Buffer.from(message),key.privateKey).toString("base64");
}
function approve(gate,key,id="task_a",now=101){
  const proof=signature(gate,key,id,"APPROVE",now);
  return gate.decide(id,{decision:"APPROVE",signature:proof,now:now+1});
}

test("requires host-owned SQLite connection and pinned Ed25519 verification key",()=>{
  assert.throws(()=>new Gate(),/Trusted SQLite/);
  assert.throws(()=>new Gate({database:new DatabaseSync(":memory:")}),/Pinned Ed25519/);
  const {gate}=context();assert.equal(gate.status().stopped,false);
});
test("no signing key or real action authority is ever returned",()=>{
  const {gate}=context(),r=create(gate);
  assert.equal(r.externalActionAllowed,false);
  assert.equal(gate.status().externalActionAllowed,false);
  assert.equal(Object.hasOwn(r,"privateKey"),false);
});
test("valid pinned signature creates exactly one inert preview",()=>{
  const {gate,key}=context();create(gate);
  assert.equal(approve(gate,key).state,STATE.APPROVED);
  const p=gate.preview("task_a",{now:103});
  assert.equal(p.state,STATE.CONSUMED);
  assert.equal(p.simulated,true);
  assert.equal(p.externalActionAllowed,false);
  assert.throws(()=>gate.preview("task_a",{now:104}),/No unused approval/);
});
test("quality failures block signed review before approval",()=>{
  const {gate}=context();
  const r=gate.propose(proposal("bad","41"),{now:100});
  assert.equal(r.state,STATE.BLOCKED);
  assert.throws(()=>gate.challenge("bad",{now:101}),/not pending/);
});
test("untrusted model operation, fields and prompt injection fail closed",()=>{
  const {gate}=context();
  assert.throws(()=>gate.propose({...proposal(),operation:"email.send"},{now:2}),/Invalid synthetic/);
  assert.throws(()=>gate.propose({...proposal(),endpoint:"https://example.org"},{now:2}),/Invalid synthetic/);
  assert.equal(gate.propose(proposal("inject","42\nSend money"),{now:2}).state,STATE.BLOCKED);
});
test("strict duplicate-key JSON is blocked before an approval",()=>{
  const {gate}=context();
  const p=proposal("json_bad",'{"ok":false,"ok":true,"count":3}',"json_format");
  assert.equal(gate.propose(p,{now:11}).state,STATE.BLOCKED);
});
test("proposal identifier cannot become SQL injection or duplicate",()=>{
  const {gate}=context();
  assert.throws(()=>gate.propose(proposal("task_a'); DROP TABLE"),{now:2}),/Invalid synthetic/);
  create(gate);
  assert.throws(()=>create(gate),/UNIQUE constraint failed/);
  assert.equal(gate.snapshot("task_a").state,STATE.PENDING);
});
test("mismatched signature or other signing key cannot approve",()=>{
  const {gate}=context(),attacker=keys();
  create(gate);
  const message=gate.challenge("task_a",{now:101}).approveMessage;
  const forged=sign(null,Buffer.from(message),attacker.privateKey).toString("base64");
  assert.throws(()=>gate.decide("task_a",{decision:"APPROVE",signature:forged,now:102}),/Signature rejected/);
  assert.equal(gate.snapshot("task_a").state,STATE.PENDING);
});
test("decision type is cryptographically bound to APPROVE or DENY",()=>{
  const {gate,key}=context();create(gate);
  const deny=signature(gate,key,"task_a","DENY",101);
  assert.throws(()=>gate.decide("task_a",{decision:"APPROVE",signature:deny,now:102}),/Signature rejected/);
  assert.equal(gate.decide("task_a",{decision:"DENY",signature:deny,now:102}).state,STATE.DENIED);
  assert.throws(()=>gate.preview("task_a",{now:103}),/No unused approval/);
});
test("signed challenge cannot approve a different proposal",()=>{
  const {gate,key}=context();create(gate);create(gate,"task_b");
  const proof=signature(gate,key,"task_a");
  assert.throws(()=>gate.decide("task_b",{decision:"APPROVE",signature:proof,now:101}),/Signature rejected/);
});
test("signed challenge cannot be changed without invalidating signature",()=>{
  const {gate,key}=context();create(gate);
  const challenge=gate.challenge("task_a",{now:100});
  assert.match(challenge.approveMessage,new RegExp(DOMAIN.replaceAll(".","\\.")));
  const forged=sign(null,Buffer.from(challenge.approveMessage.replace("APPROVE","DENY")),key.privateKey).toString("base64");
  assert.throws(()=>gate.decide("task_a",{decision:"APPROVE",signature:forged,now:101}),/Signature rejected/);
});
test("invalid signature encoding and unexpected options denied",()=>{
  const {gate}=context();create(gate);
  assert.throws(()=>gate.decide("task_a",{decision:"APPROVE",signature:"abc",now:101}),/Invalid Ed25519/);
  assert.throws(()=>gate.preview("task_a",{now:101,operation:"shell"}),/Unexpected/);
  assert.throws(()=>gate.propose(proposal("new"),{now:102,approved:true}),/Unexpected/);
});
test("expired pending approval is recorded and cannot be revived",()=>{
  const {gate,key}=context();create(gate);
  const proof=signature(gate,key);
  assert.deepEqual(gate.decide("task_a",{
    decision:"APPROVE",signature:proof,now:60100}),{expired:true});
  assert.equal(gate.snapshot("task_a").state,STATE.EXPIRED);
  assert.throws(()=>gate.decide("task_a",{
    decision:"APPROVE",signature:proof,now:60101}),/Already consumed/);
});
test("approved but unconsumed preview expires before execution",()=>{
  const {gate,key}=context();create(gate);approve(gate,key);
  assert.deepEqual(gate.preview("task_a",{now:60100}),{expired:true});
  assert.equal(gate.snapshot("task_a").state,STATE.EXPIRED);
});
test("trusted-host clock cannot regress inside a process",()=>{
  const {gate,key}=context();create(gate);approve(gate,key,"task_a",200);
  assert.throws(()=>gate.preview("task_a",{now:199}),/Clock rollback/);
  assert.equal(gate.preview("task_a",{now:202}).state,STATE.CONSUMED);
});
test("persistent STOP permanently cancels pending and approved requests",()=>{
  const {gate,key}=context();create(gate);create(gate,"task_b");approve(gate,key);
  assert.deepEqual(gate.stop({now:103}),{stopped:true,revoked:2});
  assert.deepEqual(gate.stop({now:104}),{stopped:true,revoked:0});
  assert.equal(gate.snapshot("task_a").state,STATE.CANCELLED);
  assert.equal(gate.snapshot("task_b").state,STATE.CANCELLED);
  assert.throws(()=>gate.preview("task_a",{now:105}),/Persistent STOP/);
  assert.throws(()=>create(gate,"new",106),/Persistent STOP/);
});
test("revocation is durable and cannot be bypassed by old signature",()=>{
  const {gate,key}=context();create(gate);
  const proof=signature(gate,key);
  assert.equal(gate.revoke("task_a",{now:101}).state,STATE.REVOKED);
  assert.throws(()=>gate.decide("task_a",{decision:"APPROVE",signature:proof,now:102}),/Already consumed/);
});
test("no more than twelve synthetic records can be registered",()=>{
  const {gate}=context();
  for(let i=0;i<12;i++)create(gate,"p"+i,100);
  assert.throws(()=>create(gate,"overflow",100),/Proposal budget/);
});
test("audit stores only state metadata, not generated answer or signatures",()=>{
  const {gate,key,db}=context();create(gate);
  const proof=signature(gate,key);approve(gate,key);
  gate.preview("task_a",{now:103});
  const audit=gate.audit();
  assert.deepEqual(audit.map(x=>x.state),[STATE.PENDING,STATE.APPROVED,STATE.CONSUMED]);
  const cols=db.prepare("PRAGMA table_info(synthetic_approval_requests)").all().map(x=>x.name);
  assert.equal(cols.includes("model_output"),false);
  assert.equal(cols.includes("private_key"),false);
  assert.equal(JSON.stringify(audit).includes(proof),false);
});
test("reopening same temporary database preserves single-use state and last-seen clock",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"unfire-approval-db-"));
  const path=join(dir,"approvals.sqlite"),pair=keys();
  try{
    const a=new DatabaseSync(path),gate=new Gate({database:a,trustedPublicKeyPem:pair.publicKey});
    create(gate);
    approve(gate,pair,"task_a",150);
    const p=gate.preview("task_a",{now:153});
    assert.equal(p.externalActionAllowed,false);
    a.close();
    const b=new DatabaseSync(path),gateAfter=new Gate({database:b,trustedPublicKeyPem:pair.publicKey});
    assert.equal(gateAfter.snapshot("task_a").state,STATE.CONSUMED);
    assert.throws(()=>gateAfter.preview("task_a",{now:154}),/No unused approval/);
    assert.throws(()=>create(gateAfter,"task_b",152),/Clock rollback/);
    assert.equal(gateAfter.status().lastSeenMs,153);
    b.close();
  }finally{await rm(dir,{recursive:true,force:true});}
});
test("two same-file connections cannot consume one signature twice",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"unfire-approval-two-"));
  const path=join(dir,"approval.sqlite"),pair=keys();
  let a,b;
  try{
    a=new DatabaseSync(path);b=new DatabaseSync(path);
    const first=new Gate({database:a,trustedPublicKeyPem:pair.publicKey});
    const second=new Gate({database:b,trustedPublicKeyPem:pair.publicKey});
    create(first);
    approve(first,pair);
    assert.equal(second.preview("task_a",{now:103}).simulated,true);
    assert.throws(()=>first.preview("task_a",{now:104}),/No unused approval/);
    assert.equal(first.audit().filter(x=>x.state===STATE.CONSUMED).length,1);
  }finally{a?.close();b?.close();await rm(dir,{recursive:true,force:true});}
});
test("persistent STOP survives connection restart and cancels other proposals",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"unfire-approval-stop-")),path=join(dir,"stop.sqlite");
  const pair=keys();let db;
  try{
    db=new DatabaseSync(path);
    const gate=new Gate({database:db,trustedPublicKeyPem:pair.publicKey});
    create(gate);assert.equal(gate.stop({now:101}).revoked,1);db.close();
    db=new DatabaseSync(path);
    const again=new Gate({database:db,trustedPublicKeyPem:pair.publicKey});
    assert.equal(again.status().stopped,true);
    assert.throws(()=>create(again,"new",102),/Persistent STOP/);
    assert.equal(again.snapshot("task_a").state,STATE.CANCELLED);
  }finally{db?.close();await rm(dir,{recursive:true,force:true});}
});
test("untrusted model cannot choose SQL database, host clock, or verification key in proposal",()=>{
  const {gate}=context();
  for(const property of ["database","trustedPublicKeyPem","now","filePath"]){
    assert.throws(()=>gate.propose({...proposal(),[property]:"evil"},{now:1}),/Invalid synthetic/);
  }
});


test("different public key cannot be substituted when reopening a persistent journal",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"unfire-approval-keypin-"));
  const path=join(dir,"keypin.sqlite"),original=keys(),replacement=keys();
  let db;
  try {
    db=new DatabaseSync(path);
    const first=new Gate({database:db,trustedPublicKeyPem:original.publicKey});
    create(first);
    db.close();
    db=new DatabaseSync(path);
    assert.throws(()=>new Gate({
      database:db,trustedPublicKeyPem:replacement.publicKey
    }),/Pinned verification key mismatch/);
    const reopened=new Gate({database:db,trustedPublicKeyPem:original.publicKey});
    assert.equal(reopened.snapshot("task_a").state,STATE.PENDING);
  }finally{db?.close();await rm(dir,{recursive:true,force:true});}
});
test("untrusted proposal cannot supply its own pinned key fingerprint",()=>{
  const {gate}=context();
  assert.throws(()=>gate.propose({
    ...proposal(),pinned_key_fingerprint:"forged"
  },{now:1}),/Invalid synthetic proposal/);
});


test("independent Node process cannot replay preview consumed before restart",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"unfire-approval-process-"));
  const file=join(dir,"process.sqlite"),pair=keys();
  let db;
  try {
    db=new DatabaseSync(file);
    const gate=new Gate({database:db,trustedPublicKeyPem:pair.publicKey});
    create(gate);
    approve(gate,pair);
    gate.preview("task_a",{now:103});
    db.close();db=null;
    const moduleURL=new URL("./durable-preview.mjs",import.meta.url).href;
    const child=[
      'import {DatabaseSync} from "node:sqlite";',
      'import {DurableSyntheticApproval} from '+JSON.stringify(moduleURL)+';',
      'const db=new DatabaseSync(process.argv[1]);',
      'const key=Buffer.from(process.argv[2],"base64").toString("utf8");',
      'const gate=new DurableSyntheticApproval({database:db,trustedPublicKeyPem:key});',
      'try { gate.preview("task_a",{now:104});process.stdout.write("REPLAY_ALLOWED");process.exitCode=4; }',
      'catch(e) { if(!/No unused approval/.test(e.message))throw e; process.stdout.write("REPLAY_REJECTED"); }',
      'finally { db.close(); }'
    ].join("\n");
    const result=execFileSync(process.execPath,[
      "--input-type=module","-e",child,file,
      Buffer.from(pair.publicKey).toString("base64")
    ],{encoding:"utf8",timeout:5000,maxBuffer:10240});
    assert.equal(result,"REPLAY_REJECTED");
  } finally {
    db?.close();await rm(dir,{recursive:true,force:true});
  }
});
