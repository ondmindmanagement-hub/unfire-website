/**
 * Node -> Swift stdin IPC. A detached, ephemeral software P-256 issuer key
 * signs an inert SQLite-issued preview request. No keys persist and no
 * biometric, Secure Enclave, external service or production capability runs.
 */
import { DatabaseSync } from "node:sqlite";
import { generateKeyPairSync, randomBytes, sign } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { P256PreviewJournal } from "../unfire-p256-bridge/protocol.mjs";

const binary=process.argv[2];
if(!binary?.endsWith("/IssuerEnvelopeCLI"))
  throw new TypeError("Supply compiled isolated Swift IssuerEnvelopeCLI");
const work=mkdtempSync(join(tmpdir(),"unfire-issuer-ipc-"));
const issuer=generateKeyPairSync("ec",{
  namedCurve:"prime256v1",
  publicKeyEncoding:{type:"spki",format:"der"},
  privateKeyEncoding:{type:"pkcs8",format:"pem"}
});
const approvalKey=generateKeyPairSync("ec",{
  namedCurve:"prime256v1",
  publicKeyEncoding:{type:"spki",format:"pem"},
  privateKeyEncoding:{type:"pkcs8",format:"pem"}
});
const issuerKeyB64=issuer.publicKey.toString("base64");
const db=new DatabaseSync(":memory:");
const logResult={};
function packet({nonce=randomBytes(24).toString("hex"),expiresAt=60000,
  message,issuerPrivateKey=issuer.privateKey}={}) {
  const body=[
    "UNFIRE-ISSUER-ENVELOPE-V1",
    "algorithm=ECDSA-P256-SHA256",
    "issuerId=unfire-local-controller",
    "nonce="+nonce,"expiresAt="+expiresAt,
    "challengeB64="+Buffer.from(message,"utf8").toString("base64"),
    ""
  ].join("\n");
  const signature=sign("sha256",Buffer.from(body,"utf8"),issuerPrivateKey);
  return Buffer.from(body+"signatureDER="+signature.toString("base64")+"\n","utf8");
}
function run(input,filename,now=101,mode="--consume",key=issuerKeyB64){
  return spawnSync(binary,[mode,key,join(work,filename),String(now)],{
    input,encoding:"utf8",timeout:8000,maxBuffer:16384
  });
}
const ledger=new P256PreviewJournal({
  database:db,trustedPublicKeyPem:approvalKey.publicKey
});
ledger.propose({
  id:"task_a",fixtureId:"arithmetic",
  modelOutput:"42",operation:"synthetic.preview"
},{now:100});
const challenge=ledger.challenge("task_a",{now:101});
const valid=packet({message:challenge.approveText});
function requireSuccess(result,label){
  if(result.status!==0 || result.signal)throw new Error(label+": "+String(result.stderr).slice(0,160));
  const output=JSON.parse(result.stdout);
  if(!output.signedIssuerVerified || output.externalActionAllowed!==false ||
     output.humanConsentProven!==false ||
     output.trustedProductionIdentityProven!==false ||
     output.proposalId!=="task_a" || !output.replayConsumed)
    throw new Error(label+": unsafe success");
  return output;
}
function requireRejected(result,label){
  if(result.status!==2 || result.signal || result.stdout.trim()!=="")
    throw new Error(label+": unexpectedly accepted or crashed: "+JSON.stringify({
      status:result.status,signal:result.signal,stdout:result.stdout.slice(0,120)
    }));
}
async function concurrent(input,filename) {
  const call=()=>new Promise((resolve,reject)=>{
    const child=spawn(binary,["--consume",issuerKeyB64,join(work,filename),"101"],
      {stdio:["pipe","pipe","pipe"]});
    let stdout="",stderr="";
    child.stdout.on("data",x=>{stdout+=x.toString().slice(0,400)});
    child.stderr.on("data",x=>{stderr+=x.toString().slice(0,400)});
    child.on("error",reject);
    child.on("close",(code,signal)=>resolve({status:code,signal,stdout,stderr}));
    child.stdin.on("error",()=>{});
    child.stdin.end(input);
  });
  const pair=await Promise.all([call(),call()]);
  if(pair.filter(x=>x.status===0).length!==1 ||
     pair.filter(x=>x.status===2).length!==1)
    throw new Error("Concurrent approval replay not atomic");
  return true;
}

try {
  requireSuccess(run(valid,"single.sqlite"),"valid signed issuer");
  requireRejected(run(valid,"single.sqlite",102),"persisted replay");
  logResult.signedIssuerVerified=true;
  logResult.replayRejectedAfterRestart=true;

  const altered=Buffer.from(valid.toString().replace("expiresAt=60000","expiresAt=60001"));
  requireRejected(run(altered,"altered.sqlite"),"tampered signed bytes");
  logResult.tamperedEnvelopeRejected=true;

  const attacker=generateKeyPairSync("ec",{namedCurve:"prime256v1"});
  requireRejected(run(packet({message:challenge.approveText,issuerPrivateKey:attacker.privateKey}),
    "forgery.sqlite"),"forged issuer");
  logResult.wrongSignerRejected=true;

  requireRejected(run(valid,"expired.sqlite",60000),"expired envelope");
  logResult.expiredEnvelopeRejected=true;

  const deny=packet({message:challenge.denyText});
  requireRejected(run(deny,"denied.sqlite"),"non-APPROVE request");
  logResult.deniedScopeRejected=true;

  const dangerous=packet({message:challenge.approveText.replace(
    "operation=synthetic.preview","operation=email.send"
  )});
  requireRejected(run(dangerous,"tool.sqlite"),"unauthorized scope");
  logResult.toolScopeRejected=true;

  const stop=run(undefined,"stop.sqlite",100,"--stop");
  if(stop.status!==0 || JSON.parse(stop.stdout).stopped!==true)
    throw new Error("STOP not durably committed");
  requireRejected(run(valid,"stop.sqlite",101),"persistent STOP");
  logResult.persistentStopEnforced=true;

  if(!await concurrent(valid,"race.sqlite"))
    throw new Error("Concurrent single-use reservation failed");
  logResult.concurrentDoubleConsumeRejected=true;

  console.log(JSON.stringify({
    study:"Unfire issuer signed local process IPC, Node to Swift with SQLite",
    ...logResult,
    issuerKeyType:"ephemeral_software_P256",
    channel:"local_stdin_pipe",
    humanAuthenticated:false,
    secureEnclaveUsed:false,
    externalActionAllowed:false,
    realActionsExecuted:0,
    disclaimer:"This test pins a temporary key within a trusted local harness. It is not production issuer identity or authenticated human consent."
  },null,2));
}finally{
  db.close();
  rmSync(work,{recursive:true,force:true});
}
