import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { canonicalP256, P256PreviewJournal as Journal, P256_STATES as S } from "./protocol.mjs";

const keyPair=()=>generateKeyPairSync("ec",{
  namedCurve:"prime256v1",
  publicKeyEncoding:{format:"pem",type:"spki"},
  privateKeyEncoding:{format:"pem",type:"pkcs8"}
});
const create=(db=new DatabaseSync(":memory:"),keys=keyPair())=>({
  db,keys,ledger:new Journal({database:db,trustedPublicKeyPem:keys.publicKey})
});
const proposal=(id="task_a",modelOutput="42")=>({
  id,modelOutput,fixtureId:"arithmetic",operation:"synthetic.preview"
});
const submit=(l,id="task_a",now=100)=>l.propose(proposal(id),{now});
const signature=(l,keys,id="task_a",decision="APPROVE",now=101)=>{
  const challenge=l.challenge(id,{now});
  return sign("sha256",Buffer.from(decision==="APPROVE"?challenge.approveText:challenge.denyText),keys.privateKey).toString("base64");
};
test("P-256 challenge is canonical, explicitly scoped and Unicode-free",()=>{
  const msg=canonicalP256({proposalId:"task_a",proposalDigest:"a".repeat(64),
    nonce:"c".repeat(48),expiresAt:60100,decision:"APPROVE"});
  assert.match(msg,/^UNFIRE-P256-V1\nalgorithm=ECDSA-P256-SHA256\noperation=synthetic.preview\n/);
  assert.equal(msg.endsWith("\n"),true);
  assert.throws(()=>canonicalP256({proposalId:"task_a\npay",proposalDigest:"a".repeat(64),
    nonce:"c".repeat(48),expiresAt:60100,decision:"APPROVE"}),/Invalid/);
});
test("P-256 only: wrong curve and missing key rejected",()=>{
  assert.throws(()=>new Journal({database:new DatabaseSync(":memory:")}),/Trusted public/);
  const wrong=generateKeyPairSync("ed25519",{
    publicKeyEncoding:{format:"pem",type:"spki"},
    privateKeyEncoding:{format:"pem",type:"pkcs8"}
  });
  assert.throws(()=>new Journal({database:new DatabaseSync(":memory:"),trustedPublicKeyPem:wrong.publicKey}),/Only P-256/);
});
test("valid signed APPROVE can consume one inert preview only",()=>{
  const {ledger:l,keys}=create();submit(l);
  assert.equal(l.decide("task_a",{decision:"APPROVE",signature:signature(l,keys),now:102}).state,S.APPROVED);
  const result=l.preview("task_a",{now:103});
  assert.equal(result.state,S.CONSUMED);
  assert.equal(result.simulated,true);
  assert.equal(result.externalActionAllowed,false);
  assert.equal(result.signedHumanConsentProven,false);
  assert.throws(()=>l.preview("task_a",{now:104}),/No unused/);
});
test("signed DENY can never approve or produce preview",()=>{
  const {ledger:l,keys}=create();submit(l);
  const proof=signature(l,keys,"task_a","DENY");
  assert.throws(()=>l.decide("task_a",{decision:"APPROVE",signature:proof,now:102}),/P-256 signature rejected/);
  assert.equal(l.decide("task_a",{decision:"DENY",signature:proof,now:102}).state,S.DENIED);
  assert.throws(()=>l.preview("task_a",{now:103}),/No unused/);
});
test("signed scope, proposal ID and nonce are not reusable",()=>{
  const {ledger:l,keys}=create();submit(l);submit(l,"task_b",101);
  const proof=signature(l,keys,"task_a","APPROVE",102);
  assert.throws(()=>l.decide("task_b",{decision:"APPROVE",signature:proof,now:103}),/signature rejected/);
  assert.match(l.challenge("task_a",{now:103}).approveText,/operation=synthetic.preview/);
});
test("attacker key cannot approve even a matching canonical request",()=>{
  const {ledger:l}=create(),attacker=keyPair();submit(l);
  const proof=sign("sha256",Buffer.from(l.challenge("task_a",{now:101}).approveText),
    attacker.privateKey).toString("base64");
  assert.throws(()=>l.decide("task_a",{decision:"APPROVE",signature:proof,now:102}),/signature rejected/);
});
test("expired signature and already expired preview never revive",()=>{
  const {ledger:l,keys}=create();submit(l);
  const proof=signature(l,keys);
  assert.deepEqual(l.decide("task_a",{decision:"APPROVE",signature:proof,now:60100}),{expired:true});
  assert.equal(l.snapshot("task_a").state,S.EXPIRED);
  assert.throws(()=>l.decide("task_a",{decision:"APPROVE",signature:proof,now:60101}),/Already decided/);
});
test("bad model answer and unknown operation never become pending",()=>{
  const {ledger:l}=create();
  assert.equal(l.propose(proposal("bad","41"),{now:10}).state,S.BLOCKED);
  assert.throws(()=>l.challenge("bad",{now:11}),/No pending/);
  assert.throws(()=>l.propose({...proposal("mail"),operation:"email.send"},{now:12}),/Invalid synthetic/);
});
test("extra approval fields, malformed DER and clock rollback are denied",()=>{
  const {ledger:l}=create();submit(l);
  assert.throws(()=>l.decide("task_a",{decision:"APPROVE",signature:"nonsense",now:101}),/Invalid DER/);
  assert.throws(()=>l.decide("task_a",{decision:"APPROVE",signature:"abc",now:101,target:"email"}),/Unexpected/);
  assert.throws(()=>l.challenge("task_a",{now:99}),/Clock rollback/);
});
test("revocation rejects previously signed approval",()=>{
  const {ledger:l,keys}=create();submit(l);
  const proof=signature(l,keys);
  l.revoke("task_a",{now:102});
  assert.equal(l.snapshot("task_a").state,S.REVOKED);
  assert.throws(()=>l.decide("task_a",{decision:"APPROVE",signature:proof,now:103}),/Already decided/);
});
test("STOP is permanent for the same persistent ledger",()=>{
  const {ledger:l,keys}=create();submit(l);submit(l,"task_b",101);
  l.decide("task_a",{decision:"APPROVE",signature:signature(l,keys,"task_a","APPROVE",102),now:103});
  assert.deepEqual(l.stop({now:104}),{stopped:true});
  assert.equal(l.snapshot("task_a").state,S.STOPPED);
  assert.equal(l.snapshot("task_b").state,S.STOPPED);
  assert.throws(()=>l.preview("task_a",{now:105}),/Persistent STOP/);
});
test("reopening DB under different key is refused and consumed state persists",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"unfire-p256-db-"));
  const path=join(dir,"db.sqlite"),keys=keyPair(),other=keyPair();
  let db;
  try{
    db=new DatabaseSync(path);
    let l=new Journal({database:db,trustedPublicKeyPem:keys.publicKey});
    submit(l);l.decide("task_a",{decision:"APPROVE",signature:signature(l,keys),now:102});
    l.preview("task_a",{now:103});
    db.close();db=null;
    db=new DatabaseSync(path);
    assert.throws(()=>new Journal({database:db,trustedPublicKeyPem:other.publicKey}),/Pinned P-256 key mismatch/);
    l=new Journal({database:db,trustedPublicKeyPem:keys.publicKey});
    assert.equal(l.snapshot("task_a").state,S.CONSUMED);
    assert.throws(()=>l.preview("task_a",{now:104}),/No unused/);
  }finally{db?.close();await rm(dir,{recursive:true,force:true});}
});
test("two database connections cannot consume one approval twice",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"unfire-p256-race-"));
  const path=join(dir,"db.sqlite"),keys=keyPair();
  let a,b;
  try{
    a=new DatabaseSync(path);b=new DatabaseSync(path);
    const l1=new Journal({database:a,trustedPublicKeyPem:keys.publicKey});
    const l2=new Journal({database:b,trustedPublicKeyPem:keys.publicKey});
    submit(l1);
    l1.decide("task_a",{decision:"APPROVE",signature:signature(l1,keys),now:102});
    assert.equal(l2.preview("task_a",{now:103}).simulated,true);
    assert.throws(()=>l1.preview("task_a",{now:104}),/No unused/);
  }finally{a?.close();b?.close();await rm(dir,{recursive:true,force:true});}
});
test("persistent STOP survives reopening the database",async()=>{
  const dir=await mkdtemp(join(tmpdir(),"unfire-p256-stop-"));
  const path=join(dir,"db.sqlite"),keys=keyPair();let db;
  try{
    db=new DatabaseSync(path);let l=new Journal({database:db,trustedPublicKeyPem:keys.publicKey});
    submit(l);l.stop({now:102});db.close();db=null;
    db=new DatabaseSync(path);l=new Journal({database:db,trustedPublicKeyPem:keys.publicKey});
    assert.equal(l.status().stopped,true);
    assert.throws(()=>l.propose(proposal("new"),{now:103}),/Persistent STOP/);
  }finally{db?.close();await rm(dir,{recursive:true,force:true});}
});
test("journal audit has no raw model text or signature",()=>{
  const {ledger:l,keys,db}=create();submit(l);
  const proof=signature(l,keys);
  l.decide("task_a",{decision:"APPROVE",signature:proof,now:102});
  l.preview("task_a",{now:103});
  const text=JSON.stringify(l.audit());
  assert.equal(text.includes(proof),false);
  assert.equal(text.includes('"modelOutput"'),false);
  const columns=db.prepare("PRAGMA table_info(p256_requests)").all().map(r=>r.name);
  assert.equal(columns.includes("model_output"),false);
});
