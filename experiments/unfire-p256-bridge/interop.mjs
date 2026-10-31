/**
 * Local Swift CryptoKit -> Node P-256 interop test.
 * Uses one ephemeral software key INSIDE child Swift process, never persists it.
 * No LocalAuthentication, Secure Enclave enrollment, accounts, network or tools.
 */
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { P256PreviewJournal as Journal } from "./protocol.mjs";

const child=spawn("/usr/bin/swift",[
  fileURLToPath(new URL("./SwiftInteropVector.swift",import.meta.url)),
  "--interactive-test-only"
],{stdio:["pipe","pipe","pipe"],env:process.env});
let stderr="";
child.stderr.on("data",part=>{if(stderr.length<2000)stderr+=part.toString().slice(0,512);});
const timer=setTimeout(()=>child.kill("SIGKILL"),25000);
const lines=createInterface({input:child.stdout,crlfDelay:Infinity});
const iterator=lines[Symbol.asyncIterator]();
const db=new DatabaseSync(":memory:");
try{
  const first=await iterator.next();
  if(first.done || !first.value.startsWith("KEY:"))throw new Error("Swift key exchange missing");
  const pem=Buffer.from(first.value.slice(4),"base64").toString("utf8");
  if(!pem.startsWith("-----BEGIN PUBLIC KEY-----"))throw new Error("Unrecognized verifier");
  const ledger=new Journal({database:db,trustedPublicKeyPem:pem});
  ledger.propose({
    id:"task_a",fixtureId:"arithmetic",modelOutput:"42",
    operation:"synthetic.preview"
  },{now:100});
  const challenge=ledger.challenge("task_a",{now:101});
  child.stdin.write(Buffer.from(challenge.approveText,"utf8").toString("base64")+"\n");
  child.stdin.end();
  const second=await iterator.next();
  if(second.done || !second.value.startsWith("SIGNATURE:"))
    throw new Error("Swift test signer did not return DER signature: "+stderr.slice(0,160));
  const signature=second.value.slice("SIGNATURE:".length);
  const approved=ledger.decide("task_a",{now:102,decision:"APPROVE",signature});
  if(approved.state!=="APPROVED")throw new Error("Node did not verify Swift signature");
  const preview=ledger.preview("task_a",{now:103});
  if(!preview.simulated || preview.externalActionAllowed!==false ||
    preview.signedHumanConsentProven!==false)throw new Error("Unsafe preview result");
  let replayRejected=false;
  try{ledger.preview("task_a",{now:104});}catch(e){
    replayRejected=/No unused approval/.test(e.message);
  }
  if(!replayRejected)throw new Error("Consumed preview unexpectedly replayed");
  const third=await iterator.next();
  if(!third.done)throw new Error("Unexpected extra signer output");
  console.log(JSON.stringify({
    kind:"Swift CryptoKit P256 to Node crypto and SQLite preview-only interop",
    verifiedSignature:true,canonicalBytesMatched:true,
    ephemeralSoftwareKey:true,secureEnclaveKey:false,
    humanAuthenticated:false,signedHumanConsentProven:false,
    singleUseConsumed:true,replayRejected:true,
    externalActionAllowed:false,externalActionsExecuted:0,
    note:"Crypto interop and a simulated preview ONLY. Not a protected signer or a real user authorization."
  },null,2));
}finally{
  clearTimeout(timer);
  lines.close();
  db.close();
  if(child.exitCode===null)child.kill("SIGTERM");
}
