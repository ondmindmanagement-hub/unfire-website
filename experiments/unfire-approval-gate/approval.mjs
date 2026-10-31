/**
 * Unfire OS · signed authorization for synthetic PREVIEW ONLY.
 *
 * This is NOT a tool executor or a secure user-authentication service.
 * A signature from a pinned Ed25519 key can approve only a synthetic preview event.
 * The verifier key must be provided by an integrator, not by an LLM proposal.
 * No filesystem, network, account, payment, or OS capabilities exist here.
 */
import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import { evaluateAnswer, fixtureById } from "../unfire-local-quality/fixtures.mjs";

const DOMAIN = "unfire.synthetic-preview-approval.v1";
const OPERATION = "synthetic.preview";
const STATES = Object.freeze({
  BLOCKED: "BLOCKED_QUALITY", PENDING: "PENDING_APPROVAL",
  APPROVED: "APPROVED", DENIED: "DENIED",
  PREVIEWED: "SIMULATED_PREVIEW", EXPIRED: "EXPIRED", CANCELLED: "CANCELLED"
});
const ID=/^[a-z][a-z0-9_-]{0,31}$/;
const MAX_PROPOSALS=12, TTL_MS=60000, MAX_OUTPUT_BYTES=2048;
const exact=(v,fields)=>v!==null && typeof v==="object" && !Array.isArray(v) &&
  Object.getPrototypeOf(v)===Object.prototype &&
  Object.keys(v).sort().join(",")===fields.slice().sort().join(",");
const nowValid=n=>Number.isSafeInteger(n)&&n>=0;
const sha=x=>createHash("sha256").update(x).digest("hex");

