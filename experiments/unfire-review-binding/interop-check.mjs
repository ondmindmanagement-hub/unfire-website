/**
 * Genuine read-only Node SQLite-issued challenge -> Swift CryptoKit digest binding.
 * The key is software-only and ephemeral; no signing is done here.
 * No Touch ID, Secure Enclave, account/file actions, or model calls.
 */
import { DatabaseSync } from "node:sqlite";
import { generateKeyPairSync } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { P256PreviewJournal } from "../unfire-p256-bridge/protocol.mjs";

const cli=process.argv[2];
if(!cli?.endsWith("/UnfireReviewBindingCLI"))
  throw new Error("Pass a compiled local Swift review-binding CLI path");
const key=generateKeyPairSync("ec",{
  namedCurve:"prime256v1",
  publicKeyEncoding:{format:"pem",type:"spki"},
  privateKeyEncoding:{format:"pem",type:"pkcs8"}
});
const db=new DatabaseSync(":memory:");
try {
  const ledger=new P256PreviewJournal({
    database:db,trustedPublicKeyPem:key.publicKey
  });
  ledger.propose({
    id:"task_a",fixtureId:"arithmetic",
    operation:"synthetic.preview",modelOutput:"42"
  },{now:100});
  const challenge=ledger.challenge("task_a",{now:101});
  const valid=Buffer.from(challenge.approveText,"utf8").toString("base64");
  const output=JSON.parse(execFileSync(cli,["--check-b64",valid,"101"],{
    encoding:"utf8",timeout:4000,maxBuffer:32768
  }));
  if(!output.verifiedBinding || output.proposalId!=="task_a" ||
     output.operation!=="synthetic.preview" ||
     output.externalActionAllowed!==false ||
     output.humanConsentSigned!==false ||
     output.issuerAuthenticated!==false)
    throw new Error("Swift review displayed an unverified claim");
  function rejects(message,time) {
    const check=spawnSync(cli,["--check-b64",
      Buffer.from(message,"utf8").toString("base64"),String(time)
    ],{encoding:"utf8",timeout:4000,maxBuffer:32768});
    return check.status!==0 && check.signal===null;
  }
  const wrongDigest=challenge.approveText.replace(
    /proposalDigest=[a-f0-9]{64}/,"proposalDigest="+"f".repeat(64)
  );
  if(!rejects(wrongDigest,101))throw new Error("Tampered proposal digest was displayed");
  const denial=challenge.denyText;
  if(!rejects(denial,101))throw new Error("DENY treated as approval");
  if(!rejects(challenge.approveText,60100))
    throw new Error("Expired request displayed");
  const wrongOperation=challenge.approveText.replace(
    "operation=synthetic.preview","operation=email.send");
  if(!rejects(wrongOperation,101))
    throw new Error("Unsupported tool scope was displayed");
  console.log(JSON.stringify({
    study:"Node SQLite-issued canonical P256 request -> Swift CryptoKit display binding",
    validManifestMatched:true,
    tamperedDigestRejected:true,
    deniedDecisionRejected:true,
    expiryRejected:true,
    unsupportedScopeRejected:true,
    externalActionAllowed:false,issuerAuthenticated:false,
    humanSignatureProduced:false,
    note:"Synthetic untrusted-issuer request display only. No Secure Enclave key or real action."
  },null,2));
}finally{
  db.close();
}
