/**
 * Unfire OS · durable, synthetic-preview-only approval research.
 * A pinned Ed25519 public key and node:sqlite connection are provided by the
 * trusted integrator, never by a model. No real action adapter exists.
 */
import { DatabaseSync } from "node:sqlite";
import { createHash, createPublicKey, randomBytes, verify } from "node:crypto";
import { fixtureById, evaluateAnswer } from "../unfire-local-quality/fixtures.mjs";

export const DOMAIN="unfire.durable-synthetic-preview.v1";
export const STATE=Object.freeze({
  PENDING:"PENDING",BLOCKED:"BLOCKED_QUALITY",APPROVED:"APPROVED",
  DENIED:"DENIED",CONSUMED:"SIMULATED_PREVIEW",EXPIRED:"EXPIRED",
  REVOKED:"REVOKED",CANCELLED:"CANCELLED"
});
const ID=/^[a-z][a-z0-9_-]{0,31}$/;
const exact=(x,keys)=>x!==null&&typeof x==="object"&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype&&
  Object.keys(x).sort().join(",")===keys.slice().sort().join(",");
const digest=text=>createHash("sha256").update(text).digest("hex");
const safeNow=now=>Number.isSafeInteger(now)&&now>=0;
function normalize(p) {
  if(!exact(p,["id","fixtureId","modelOutput","operation"])||
    typeof p.id!=="string"||!ID.test(p.id)||
    p.operation!=="synthetic.preview"||typeof p.modelOutput!=="string"||
    Buffer.byteLength(p.modelOutput,"utf8")>2048)
    throw new TypeError("Invalid synthetic proposal");
  const f=fixtureById(p.fixtureId),quality=evaluateAnswer(f,p.modelOutput);
  return {id:p.id,fixture:f.id,digest:digest(JSON.stringify(
    [DOMAIN,p.id,f.id,"synthetic.preview",p.modelOutput])),quality:quality.passed};
}
function signatureBytes(signature) {
  if(typeof signature!=="string"||!/^[A-Za-z0-9+/]{86}==$/.test(signature))
    throw new TypeError("Invalid Ed25519 signature");
  const b=Buffer.from(signature,"base64");
  if(b.length!==64||b.toString("base64")!==signature)
    throw new TypeError("Invalid Ed25519 signature");
  return b;
}
function canonical(r,decision) {
  return JSON.stringify({
    domain:DOMAIN,proposalId:r.id,proposalDigest:r.digest,
    nonce:r.nonce,expiresAt:r.expires_at,decision
  });
}
function view(r) {
  return Object.freeze({id:r.id,state:r.state,digest:r.digest,
    fixtureId:r.fixture_id,expiresAt:r.expires_at,externalActionAllowed:false});
}
export class DurableSyntheticApproval {
  #db;#key;
  constructor({database,trustedPublicKeyPem}={}) {
    if(!(database instanceof DatabaseSync))throw new TypeError("Trusted SQLite connection required");
    if(typeof trustedPublicKeyPem!=="string"||trustedPublicKeyPem.length>4096)
      throw new TypeError("Pinned Ed25519 verification key required");
    try{this.#key=createPublicKey(trustedPublicKeyPem);}
    catch{throw new TypeError("Invalid verification key");}
    if(this.#key.type!=="public"||this.#key.asymmetricKeyType!=="ed25519")
      throw new TypeError("Ed25519 verification key required");
    this.#db=database;
    database.exec("PRAGMA busy_timeout = 2500; PRAGMA synchronous = FULL;");
    database.exec(
      "CREATE TABLE IF NOT EXISTS synthetic_approval_meta ("+
      "id INTEGER PRIMARY KEY CHECK(id=1),last_seen_ms INTEGER NOT NULL,"+
      "stopped INTEGER NOT NULL CHECK(stopped IN (0,1)),"+
      "pinned_key_fingerprint TEXT NOT NULL);"+
      "CREATE TABLE IF NOT EXISTS synthetic_approval_requests ("+
      "id TEXT PRIMARY KEY,fixture_id TEXT NOT NULL,digest TEXT NOT NULL,"+
      "nonce TEXT NOT NULL UNIQUE,issued_at INTEGER NOT NULL,"+
      "expires_at INTEGER NOT NULL,approved_at INTEGER,state TEXT NOT NULL);"+
      "CREATE TABLE IF NOT EXISTS synthetic_approval_audit ("+
      "seq INTEGER PRIMARY KEY AUTOINCREMENT,id TEXT NOT NULL,state TEXT NOT NULL);"
    );
    // Bind the trusted verifier identity to the durable journal itself.
    // Reopening the same database with a different public key must fail.
    const fingerprint=digest(this.#key.export({format:"der",type:"spki"}));
    database.prepare(
      "INSERT OR IGNORE INTO synthetic_approval_meta"+
      "(id,last_seen_ms,stopped,pinned_key_fingerprint) VALUES(1,-1,0,?)"
    ).run(fingerprint);
    const pinned=database.prepare(
      "SELECT pinned_key_fingerprint FROM synthetic_approval_meta WHERE id=1"
    ).get();
    if(pinned.pinned_key_fingerprint!==fingerprint)
      throw new Error("Pinned verification key mismatch for existing approval database");
  }
  #meta(){return this.#db.prepare(
    "SELECT last_seen_ms,stopped FROM synthetic_approval_meta WHERE id=1").get();}
  #get(id){
    if(typeof id!=="string"||!ID.test(id))throw new TypeError("Invalid proposal ID");
    const r=this.#db.prepare(
      "SELECT * FROM synthetic_approval_requests WHERE id=?").get(id);
    if(!r)throw new Error("Unknown proposal");
    return r;
  }
  #clock(now){
    if(!safeNow(now))throw new TypeError("Invalid trusted-host timestamp");
    const m=this.#meta();
    if(m.stopped)throw new Error("Persistent STOP active");
    if(now<m.last_seen_ms)throw new Error("Clock rollback blocked");
    this.#db.prepare(
      "UPDATE synthetic_approval_meta SET last_seen_ms=? WHERE id=1").run(now);
  }
  #tx(fn){
    this.#db.exec("BEGIN IMMEDIATE");
    try{const value=fn();this.#db.exec("COMMIT");return value;}
    catch(e){try{this.#db.exec("ROLLBACK");}catch{}throw e;}
  }
  #set(id,state,approvedAt=null){
    this.#db.prepare(
      "UPDATE synthetic_approval_requests SET state=?,approved_at=COALESCE(?,approved_at) WHERE id=?"
    ).run(state,approvedAt,id);
    this.#db.prepare(
      "INSERT INTO synthetic_approval_audit(id,state) VALUES(?,?)").run(id,state);
  }
  propose(proposal,options={}){
    if(!exact(options,["now"]))throw new TypeError("Unexpected proposal options");
    const p=normalize(proposal);
    return this.#tx(()=>{
      const {now}=options;this.#clock(now);
      if(now+60000>Number.MAX_SAFE_INTEGER)throw new RangeError("Clock overflow");
      if(this.#db.prepare("SELECT COUNT(*) AS n FROM synthetic_approval_requests").get().n>=12)
        throw new RangeError("Proposal budget exceeded");
      const nonce=randomBytes(24).toString("hex"),state=p.quality?STATE.PENDING:STATE.BLOCKED;
      this.#db.prepare(
        "INSERT INTO synthetic_approval_requests "+
        "(id,fixture_id,digest,nonce,issued_at,expires_at,approved_at,state) "+
        "VALUES(?,?,?,?,?,?,NULL,?)"
      ).run(p.id,p.fixture,p.digest,nonce,now,now+60000,state);
      this.#db.prepare(
        "INSERT INTO synthetic_approval_audit(id,state) VALUES(?,?)").run(p.id,state);
      return view(this.#get(p.id));
    });
  }
  snapshot(id){return view(this.#get(id));}
  challenge(id,options={}){
    if(!exact(options,["now"]))throw new TypeError("Unexpected challenge options");
    return this.#tx(()=>{
      this.#clock(options.now);
      const r=this.#get(id);
      if(r.state!==STATE.PENDING)throw new Error("Proposal not pending");
      if(options.now>=r.expires_at){
        this.#set(id,STATE.EXPIRED);return Object.freeze({expired:true});
      }
      return Object.freeze({approveMessage:canonical(r,"APPROVE"),
        denyMessage:canonical(r,"DENY"),expiresAt:r.expires_at});
    });
  }
  decide(id,options={}){
    if(!exact(options,["decision","signature","now"]))
      throw new TypeError("Unexpected decision options");
    if(options.decision!=="APPROVE"&&options.decision!=="DENY")
      throw new TypeError("Unknown signed decision");
    const signature=signatureBytes(options.signature);
    return this.#tx(()=>{
      this.#clock(options.now);
      const r=this.#get(id);
      if(r.state!==STATE.PENDING)throw new Error("Already consumed or cancelled");
      if(options.now<r.issued_at)throw new Error("Clock before proposal");
      if(options.now>=r.expires_at){
        this.#set(id,STATE.EXPIRED);return Object.freeze({expired:true});
      }
      if(!verify(null,Buffer.from(canonical(r,options.decision)),this.#key,signature))
        throw new Error("Signature rejected");
      this.#set(id,options.decision==="APPROVE"?STATE.APPROVED:STATE.DENIED,
        options.now);
      return view(this.#get(id));
    });
  }
  preview(id,options={}){
    if(!exact(options,["now"]))throw new TypeError("Unexpected preview options");
    return this.#tx(()=>{
      this.#clock(options.now);
      const r=this.#get(id);
      if(r.state!==STATE.APPROVED)throw new Error("No unused approval");
      if(options.now<r.approved_at)throw new Error("Clock before approval");
      if(options.now>=r.expires_at){
        this.#set(id,STATE.EXPIRED);return Object.freeze({expired:true});
      }
      this.#set(id,STATE.CONSUMED);
      return Object.freeze({proposalId:id,state:STATE.CONSUMED,
        simulated:true,proposalDigest:r.digest,externalActionAllowed:false});
    });
  }
  revoke(id,options={}){
    if(!exact(options,["now"]))throw new TypeError("Unexpected revocation options");
    return this.#tx(()=>{
      this.#clock(options.now);
      const r=this.#get(id);
      if(r.state===STATE.PENDING||r.state===STATE.APPROVED)
        this.#set(id,STATE.REVOKED);
      return view(this.#get(id));
    });
  }
  stop(options={}){
    if(!exact(options,["now"]))throw new TypeError("Unexpected STOP options");
    return this.#tx(()=>{
      if(this.#meta().stopped)return Object.freeze({stopped:true,revoked:0});
      this.#clock(options.now);
      const pending=this.#db.prepare(
        "SELECT id FROM synthetic_approval_requests WHERE state IN (?,?) ORDER BY id"
      ).all(STATE.PENDING,STATE.APPROVED);
      for(const r of pending)this.#set(r.id,STATE.CANCELLED);
      this.#db.prepare(
        "UPDATE synthetic_approval_meta SET stopped=1 WHERE id=1").run();
      return Object.freeze({stopped:true,revoked:pending.length});
    });
  }
  audit(){return Object.freeze(this.#db.prepare(
    "SELECT seq,id,state FROM synthetic_approval_audit ORDER BY seq"
  ).all().map(x=>Object.freeze({...x})));}
  status(){const m=this.#meta();return Object.freeze({
    stopped:!!m.stopped,lastSeenMs:m.last_seen_ms,externalActionAllowed:false
  });}
}