function safeProposal(p) {
  if(!exact(p,["id","fixtureId","modelOutput","operation"]) ||
     typeof p.id!=="string"||!ID.test(p.id)||
     typeof p.modelOutput!=="string"||
     Buffer.byteLength(p.modelOutput,"utf8")>MAX_OUTPUT_BYTES ||
     p.operation!==OPERATION) throw new TypeError("Unsafe or unsupported proposal");
  const fixture=fixtureById(p.fixtureId);
  const quality=evaluateAnswer(fixture,p.modelOutput);
  return {fixtureId:fixture.id,qualityPassed:quality.passed,
    digest:sha(JSON.stringify([DOMAIN,p.id,fixture.id,OPERATION,p.modelOutput]))};
}
function unsignedPayload(record,decision) {
  return JSON.stringify({
    domain:DOMAIN,
    proposalId:record.id,
    proposalDigest:record.digest,
    nonce:record.nonce,
    expiresAt:record.expiresAt,
    decision
  });
}
function validSignature(text) {
  if(typeof text!=="string"||! /^[A-Za-z0-9+/]{86}==$/.test(text))
    throw new TypeError("Invalid Ed25519 signature encoding");
  const buffer=Buffer.from(text,"base64");
  if(buffer.length!==64||buffer.toString("base64")!==text)
    throw new TypeError("Invalid signature bytes");
  return buffer;
}
export class SyntheticApprovalGate {
  #records=new Map();
  #events=[];
  #key;
  #stopped=false;
  constructor({trustedPublicKeyPem}={}) {
    if(typeof trustedPublicKeyPem!=="string"||trustedPublicKeyPem.length>4096)
      throw new TypeError("A pinned verifier key is required");
    try {
      this.#key=createPublicKey(trustedPublicKeyPem);
    } catch {
      throw new TypeError("Invalid pinned public key");
    }
    if(this.#key.asymmetricKeyType!=="ed25519"||
       this.#key.type!=="public") throw new TypeError("Only Ed25519 verification keys are allowed");
  }
  #event(id,type) {
    this.#events.push(Object.freeze({sequence:this.#events.length+1,id,type}));
  }
  events() {return this.#events.map(e=>({...e}));}
  #get(id) {
    const record=this.#records.get(id);
    if(!record)throw new Error("Unknown proposal");
    return record;
  }
  #summary(record) {
    return Object.freeze({
      id:record.id,
      state:record.state,
      qualityPassed:record.qualityPassed,
      digest:record.digest,
      expiresAt:record.expiresAt,
      // This experiment must never authorize a real external action.
      externalActionAllowed:false
    });
  }
  snapshot(id){return this.#summary(this.#get(id));}
  get stopped(){return this.#stopped;}
  propose(proposal,{now}={}) {
    if(this.#stopped)throw new Error("STOP active");
    if(!nowValid(now))throw new TypeError("Invalid clock value");
    if(this.#records.size>=MAX_PROPOSALS)throw new RangeError("Proposal budget exceeded");
    const safe=safeProposal(proposal);
    if(this.#records.has(proposal.id))throw new Error("Duplicate proposal id");
    const record={
      id:proposal.id, fixtureId:safe.fixtureId,
      digest:safe.digest,qualityPassed:safe.qualityPassed,
      createdAt:now,expiresAt:now+TTL_MS,nonce:randomBytes(16).toString("hex"),
      state:safe.qualityPassed?STATES.PENDING:STATES.BLOCKED
    };
    if(!Number.isSafeInteger(record.expiresAt))throw new RangeError("Clock overflow");
    this.#records.set(record.id,record);
    this.#event(record.id,record.state);
    return this.#summary(record);
  }
  /** The public challenge MUST be displayed by a trusted approval UI out of band. */
  challenge(id) {
    const record=this.#get(id);
    if(this.#stopped||record.state!==STATES.PENDING)
      throw new Error("Approval is unavailable");
    return Object.freeze({
      approveMessage:unsignedPayload(record,"APPROVE"),
      denyMessage:unsignedPayload(record,"DENY"),
      expiresAt:record.expiresAt
    });
  }
  decide(id,{decision,signature,now}={}) {
    if(this.#stopped)throw new Error("STOP active");
    const record=this.#get(id);
    if(record.state!==STATES.PENDING)throw new Error("Decision is no longer pending");
    if(!nowValid(now)||now<record.createdAt)throw new TypeError("Invalid clock value");
    if(now>=record.expiresAt) {
      record.state=STATES.EXPIRED;this.#event(id,record.state);
      throw new Error("Approval expired");
    }
    if(decision!=="APPROVE"&&decision!=="DENY")
      throw new TypeError("Unrecognized approval decision");
    const bytes=validSignature(signature);
    if(!verify(null,Buffer.from(unsignedPayload(record,decision)),this.#key,bytes))
      throw new Error("Signature rejected");
    record.state=decision==="APPROVE"?STATES.APPROVED:STATES.DENIED;
    this.#event(id,record.state);
    return this.#summary(record);
  }
  /**
   * Consume one approval and generate only an immutable event.
   * NO tool adapter, model output or external side effect runs here.
   */
  preview(id,{now}={}) {
    if(this.#stopped)throw new Error("STOP active");
    const record=this.#get(id);
    if(!nowValid(now)||now<record.createdAt)throw new TypeError("Invalid clock value");
    if(record.state!==STATES.APPROVED)throw new Error("No live approval");
    if(now>=record.expiresAt) {
      record.state=STATES.EXPIRED;this.#event(id,record.state);
      throw new Error("Approval expired");
    }
    if(!record.qualityPassed)throw new Error("Independent quality verification failed");
    record.state=STATES.PREVIEWED;
    this.#event(id,record.state);
    return Object.freeze({
      proposalId:id,state:STATES.PREVIEWED,proposalDigest:record.digest,
      simulated:true,externalActionAllowed:false,
      note:"Dry-run metadata only. No real tool or account operation occurred."
    });
  }
  stop() {
    if(this.#stopped)return;
    this.#stopped=true;
    for(const record of this.#records.values()) {
      if(record.state===STATES.PENDING||record.state===STATES.APPROVED) {
        record.state=STATES.CANCELLED;
        this.#event(record.id,record.state);
      }
    }
  }
}
export const APPROVAL_LAB_STATES=STATES;
