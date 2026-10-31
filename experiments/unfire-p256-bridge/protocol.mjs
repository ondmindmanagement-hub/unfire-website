/**
 * P-256 SHA-256 approval research · preview-only, no tool execution.
 * Only the integrator controls the database, key and clock.
 */
import { DatabaseSync } from "node:sqlite";
import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import { evaluateAnswer, fixtureById } from "../unfire-local-quality/fixtures.mjs";

export const DOMAIN="UNFIRE-P256-V1";
export const OPERATION="synthetic.preview";
const ID=/^[a-z][a-z0-9_-]{0,31}$/;
const HEX=/^[0-9a-f]{64}$/;
const exact=(v,fields)=>v!==null&&typeof v==="object"&&!Array.isArray(v)&&
  Object.getPrototypeOf(v)===Object.prototype&&
  Object.keys(v).sort().join(",")===fields.slice().sort().join(",");
const sha=x=>createHash("sha256").update(x).digest("hex");
const validTime=x=>Number.isSafeInteger(x)&&x>=0;
const states=Object.freeze({
  PENDING:"PENDING",APPROVED:"APPROVED",DENIED:"DENIED",
  BLOCKED:"BLOCKED_QUALITY",EXPIRED:"EXPIRED",STOPPED:"STOPPED",
  REVOKED:"REVOKED",CONSUMED:"SIMULATED_PREVIEW"
});
export const P256_STATES=states;

