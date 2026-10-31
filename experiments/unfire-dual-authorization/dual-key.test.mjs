import test from "node:test";
import assert from "node:assert/strict";
import {DatabaseSync} from "node:sqlite";
import {generateKeyPairSync,randomBytes,sign} from "node:crypto";
import {P256PreviewJournal} from "../unfire-p256-bridge/protocol.mjs";
import {verifyDualSyntheticProof as verify} from "./dual-key.mjs";

const ec=()=>generateKeyPairSync("ec",{namedCurve:"prime256v1"});
function fixture(){
  const issuer=ec(),reviewer=ec(),db=new DatabaseSync(":memory:");
  const journal=new P256PreviewJournal({
    database:db,trustedPublicKeyPem:reviewer.publicKey.export({
      type:"spki",format:"pem"
    })
  });
  journal.propose({
    id:"task_a",fixtureId:"arithmetic",
    modelOutput:"42",operation:"synthetic.preview"
  },{now:100});
  const challenge=journal.challenge("task_a",{now:101}).approveText;
  function envelope({challengeText=challenge,
    signer=issuer.privateKey,expiresAt=60000,
    nonce=randomBytes(24).toString("hex")}={}){
    const unsigned=[
      "UNFIRE-ISSUER-ENVELOPE-V1","algorithm=ECDSA-P256-SHA256",
      "issuerId=unfire-local-controller","nonce="+nonce,
      "expiresAt="+expiresAt,
      "challengeB64="+Buffer.from(challengeText).toString("base64"),""
    ].join("\n");
    const signed=sign("sha256",Buffer.from(unsigned),signer).toString("base64");
    return Buffer.from(unsigned+"signatureDER="+signed+"\n");
  }
  function proof(extra={}){
    return {
      signedEnvelope:envelope(),
      expectedChallenge:challenge,
      issuerPublicKeyDer:issuer.publicKey.export({type:"spki",format:"der"}),
      reviewerPublicKeyPem:reviewer.publicKey.export({type:"spki",format:"pem"}),
      testReviewerSignature:sign("sha256",Buffer.from(challenge),
        reviewer.privateKey).toString("base64"),
      now:102,...extra
    };
  }
  return {issuer,reviewer,journal,db,challenge,envelope,proof};
}
test("two unrelated pinned P256 identities must both sign exact fixture",()=>{
  const f=fixture();
  try {
    const p=verify(f.proof());
    assert.equal(p.proposalId,"task_a");
    assert.equal(p.cryptographicChecksPassed,true);
    assert.equal(p.externalActionAllowed,false);
    assert.equal(p.humanAuthenticated,false);
    assert.notEqual(p.issuerFingerprint,p.reviewerFingerprint);
    assert.ok(Object.isFrozen(p));
  }finally{f.db.close();}
});
test("issuer signature made with another key is rejected",()=>{
  const f=fixture();
  try {
    assert.throws(()=>verify(f.proof({
      signedEnvelope:f.envelope({signer:ec().privateKey})
    })),/Issuer signature invalid/);
  }finally{f.db.close();}
});
test("test-reviewer signature made with another key is rejected",()=>{
  const f=fixture();
  try {
    const signed=sign("sha256",Buffer.from(f.challenge),ec().privateKey)
      .toString("base64");
    assert.throws(()=>verify(f.proof({testReviewerSignature:signed})),
      /Test-reviewer signature invalid/);
  }finally{f.db.close();}
});
test("same key cannot impersonate independently enrolled reviewer",()=>{
  const f=fixture();
  try {
    const pem=f.issuer.publicKey.export({format:"pem",type:"spki"});
    assert.throws(()=>verify(f.proof({reviewerPublicKeyPem:pem})),
      /must be distinct/);
  }finally{f.db.close();}
});
test("an otherwise properly signed envelope cannot contain different request bytes",()=>{
  const f=fixture();
  try {
    const other=f.challenge.replace("proposalId=task_a","proposalId=task_b");
    assert.throws(()=>verify(f.proof({
      signedEnvelope:f.envelope({challengeText:other})
    })),/different signed review request/);
  }finally{f.db.close();}
});
test("malicious scope in canonical bytes is rejected",()=>{
  const f=fixture();
  try{
    assert.throws(()=>verify(f.proof({
      expectedChallenge:f.challenge.replace(
        "operation=synthetic.preview","operation=email.send"
      )
    })),/Unexpected canonical/);
  }finally{f.db.close();}
});
test("signed DENY cannot be submitted as APPROVE",()=>{
  const f=fixture();
  try {
    const denial=f.challenge.replace("decision=APPROVE","decision=DENY");
    assert.throws(()=>verify(f.proof({
      expectedChallenge:denial,signedEnvelope:f.envelope({challengeText:denial}),
      testReviewerSignature:sign("sha256",Buffer.from(denial),
        f.reviewer.privateKey).toString("base64")
    })),/expired or denied/);
  }finally{f.db.close();}
});
test("envelope cannot outlive underlying approval or be used on expiry",()=>{
  const f=fixture();
  try {
    assert.throws(()=>verify(f.proof({
      signedEnvelope:f.envelope({expiresAt:70000})
    })),/exceeds approved scope/);
    assert.throws(()=>verify(f.proof({now:60000})),/Issuer envelope expired/);
    assert.throws(()=>verify(f.proof({now:60100})),/scope expired/);
  }finally{f.db.close();}
});
test("tampered envelope nonce is rejected",()=>{
  const f=fixture();
  try {
    const signed=f.envelope();
    const tampered=Buffer.from(signed.toString().replace(
      /nonce=[0-9a-f]{48}/,"nonce="+"a".repeat(48)
    ));
    assert.throws(()=>verify(f.proof({signedEnvelope:tampered})),
      /Issuer signature invalid/);
  }finally{f.db.close();}
});
test("invalid Base64 and injected extra fields fail closed",()=>{
  const f=fixture();
  try {
    const original=f.envelope().toString();
    assert.throws(()=>verify(f.proof({signedEnvelope:Buffer.from(
      original+"tool=browser.open\n"
    )})),/Untrusted issuer envelope format/);
    assert.throws(()=>verify(f.proof({signedEnvelope:Buffer.from(
      original.replace(/challengeB64=[^\n]+/,"challengeB64=abc%")
    )})),/Base64/);
  }finally{f.db.close();}
});
test("invalid or ambiguous UTF8 message rejected",()=>{
  const f=fixture();
  try {
    assert.throws(()=>verify(f.proof({
      signedEnvelope:Buffer.concat([f.envelope(),Buffer.from([0xff])])
    })),/Untrusted envelope encoding/);
  }finally{f.db.close();}
});
test("unapproved reviewer cannot bypass durable journal",()=>{
  const f=fixture();
  try {
    const p=verify(f.proof());
    assert.equal(p.externalActionAllowed,false);
    assert.throws(()=>f.journal.preview("task_a",{now:104}),/No unused approval/);
    assert.equal(f.journal.snapshot("task_a").state,"PENDING");
  }finally{f.db.close();}
});
test("signed test reviewer can consume only one inert journal preview",()=>{
  const f=fixture();
  try{
    const proposal=verify(f.proof());
    assert.equal(proposal.proposalId,"task_a");
    const p=f.proof();
    assert.equal(f.journal.decide("task_a",{
      decision:"APPROVE",signature:p.testReviewerSignature,now:103
    }).state,"APPROVED");
    const receipt=f.journal.preview("task_a",{now:104});
    assert.equal(receipt.externalActionAllowed,false);
    assert.equal(receipt.signedHumanConsentProven,false);
    assert.throws(()=>f.journal.preview("task_a",{now:105}),/No unused approval/);
  }finally{f.db.close();}
});
test("STOP blocks an otherwise cryptographically correct test reviewer signature",()=>{
  const f=fixture();
  try {
    const p=f.proof();verify(p);
    f.journal.stop({now:102});
    assert.throws(()=>f.journal.decide("task_a",{
      decision:"APPROVE",signature:p.testReviewerSignature,now:103
    }),/Persistent STOP/);
  }finally{f.db.close();}
});
test("wrong verifier curve and invalid signature representation rejected",()=>{
  const f=fixture();
  try {
    const wrong=generateKeyPairSync("ed25519");
    assert.throws(()=>verify(f.proof({
      reviewerPublicKeyPem:wrong.publicKey.export({type:"spki",format:"pem"})
    })),/Only independent P-256/);
    assert.throws(()=>verify(f.proof({testReviewerSignature:"evil"})),
      /Invalid DER/);
  }finally{f.db.close();}
});
test("unexpected fields cannot smuggle a test signer's private key or tool action",()=>{
  const f=fixture();
  try{
    const p=f.proof();
    p.privateKey="should never be used";
    assert.throws(()=>verify(p),/Unexpected dual-approval fields/);
    const q=f.proof();
    q.toolAction="email.send";
    assert.throws(()=>verify(q),/Unexpected dual-approval fields/);
  }finally{f.db.close();}
});
