/**
 * End-to-end READ-ONLY Node-issued P-256 preview -> Swift consent preflight.
 * No user interaction, no LAContext, no Keychain or Secure Enclave access,
 * no signer action, no token consumption and no real tool execution.
 */
import {DatabaseSync} from "node:sqlite";
import {generateKeyPairSync,randomBytes,sign} from "node:crypto";
import {mkdtempSync,rmSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {spawnSync} from "node:child_process";
import {P256PreviewJournal} from "../unfire-p256-bridge/protocol.mjs";

const binary=process.argv[2];
if(!binary?.endsWith("/ConsentSessionProbe"))
  throw new Error("Expected a compiled, isolated Swift ConsentSessionProbe");
const dir=mkdtempSync(join(tmpdir(),"unfire-consent-probe-"));
const issuer=generateKeyPairSync("ec",{
  namedCurve:"prime256v1",
  publicKeyEncoding:{type:"spki",format:"der"},
  privateKeyEncoding:{type:"pkcs8",format:"pem"}
});
const reviewer=generateKeyPairSync("ec",{
  namedCurve:"prime256v1",
  publicKeyEncoding:{type:"spki",format:"der"},
  privateKeyEncoding:{type:"pkcs8",format:"pem"}
});
const issuerDER=issuer.publicKey;
const reviewerDER=reviewer.publicKey;
const nodeKey=generateKeyPairSync("ec",{
  namedCurve:"prime256v1",
  publicKeyEncoding:{type:"spki",format:"pem"},
  privateKeyEncoding:{type:"pkcs8",format:"pem"}
});
const nodeDB=new DatabaseSync(":memory:");
function envelope(message,{signer=issuer.privateKey,
  nonce=randomBytes(24).toString("hex")}={}) {
  const body=[
    "UNFIRE-ISSUER-ENVELOPE-V1",
    "algorithm=ECDSA-P256-SHA256",
    "issuerId=unfire-local-controller",
    "nonce="+nonce,
    "expiresAt=60000",
    "challengeB64="+Buffer.from(message).toString("base64"),
    ""
  ].join("\n");
  return Buffer.from(body+"signatureDER="+sign("sha256",Buffer.from(body),signer)
    .toString("base64")+"\n");
}
function run(bytes,{now=101,key=issuerDER,reviewerKey=reviewerDER,
  filename="review.sqlite"}={}) {
  return spawnSync(binary,[
    "--inspect-research-b64",bytes.toString("base64"),
    key.toString("base64"),reviewerKey.toString("base64"),
    join(dir,filename),String(now)
  ],{encoding:"utf8",timeout:10000,maxBuffer:16384});
}
function accept(r) {
  if(r.status!==0||r.signal)throw new Error("Valid signed preflight refused: "+r.stderr);
  const x=JSON.parse(r.stdout);
  if(!x.exactRequestMatched||!x.pending||x.proposalId!=="task_a"||
     x.operation!=="synthetic.preview"||
     x.externalActionAllowed!==false||x.humanConsentProven!==false||
     x.productionIdentityProven!==false||x.actualToolExecuted!==false)
    throw new Error("Unsafe preflight result");
}
function reject(r) {
  if(r.status!==2||r.signal||r.stdout.trim())
    throw new Error("Invalid preflight not rejected cleanly");
}
try{
  const approval=new P256PreviewJournal({
    database:nodeDB,trustedPublicKeyPem:nodeKey.publicKey
  });
  approval.propose({
    id:"task_a",fixtureId:"arithmetic",
    modelOutput:"42",operation:"synthetic.preview"
  },{now:100});
  const challenge=approval.challenge("task_a",{now:101}).approveText;
  const valid=envelope(challenge);
  accept(run(valid));
  accept(run(valid)); // opening/reopening a preview MUST NOT consume it
  const journal=new DatabaseSync(join(dir,"review.sqlite"));
  try{
    const seen=journal.prepare("SELECT COUNT(*) AS n FROM issuer_seen").get().n;
    if(seen!==0)throw new Error("Preview inspection consumed issuer authorization before click");
  }finally{journal.close();}
  reject(run(valid,{now:60000,filename:"expired.sqlite"}));
  reject(run(valid,{key:generateKeyPairSync("ec",{
    namedCurve:"prime256v1",
    publicKeyEncoding:{type:"spki",format:"der"},
    privateKeyEncoding:{type:"pkcs8",format:"pem"}
  }).publicKey,filename:"wrongissuer.sqlite"}));
  reject(run(valid,{reviewerKey:issuerDER,filename:"samekey.sqlite"}));
  reject(run(envelope(challenge,{signer:generateKeyPairSync("ec",{
    namedCurve:"prime256v1"
  }).privateKey}),{filename:"forgery.sqlite"}));
  reject(run(envelope(challenge.replace("operation=synthetic.preview",
    "operation=email.send")),{filename:"badscope.sqlite"}));
  console.log(JSON.stringify({
    test:"Node SQLite P256 issuer to macOS signed-review preflight",
    signedIssuerChecked:true,exactFixedManifestMatched:true,
    separateReviewerPinRequired:true,
    issuerSpoofingRejected:true,forgedEnvelopeRejected:true,
    changedScopeRejected:true,expiredEnvelopeRejected:true,
    displayDoesNotConsumeNonce:true,
    userAuthentication:false,protectedSigning:false,
    externalActionAllowed:false,actualToolsExecuted:0
  },null,2));
}finally{
  nodeDB.close();
  rmSync(dir,{recursive:true,force:true});
}