export function canonicalP256({proposalId,proposalDigest,nonce,expiresAt,decision}={}) {
  if(typeof proposalId!=="string"||!ID.test(proposalId)||
     typeof proposalDigest!=="string"||!HEX.test(proposalDigest)||
     typeof nonce!=="string"||!/^[0-9a-f]{48}$/.test(nonce)||
     !validTime(expiresAt)||!["APPROVE","DENY"].includes(decision))
    throw new TypeError("Invalid canonical P-256 challenge");
  return [DOMAIN,"algorithm=ECDSA-P256-SHA256","operation="+OPERATION,
    "proposalId="+proposalId,"proposalDigest="+proposalDigest,"nonce="+nonce,
    "expiresAt="+expiresAt,"decision="+decision,""].join("\n");
}
function decodeSignature(signature) {
  if(typeof signature!=="string"||signature.length>140||
     !/^[A-Za-z0-9+/]+={0,2}$/.test(signature))throw new TypeError("Invalid DER signature");
  const raw=Buffer.from(signature,"base64");
  if(raw.length<68||raw.length>74||raw[0]!==0x30||
     raw.toString("base64")!==signature)throw new TypeError("Invalid DER signature");
  return raw;
}
function validateProposal(p) {
  if(!exact(p,["id","fixtureId","modelOutput","operation"])||
     typeof p.id!=="string"||!ID.test(p.id)||p.operation!==OPERATION||
     typeof p.modelOutput!=="string"||
     Buffer.byteLength(p.modelOutput,"utf8")>2048)
    throw new TypeError("Invalid synthetic P-256 proposal");
  const fixture=fixtureById(p.fixtureId),quality=evaluateAnswer(fixture,p.modelOutput);
  return {id:p.id,fixture:fixture.id,passed:quality.passed,
    digest:sha(JSON.stringify([DOMAIN,p.id,fixture.id,OPERATION,p.modelOutput]))};
}
const view=r=>Object.freeze({
  id:r.id,state:r.state,proposalDigest:r.digest,expiresAt:r.expires_at,
  externalActionAllowed:false,signedHumanConsentProven:false
});
export class P256PreviewJournal {
  #db;#key;
  constructor({database,trustedPublicKeyPem}={}) {
    if(!(database instanceof DatabaseSync))throw new TypeError("Trusted SQLite required");
    if(typeof trustedPublicKeyPem!=="string"||trustedPublicKeyPem.length>4096)
      throw new TypeError("Trusted public verifier required");
    try{this.#key=createPublicKey(trustedPublicKeyPem);}
    catch{throw new TypeError("Invalid P-256 verifier key");}
    if(this.#key.type!=="public"||this.#key.asymmetricKeyType!=="ec"||
       this.#key.asymmetricKeyDetails?.namedCurve!=="prime256v1")
      throw new TypeError("Only P-256 verification allowed");
    this.#db=database;
    database.exec("PRAGMA busy_timeout=2500; PRAGMA synchronous=FULL;");
    database.exec(
      "CREATE TABLE IF NOT EXISTS p256_meta("+
      "id INTEGER PRIMARY KEY CHECK(id=1),last_ms INTEGER NOT NULL,"+
      "stopped INTEGER NOT NULL CHECK(stopped IN(0,1)),"+
      "key_fingerprint TEXT NOT NULL);"+
      "CREATE TABLE IF NOT EXISTS p256_requests("+
      "id TEXT PRIMARY KEY,digest TEXT NOT NULL,fixture TEXT NOT NULL,"+
      "nonce TEXT NOT NULL UNIQUE,created_at INTEGER NOT NULL,"+
      "expires_at INTEGER NOT NULL,state TEXT NOT NULL,"+
      "approved_at INTEGER);"+
      "CREATE TABLE IF NOT EXISTS p256_audit("+
      "seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL,state TEXT NOT NULL);"
    );
    const keyFingerprint=sha(this.#key.export({format:"der",type:"spki"}));
    database.prepare("INSERT OR IGNORE INTO p256_meta"+
      "(id,last_ms,stopped,key_fingerprint) VALUES(1,-1,0,?)").run(keyFingerprint);
    const pinned=database.prepare("SELECT key_fingerprint FROM p256_meta WHERE id=1").get();
    if(pinned.key_fingerprint!==keyFingerprint)throw new Error("Pinned P-256 key mismatch");
  }
  #tx(fn) {
    this.#db.exec("BEGIN IMMEDIATE");
    try{const result=fn();this.#db.exec("COMMIT");return result;}
    catch(e){try{this.#db.exec("ROLLBACK");}catch{}throw e;}
  }
  #meta(){return this.#db.prepare("SELECT * FROM p256_meta WHERE id=1").get();}
  #clock(now) {
    if(!validTime(now))throw new TypeError("Invalid trusted timestamp");
    const meta=this.#meta();
    if(meta.stopped)throw new Error("Persistent STOP active");
    if(now<meta.last_ms)throw new Error("Clock rollback rejected");
    this.#db.prepare("UPDATE p256_meta SET last_ms=? WHERE id=1").run(now);
  }
  #record(id) {
    if(typeof id!=="string"||!ID.test(id))throw new TypeError("Invalid proposal identifier");
    const r=this.#db.prepare("SELECT * FROM p256_requests WHERE id=?").get(id);
    if(!r)throw new Error("Unknown proposal");return r;
  }
  #set(id,state,approvedAt=null) {
    this.#db.prepare("UPDATE p256_requests SET state=?,approved_at=COALESCE(?,approved_at) WHERE id=?")
      .run(state,approvedAt,id);
    this.#db.prepare("INSERT INTO p256_audit(id,state) VALUES(?,?)").run(id,state);
  }
  propose(proposal,options={}) {
    if(!exact(options,["now"]))throw new TypeError("Unexpected proposal options");
    const safe=validateProposal(proposal);
    return this.#tx(()=>{
      this.#clock(options.now);
      if(options.now+60000>Number.MAX_SAFE_INTEGER)throw new RangeError("Clock overflow");
      if(this.#db.prepare("SELECT COUNT(*) AS n FROM p256_requests").get().n>=12)
        throw new RangeError("Synthetic proposal budget exhausted");
      const nonce=randomBytes(24).toString("hex"),state=safe.passed?states.PENDING:states.BLOCKED;
      this.#db.prepare("INSERT INTO p256_requests"+
        "(id,digest,fixture,nonce,created_at,expires_at,state,approved_at) "+
        "VALUES(?,?,?,?,?,?,?,NULL)").run(
          safe.id,safe.digest,safe.fixture,nonce,options.now,options.now+60000,state);
      this.#db.prepare("INSERT INTO p256_audit(id,state) VALUES(?,?)").run(safe.id,state);
      return view(this.#record(safe.id));
    });
  }
  challenge(id,options={}) {
    if(!exact(options,["now"]))throw new TypeError("Unexpected challenge options");
    return this.#tx(()=>{
      this.#clock(options.now);
      const r=this.#record(id);
      if(r.state!==states.PENDING)throw new Error("No pending review");
      if(options.now>=r.expires_at){this.#set(id,states.EXPIRED);return Object.freeze({expired:true});}
      return Object.freeze({approveText:canonicalP256({
        proposalId:r.id,proposalDigest:r.digest,nonce:r.nonce,
        expiresAt:r.expires_at,decision:"APPROVE"
      }),denyText:canonicalP256({
        proposalId:r.id,proposalDigest:r.digest,nonce:r.nonce,
        expiresAt:r.expires_at,decision:"DENY"
      }),expiresAt:r.expires_at});
    });
  }
  decide(id,options={}) {
    if(!exact(options,["now","decision","signature"]))
      throw new TypeError("Unexpected signed-decision fields");
    if(!["APPROVE","DENY"].includes(options.decision))
      throw new TypeError("Unknown signed decision");
    const signature=decodeSignature(options.signature);
    return this.#tx(()=>{
      this.#clock(options.now);
      const r=this.#record(id);
      if(r.state!==states.PENDING)throw new Error("Already decided or revoked");
      if(options.now>=r.expires_at){this.#set(id,states.EXPIRED);return Object.freeze({expired:true});}
      const message=canonicalP256({
        proposalId:r.id,proposalDigest:r.digest,nonce:r.nonce,
        expiresAt:r.expires_at,decision:options.decision
      });
      if(!verify("sha256",Buffer.from(message,"utf8"),this.#key,signature))
        throw new Error("P-256 signature rejected");
      this.#set(id,options.decision==="APPROVE"?states.APPROVED:states.DENIED,options.now);
      return view(this.#record(id));
    });
  }
  preview(id,options={}) {
    if(!exact(options,["now"]))throw new TypeError("Unexpected preview options");
    return this.#tx(()=>{
      this.#clock(options.now);
      const r=this.#record(id);
      if(r.state!==states.APPROVED)throw new Error("No unused approval");
      if(options.now<r.approved_at)throw new Error("Approval clock rollback");
      if(options.now>=r.expires_at){this.#set(id,states.EXPIRED);return Object.freeze({expired:true});}
      this.#set(id,states.CONSUMED);
      return Object.freeze({id,state:states.CONSUMED,simulated:true,
        externalActionAllowed:false,signedHumanConsentProven:false});
    });
  }
  revoke(id,options={}) {
    if(!exact(options,["now"]))throw new TypeError("Unexpected revocation options");
    return this.#tx(()=>{
      this.#clock(options.now);const r=this.#record(id);
      if([states.PENDING,states.APPROVED].includes(r.state))this.#set(id,states.REVOKED);
      return view(this.#record(id));
    });
  }
  stop(options={}) {
    if(!exact(options,["now"]))throw new TypeError("Unexpected STOP options");
    return this.#tx(()=>{
      if(this.#meta().stopped)return Object.freeze({stopped:true});
      this.#clock(options.now);
      const targets=this.#db.prepare("SELECT id FROM p256_requests WHERE state IN (?,?)")
        .all(states.PENDING,states.APPROVED);
      for(const t of targets)this.#set(t.id,states.STOPPED);
      this.#db.prepare("UPDATE p256_meta SET stopped=1 WHERE id=1").run();
      return Object.freeze({stopped:true});
    });
  }
  snapshot(id){return view(this.#record(id));}
  audit(){return Object.freeze(this.#db.prepare(
    "SELECT seq,id,state FROM p256_audit ORDER BY seq").all().map(x=>Object.freeze({...x})));}
  status(){const m=this.#meta();return Object.freeze({
    stopped:!!m.stopped,lastSeenMs:m.last_ms,externalActionAllowed:false
  });}
}
