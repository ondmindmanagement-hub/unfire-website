/**
 * Unfire OS dual-key, no-effect cryptographic research.
 * TWO ephemeral, separately pinned P-256 test identities are required:
 *  1) test controller signs envelope containing exact canonical request;
 *  2) test reviewer signs the same canonical request.
 * NO live user presence, real authority or executable capability is implied.
 */
import {createHash,createPublicKey,verify} from "node:crypto";
import {canonicalP256} from "../unfire-p256-bridge/protocol.mjs";

const HEADER="UNFIRE-ISSUER-ENVELOPE-V1";
const fixedIssuer="issuerId=unfire-local-controller";
const p256=x=>x?.type==="public"&&x?.asymmetricKeyType==="ec"&&
  x.asymmetricKeyDetails?.namedCurve==="prime256v1";
const sha=buffer=>createHash("sha256").update(buffer).digest("hex");
function derBase64(value) {
  if(typeof value!=="string"||value.length>120||
     !/^[A-Za-z0-9+/]+={0,2}$/.test(value))throw new Error("Invalid DER signature");
  const bytes=Buffer.from(value,"base64");
  if(bytes.length<68||bytes.length>74||bytes[0]!==0x30||
     bytes.toString("base64")!==value)throw new Error("Invalid DER signature");
  return bytes;
}
function strictB64(x) {
  if(typeof x!=="string"||x.length>2048||
     !/^[A-Za-z0-9+/]+={0,2}$/.test(x))throw new Error("Invalid challenge Base64");
  const b=Buffer.from(x,"base64");
  if(b.toString("base64")!==x||b.length>1024||b.length<100)
    throw new Error("Invalid challenge Base64");
  return b;
}
function verifyCanonicalChallenge(text) {
  if(typeof text!=="string"||Buffer.byteLength(text)>1024)
    throw new Error("Unexpected canonical challenge");
  const v=text.split("\n");
  if(v.length!==9||v[0]!=="UNFIRE-P256-V1"||
    v[1]!=="algorithm=ECDSA-P256-SHA256"||
    v[2]!=="operation=synthetic.preview"||v[8]!=="")
    throw new Error("Unexpected canonical challenge");
  const get=(i,prefix)=>{
    if(!v[i].startsWith(prefix))throw new Error("Unexpected canonical challenge");
    return v[i].slice(prefix.length);
  };
  const fields={
    proposalId:get(3,"proposalId="),
    proposalDigest:get(4,"proposalDigest="),
    nonce:get(5,"nonce="),
    expiresAt:Number(get(6,"expiresAt=")),
    decision:get(7,"decision=")
  };
  if(!Number.isSafeInteger(fields.expiresAt)||
     String(fields.expiresAt)!==get(6,"expiresAt=")||
     canonicalP256(fields)!==text)
    throw new Error("Unexpected canonical challenge");
  return fields;
}
export function verifyDualSyntheticProof({
  signedEnvelope,expectedChallenge,
  issuerPublicKeyDer,reviewerPublicKeyPem,
  testReviewerSignature,now
}={}) {
  if(!Number.isSafeInteger(now)||now<0)
    throw new Error("Invalid test clock");
  if(!Buffer.isBuffer(signedEnvelope)||signedEnvelope.length>4096||
     signedEnvelope.length<180||!Buffer.isBuffer(issuerPublicKeyDer)||
     typeof reviewerPublicKeyPem!=="string")
    throw new Error("Invalid input");
  const fields=verifyCanonicalChallenge(expectedChallenge);
  if(fields.decision!=="APPROVE"||now>=fields.expiresAt)
    throw new Error("Test approval scope expired or denied");
  let issuer,reviewer;
  try{
    issuer=createPublicKey({key:issuerPublicKeyDer,format:"der",type:"spki"});
    reviewer=createPublicKey(reviewerPublicKeyPem);
  }catch{throw new Error("Untrusted public key");}
  if(!p256(issuer)||!p256(reviewer))
    throw new Error("Only independent P-256 identities allowed");
  const issuerFingerprint=sha(issuer.export({format:"der",type:"spki"}));
  const reviewerFingerprint=sha(reviewer.export({format:"der",type:"spki"}));
  if(issuerFingerprint===reviewerFingerprint)
    throw new Error("Controller and test-reviewer must be distinct");
  const text=signedEnvelope.toString("utf8");
  if(Buffer.compare(Buffer.from(text,"utf8"),signedEnvelope)!==0||
     !/^[\x20-\x7e\n]+$/.test(text))
    throw new Error("Untrusted envelope encoding");
  const lines=text.split("\n");
  if(lines.length!==8||lines[0]!==HEADER||
    lines[1]!=="algorithm=ECDSA-P256-SHA256"||
    lines[2]!==fixedIssuer||lines[7]!=="")
    throw new Error("Untrusted issuer envelope format");
  if(!/^nonce=[0-9a-f]{48}$/.test(lines[3])||
     !/^expiresAt=(0|[1-9][0-9]{0,15})$/.test(lines[4])||
     !lines[5].startsWith("challengeB64=")||
     !lines[6].startsWith("signatureDER="))
    throw new Error("Untrusted issuer envelope fields");
  const envelopeExpiry=Number(lines[4].slice(10));
  if(!Number.isSafeInteger(envelopeExpiry)||now>=envelopeExpiry||
     envelopeExpiry>fields.expiresAt)
    throw new Error("Issuer envelope expired or exceeds approved scope");
  const issuedChallenge=strictB64(lines[5].slice("challengeB64=".length));
  if(!issuedChallenge.equals(Buffer.from(expectedChallenge,"utf8")))
    throw new Error("Controller sent a different signed review request");
  const issuerSignature=derBase64(lines[6].slice("signatureDER=".length));
  const issuerSignedBody=Buffer.from(lines.slice(0,6).join("\n")+"\n","utf8");
  if(!verify("sha256",issuerSignedBody,issuer,issuerSignature))
    throw new Error("Issuer signature invalid");
  const reviewerSignature=derBase64(testReviewerSignature);
  if(!verify("sha256",Buffer.from(expectedChallenge,"utf8"),reviewer,reviewerSignature))
    throw new Error("Test-reviewer signature invalid");
  return Object.freeze({
    proposalId:fields.proposalId,
    proposalDigest:fields.proposalDigest,
    issuerFingerprint,reviewerFingerprint,
    envelopeNonce:lines[3].slice(6),
    envelopeExpiresAt:envelopeExpiry,
    cryptographicChecksPassed:true,
    simulated:true,
    humanAuthenticated:false,
    issuerProductionIdentityProven:false,
    externalActionAllowed:false
  });
}
