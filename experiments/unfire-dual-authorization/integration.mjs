/**
 * Full SYNTHETIC test-only handoff:
 *   Node controller test key -> signed envelope -> independent Swift verifier
 *   -> ephemeral software reviewer test key -> Node P256 durable approval.
 *
 * Signing the "reviewer" step simulates a future device action; it is NOT
 * human consent, Secure Enclave presence or permission to perform real work.
 */
import {DatabaseSync} from "node:sqlite";
import {generateKeyPairSync,randomBytes,sign} from "node:crypto";
import {spawnSync} from "node:child_process";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {P256PreviewJournal} from "../unfire-p256-bridge/protocol.mjs";
import {verifyDualSyntheticProof} from "./dual-key.mjs";

const binary=process.argv[2];
if(!binary?.endsWith("/IssuerEnvelopeCLI"))
  throw new Error("Expected isolated Swift issuer verifier binary path");
const work=mkdtempSync(join(tmpdir(),"unfire-dual-lab-"));
const issuer=generateKeyPairSync("ec",{namedCurve:"prime256v1"});
const reviewer=generateKeyPairSync("ec",{namedCurve:"prime256v1"});
const issuerPublicKeyDer=issuer.publicKey.export({type:"spki",format:"der"});
const reviewerPublicKeyPem=reviewer.publicKey.export({type:"spki",format:"pem"});
const issuerKeyB64=issuerPublicKeyDer.toString("base64");
const nodeDB=new DatabaseSync(join(work,"approval.sqlite"));
const journal=new P256PreviewJournal({
  database:nodeDB,trustedPublicKeyPem:reviewerPublicKeyPem
});
const localEvent={
  automatedSoftwareReviewerKey:true,
  protectedKeyUsed:false,
  humanAuthenticated:false,
  authenticatedProductionIssuer:false,
  externalActionAllowed:false,
  realActionsExecuted:0
};
function envelope(message,{key=issuer.privateKey,expiresAt=60000,
  nonce=randomBytes(24).toString("hex")}={}) {
  const body=[
    "UNFIRE-ISSUER-ENVELOPE-V1",
    "algorithm=ECDSA-P256-SHA256",
    "issuerId=unfire-local-controller",
    "nonce="+nonce,
    "expiresAt="+expiresAt,
    "challengeB64="+Buffer.from(message,"utf8").toString("base64"),
    ""
  ].join("\n");
  return Buffer.from(body+"signatureDER="+sign("sha256",
    Buffer.from(body,"utf8"),key).toString("base64")+"\n");
}
function callSwift(message,{dbFile="issuer.sqlite",mode="--consume",now=101,
  pin=issuerKeyB64}={}) {
  return spawnSync(binary,[mode,pin,join(work,dbFile),String(now)],{
    input:message,encoding:"utf8",timeout:8000,maxBuffer:16384
  });
}
function accepted(r,label) {
  if(r.status!==0||r.signal)throw new Error(label+" rejected: "+
    String(r.stderr).slice(0,180));
  const obj=JSON.parse(r.stdout);
  if(obj.proposalId!=="task_a"||obj.signedIssuerVerified!==true||
     obj.replayConsumed!==true||obj.externalActionAllowed!==false||
     obj.humanConsentProven!==false||obj.trustedProductionIdentityProven!==false)
    throw new Error(label+" unsafe or malformed");
}
function rejected(r,label) {
  if(r.status!==2||r.signal||r.stdout.trim()!=="")
    throw new Error(label+" was not rejected cleanly");
}
try {
  journal.propose({
    id:"task_a",fixtureId:"arithmetic",modelOutput:"42",
    operation:"synthetic.preview"
  },{now:100});
  const challenge=journal.challenge("task_a",{now:101}).approveText;
  const issued=envelope(challenge);
  if(journal.snapshot("task_a").state!=="PENDING")
    throw new Error("Approval advanced without verified origin");

  // Stage 1: independent Swift process proves pinned test-issuer signature,
  // immutable public manifest and one-time SQLite receipt.
  accepted(callSwift(issued),"legitimate controller envelope");
  rejected(callSwift(issued,{now:102}),"controller replay");
  if(journal.snapshot("task_a").state!=="PENDING")
    throw new Error("Controller signature bypassed separate review signature");
  localEvent.issuerEnvelopeValidated=true;
  localEvent.issuerReplayRejected=true;
  localEvent.separateReviewerRequired=true;

  // Stage 2: the TEST HARNESS simulates a future user signing event.
  // This is deliberately an ordinary ephemeral SOFTWARE P-256 key.
  const simulatedReviewerSignature=sign(
    "sha256",Buffer.from(challenge,"utf8"),reviewer.privateKey
  ).toString("base64");
  const proof=verifyDualSyntheticProof({
    signedEnvelope:issued,expectedChallenge:challenge,
    issuerPublicKeyDer,reviewerPublicKeyPem,
    testReviewerSignature:simulatedReviewerSignature,now:103
  });
  if(!proof.cryptographicChecksPassed||proof.externalActionAllowed!==false)
    throw new Error("Two distinct signatures did not bind exact request");
  localEvent.independentControllerAndReviewerSignaturesVerified=true;

  // Stage 3: the existing Node journal checks reviewer signature and
  // atomically consumes the approved PREVIEW. No real worker is called.
  const approved=journal.decide("task_a",{
    decision:"APPROVE",signature:simulatedReviewerSignature,now:104
  });
  if(approved.state!=="APPROVED")throw new Error("Review signature not approved");
  const preview=journal.preview("task_a",{now:105});
  if(preview.state!=="SIMULATED_PREVIEW"||
     preview.externalActionAllowed!==false||
     preview.signedHumanConsentProven!==false)
    throw new Error("Preview gained a forbidden capability");
  localEvent.syntheticPreviewConsumedOnce=true;
  let secondRejected=false;
  try{journal.preview("task_a",{now:106});}
  catch(e){secondRejected=/No unused approval/.test(e.message);}
  if(!secondRejected)throw new Error("Second reviewer consumption was allowed");
  localEvent.reviewerReplayRejected=true;

  // Reopen the actual on-disk Node journal: use is still exhausted.
  nodeDB.close();
  const reopenedDB=new DatabaseSync(join(work,"approval.sqlite"));
  try{
    const reopened=new P256PreviewJournal({
      database:reopenedDB,trustedPublicKeyPem:reviewerPublicKeyPem
    });
    let restartRejected=false;
    try{reopened.preview("task_a",{now:107});}
    catch(e){restartRejected=/No unused approval/.test(e.message);}
    if(!restartRejected)throw new Error("Node restart revived approved preview");
    localEvent.reviewerReplayRejectedAfterRestart=true;
  }finally{reopenedDB.close();}

  // Independent wrong-reviewer key must fail even after issuer signature passed.
  const badReviewer=generateKeyPairSync("ec",{namedCurve:"prime256v1"});
  const forged=sign("sha256",Buffer.from(challenge),
    badReviewer.privateKey).toString("base64");
  let wrongReviewerRejected=false;
  try{verifyDualSyntheticProof({
    signedEnvelope:issued,expectedChallenge:challenge,
    issuerPublicKeyDer,reviewerPublicKeyPem,
    testReviewerSignature:forged,now:103
  });}catch(e){wrongReviewerRejected=/reviewer signature invalid/.test(e.message);}
  if(!wrongReviewerRejected)throw new Error("Forged reviewer was accepted");
  localEvent.wrongReviewerRejected=true;

  // A fresh second fixed request cannot be used after stop.
  const stopped=callSwift(undefined,{
    dbFile:"stopped.sqlite",mode:"--stop",now:101
  });
  if(stopped.status!==0||JSON.parse(stopped.stdout).stopped!==true)
    throw new Error("Swift STOP not persisted");
  rejected(callSwift(issued,{
    dbFile:"stopped.sqlite",now:102
  }),"stopped issuer");
  localEvent.swiftStopPersistent=true;

  console.log(JSON.stringify({
    experiment:"Unfire OS isolated dual-key signed handoff",
    ...localEvent,
    caveat:"All keys are ephemeral software test identities generated by this harness. No real user reviewed, authenticated or signed anything; no production action capability exists."
  },null,2));
}finally {
  try{nodeDB.close();}catch{}
  rmSync(work,{recursive:true,force:true});
}
