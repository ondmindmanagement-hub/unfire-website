/**
 * Unfire OS Layer | Fenced result journal (research only).
 *
 * This does not execute agents or write their artifacts. It only records
 * revocable, time-bounded ownership claims and SHA-256 result attestations.
 * A same-user process with direct filesystem access can bypass this module.
 */
import * as fs from "node:fs/promises";
import { randomBytes, createHash } from "node:crypto";
import { join, isAbsolute } from "node:path";

const IDENT=/^[a-z][a-z0-9_-]{0,39}$/u;
const DIGEST=/^[a-f0-9]{64}$/u;
const MAX_BYTES=2_000_000;
const MAX_TTL=5*60*1000;
const FORMAT="unfire-fenced-results-v1";
const fileName="fenced-events.jsonl";
const lockName=".fenced-events.lock";
const sha=value=>createHash("sha256").update(value).digest("hex");
function checkName(v,kind){if(typeof v!=="string"||!IDENT.test(v))throw new TypeError("Invalid "+kind);}
function plain(o,keys){return o!==null&&typeof o==="object"&&!Array.isArray(o)&&
  Object.getPrototypeOf(o)===Object.prototype&&Object.keys(o).every(k=>keys.includes(k));}
function timestamp(v) {if(!Number.isSafeInteger(v)||v<0)throw new TypeError("Invalid timestamp");}
function generation(v){if(!Number.isSafeInteger(v)||v<1)throw new TypeError("Invalid fencing generation");}
function validEvent(e) {
  if(!plain(e,["type","mission","actor","artifact","generation","at","expiresAt","tokenHash","task","digest"]))
    throw new Error("Unsupported lease event fields");
  if(!["ACQUIRE","RESULT","RELEASE"].includes(e.type))throw new Error("Invalid event type");
  checkName(e.mission,"mission");checkName(e.actor,"actor");checkName(e.artifact,"artifact");
  generation(e.generation);timestamp(e.at);
  if(e.type==="ACQUIRE"){
    if(!DIGEST.test(e.tokenHash)||!Number.isSafeInteger(e.expiresAt)||
      e.expiresAt<=e.at||e.expiresAt-e.at>MAX_TTL ||
      e.task!==undefined||e.digest!==undefined)
      throw new Error("Invalid acquisition");
  } else {
    if(e.expiresAt!==undefined||e.tokenHash!==undefined)throw new Error("Unexpected credential fields");
    if(e.type==="RESULT"){
      checkName(e.task,"task");
      if(typeof e.digest!=="string"||!DIGEST.test(e.digest))throw new Error("Invalid result digest");
    } else if(e.task!==undefined||e.digest!==undefined)throw new Error("Invalid release");
  }
  if(Buffer.byteLength(JSON.stringify(e),"utf8")>1200)throw new Error("Event too large");
}
function newState(){return {mission:null,byArtifact:new Map(),lastAt:0};}
function apply(s,e) {
  validEvent(e);
  if(s.mission!==null&&s.mission!==e.mission)throw new Error("Wrong mission");
  if(e.at<s.lastAt)throw new Error("Nonmonotonic event timestamp");
  s.mission=e.mission;s.lastAt=e.at;
  const prior=s.byArtifact.get(e.artifact);
  if(e.type==="ACQUIRE"){
    if(prior&&prior.status==="active"&&e.at<prior.expiresAt)
      throw new Error("Artifact lease is already active");
    const expected=(prior?.generation??0)+1;
    if(e.generation!==expected)throw new Error("Stale or skipped fencing generation");
    s.byArtifact.set(e.artifact,{
      generation:e.generation,actor:e.actor,expiresAt:e.expiresAt,
      tokenHash:e.tokenHash,status:"active",result:null
    });
    return;
  }
  if(!prior||prior.status!=="active"||prior.actor!==e.actor||
    prior.generation!==e.generation)throw new Error("Stale or unowned artifact lease");
  if(e.at>=prior.expiresAt)throw new Error("Artifact lease expired");
  if(e.type==="RESULT"){
    if(prior.result!==null)throw new Error("Result already submitted for this lease");
    prior.result={task:e.task,digest:e.digest,at:e.at};
  }else if(e.type==="RELEASE")prior.status="released";
}
function parseJournal(text){
  if(Buffer.byteLength(text,"utf8")>MAX_BYTES)throw new Error("Lease journal limit exceeded");
  if(text&&!text.endsWith("\n"))throw new Error("Truncated lease journal");
  let prev="GENESIS";const state=newState(),records=[];
  for(const [i,line] of (text?text.trimEnd().split("\n"):[]).entries()){
    if(line.length>1600)throw new Error("Oversized lease record");
    let r;try{r=JSON.parse(line);}catch{throw new Error("Invalid lease JSON");}
    if(!plain(r,["version","seq","prev","event","hash"])||
      r.version!==FORMAT||r.seq!==i+1||r.prev!==prev)
      throw new Error("Lease record sequence mismatch");
    const expected=sha(JSON.stringify([r.version,r.seq,r.prev,r.event]));
    if(r.hash!==expected)throw new Error("Lease integrity mismatch");
    apply(state,r.event);prev=r.hash;records.push(r);
  }
  return {state,records,prev};
}
async function ensurePrivate(dir){
  if(typeof dir!=="string"||!isAbsolute(dir))throw new TypeError("Absolute workspace required");
  try{await fs.mkdir(dir,{mode:0o700});}catch(e){if(e.code!=="EEXIST")throw e;}
  const stat=await fs.lstat(dir);
  if(!stat.isDirectory()||stat.isSymbolicLink()||(stat.mode&0o077)!==0)
    throw new Error("Workspace must be a private, real directory (0700)");
  const file=join(dir,fileName);
  try{
    const st=await fs.lstat(file);
    if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077)!==0)
      throw new Error("Lease journal must be private and regular (0600)");
  }catch(e){
    if(e.code!=="ENOENT")throw e;
    let h;
    try{h=await fs.open(file,"wx",0o600);}catch(err){if(err.code!=="EEXIST")throw err;}
    finally{await h?.close();}
  }
  return file;
}
export class FencedResultJournal {
  #directory;#mission;
  constructor(directory,mission){this.#directory=directory;this.#mission=mission;}
  static async open(directory,mission){
    checkName(mission,"mission");await ensurePrivate(directory);
    const store=new FencedResultJournal(directory,mission);
    const {state}=parseJournal(await fs.readFile(join(directory,fileName),"utf8"));
    if(state.mission!==null&&state.mission!==mission)throw new Error("Different mission in journal");
    return store;
  }
  async inspect(){
    const file=await ensurePrivate(this.#directory);
    const {state,records}=parseJournal(await fs.readFile(file,"utf8"));
    if(state.mission!==null&&state.mission!==this.#mission)throw new Error("Wrong mission");
    return {count:records.length,mission:this.#mission,leases:Object.fromEntries(
      [...state.byArtifact].map(([artifact,v])=>[artifact,{
        generation:v.generation,actor:v.actor,expiresAt:v.expiresAt,
        status:v.status,result:v.result
      }])
    )};
  }
  async #write(makeEvent){
    const lock=join(this.#directory,lockName);
    try{await fs.mkdir(lock,{mode:0o700});}
    catch(e){if(e.code==="EEXIST")throw new Error("Lease journal busy; operator review required");throw e;}
    try{
      const file=await ensurePrivate(this.#directory);
      const old=await fs.readFile(file,"utf8");
      const {state,records,prev}=parseJournal(old);
      if(state.mission!==null&&state.mission!==this.#mission)throw new Error("Wrong mission");
      const {event,receipt}=makeEvent(state);
      validEvent(event);apply(state,event);
      const seq=records.length+1;
      const record={version:FORMAT,seq,prev,event};
      record.hash=sha(JSON.stringify([record.version,record.seq,record.prev,record.event]));
      const line=JSON.stringify(record)+"\n";
      if(Buffer.byteLength(old,"utf8")+Buffer.byteLength(line,"utf8")>MAX_BYTES)
        throw new Error("Lease journal limit reached");
      const h=await fs.open(file,"a",0o600);
      try{await h.writeFile(line,"utf8");await h.sync();}finally{await h.close();}
      return {seq,hash:record.hash,...receipt};
    }finally{await fs.rmdir(lock);}
  }
  async acquire({actor,artifact,ttlMs=60_000,now=Date.now()}) {
    checkName(actor,"actor");checkName(artifact,"artifact");
    timestamp(now);
    if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>MAX_TTL)
      throw new TypeError("Invalid lease duration");
    return this.#write(s=>{
      const prior=s.byArtifact.get(artifact);
      const generation=(prior?.generation??0)+1;
      const token=randomBytes(32).toString("hex");
      const event={type:"ACQUIRE",mission:this.#mission,actor,artifact,
        generation,at:now,expiresAt:now+ttlMs,tokenHash:sha(token)};
      return {event,receipt:{artifact,generation,token,expiresAt:event.expiresAt}};
    });
  }
  #checkClaim(s,{actor,artifact,generation,token,now}) {
    const v=s.byArtifact.get(artifact);
    if(typeof token!=="string"||!DIGEST.test(token)||!v||
      v.actor!==actor||v.generation!==generation||
      v.tokenHash!==sha(token)||v.status!=="active"||now>=v.expiresAt)
      throw new Error("Lease token, generation, ownership or expiry rejected");
  }
  async submit({actor,artifact,generation,token,task,digest,now=Date.now()}) {
    checkName(actor,"actor");checkName(artifact,"artifact");checkName(task,"task");
    if(typeof digest!=="string"||!DIGEST.test(digest))throw new TypeError("Expected SHA-256 result digest");
    generationCheck(generation);timestamp(now);
    return this.#write(s=>{
      this.#checkClaim(s,{actor,artifact,generation,token,now});
      return {event:{type:"RESULT",mission:this.#mission,actor,artifact,
        generation,task,digest,at:now},receipt:{artifact,generation,task,digest}};
    });
  }
  async release({actor,artifact,generation,token,now=Date.now()}) {
    checkName(actor,"actor");checkName(artifact,"artifact");generationCheck(generation);timestamp(now);
    return this.#write(s=>{
      this.#checkClaim(s,{actor,artifact,generation,token,now});
      return {event:{type:"RELEASE",mission:this.#mission,actor,artifact,
        generation,at:now},receipt:{artifact,generation,released:true}};
    });
  }
}
function generationCheck(v){generation(v);}
