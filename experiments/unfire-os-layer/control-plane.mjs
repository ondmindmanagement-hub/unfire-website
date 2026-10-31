/**
 * Unfire OS Layer · unified, local research control plane.
 * STOP, lease generations and claimed result digests share ONE append-only
 * journal and ONE serialized writer lock. No model, subprocess, artifact
 * contents, network service or host control exists in this module.
 */
import * as fs from "node:fs/promises";
import { join, isAbsolute } from "node:path";
import { randomBytes, createHash } from "node:crypto";

const NAME=/^[a-z][a-z0-9_-]{0,39}$/u;
const HEX=/^[a-f0-9]{64}$/u;
const VERSION="unfire-control-plane-v1";
const FILE="control-events.jsonl";
const LOCK=".control-events.lock";
const MAX_BYTES=2_000_000;
const MAX_TTL=5*60*1000;
const digest=s=>createHash("sha256").update(s).digest("hex");
function name(x,label){if(typeof x!=="string"||!NAME.test(x))throw new TypeError("Invalid "+label);}
function integer(x,label){if(!Number.isSafeInteger(x)||x<0)throw new TypeError("Invalid "+label);}
function shape(x,fields){return x!==null&&typeof x==="object"&&!Array.isArray(x)&&
  Object.getPrototypeOf(x)===Object.prototype&&Object.keys(x).every(k=>fields.includes(k));}
function validate(event){
  if(!shape(event,["type","mission","actor","at","artifact","generation",
    "expiresAt","tokenHash","task","resultDigest"]))throw new Error("Invalid event fields");
  if(!["MISSION_CREATED","LEASE_ACQUIRED","RESULT_ATTESTED","LEASE_RELEASED","MISSION_STOPPED"].includes(event.type))
    throw new Error("Invalid control event type");
  name(event.mission,"mission");name(event.actor,"actor");integer(event.at,"event time");
  if(event.type==="MISSION_CREATED"||event.type==="MISSION_STOPPED"){
    if(event.actor!=="operator"||Object.keys(event).length!==4)
      throw new Error("Only the operator can create or STOP a mission");
  } else {
    name(event.artifact,"artifact");integer(event.generation,"fencing generation");
    if(event.generation<1)throw new Error("Invalid fencing generation");
    if(event.type==="LEASE_ACQUIRED"){
      if(!HEX.test(event.tokenHash)||!Number.isSafeInteger(event.expiresAt)||
        event.expiresAt<=event.at||event.expiresAt-event.at>MAX_TTL||
        Object.keys(event).length!==8)throw new Error("Invalid lease fields");
    }else if(event.type==="RESULT_ATTESTED"){
      name(event.task,"task");
      if(typeof event.resultDigest!=="string"||!HEX.test(event.resultDigest)||
        Object.keys(event).length!==7)throw new Error("Invalid result attestation");
    }else if(Object.keys(event).length!==6)throw new Error("Invalid release fields");
  }
  if(Buffer.byteLength(JSON.stringify(event),"utf8")>1100)throw new Error("Control event too large");
}
function initial(){return {created:false,stopped:false,mission:null,leases:new Map(),lastAt:0};}
function transition(s,event){
  validate(event);
  if(event.at<s.lastAt)throw new Error("Nonmonotonic control timestamp");
  if(s.mission!==null&&s.mission!==event.mission)throw new Error("Wrong mission");
  s.lastAt=event.at;
  if(event.type==="MISSION_CREATED"){
    if(s.created)throw new Error("Mission already created");
    s.created=true;s.mission=event.mission;return;
  }
  if(!s.created)throw new Error("Mission must be created first");
  if(s.stopped)throw new Error("Mission STOPPED");
  if(event.type==="MISSION_STOPPED"){s.stopped=true;return;}
  const prior=s.leases.get(event.artifact);
  if(event.type==="LEASE_ACQUIRED"){
    if(prior&&prior.status==="active"&&event.at<prior.expiresAt)
      throw new Error("Artifact already leased");
    if(event.generation!==(prior?.generation??0)+1)
      throw new Error("Stale or skipped fencing generation");
    s.leases.set(event.artifact,{actor:event.actor,generation:event.generation,
      expiresAt:event.expiresAt,tokenHash:event.tokenHash,
      status:"active",result:null});
    return;
  }
  if(!prior||prior.status!=="active"||prior.actor!==event.actor||
     prior.generation!==event.generation||event.at>=prior.expiresAt)
    throw new Error("Stale, expired or unowned artifact lease");
  if(event.type==="RESULT_ATTESTED"){
    if(prior.result!==null)throw new Error("Result already attested");
    prior.result={task:event.task,digest:event.resultDigest,at:event.at};
  } else if(event.type==="LEASE_RELEASED")prior.status="released";
}
function replay(content){
  if(Buffer.byteLength(content,"utf8")>MAX_BYTES)throw new Error("Control journal too large");
  if(content&&!content.endsWith("\n"))throw new Error("Truncated control journal");
  const state=initial(),records=[];
  let previous="GENESIS";
  for(const [i,line] of (content?content.trimEnd().split("\n"):[]).entries()){
    if(line.length>1500)throw new Error("Oversized control record");
    let rec;try{rec=JSON.parse(line)}catch{throw new Error("Invalid control JSON")}
    if(!shape(rec,["format","seq","prev","event","hash"])||
      rec.format!==VERSION||rec.seq!==i+1||rec.prev!==previous)
      throw new Error("Control journal sequence mismatch");
    const expected=digest(JSON.stringify([rec.format,rec.seq,rec.prev,rec.event]));
    if(rec.hash!==expected)throw new Error("Control journal integrity mismatch");
    transition(state,rec.event);
    previous=rec.hash;records.push(rec);
  }
  return {state,records,previous};
}
async function privateJournal(directory){
  if(typeof directory!=="string"||!isAbsolute(directory))throw new TypeError("Absolute workspace path required");
  try{await fs.mkdir(directory,{mode:0o700})}catch(e){if(e.code!=="EEXIST")throw e}
  const root=await fs.lstat(directory);
  if(!root.isDirectory()||root.isSymbolicLink()||(root.mode&0o077)!==0)
    throw new Error("Workspace must be a private real directory");
  const file=join(directory,FILE);
  try {
    const st=await fs.lstat(file);
    if(!st.isFile()||st.isSymbolicLink()||(st.mode&0o077)!==0)
      throw new Error("Control journal must be private and regular");
  }catch(e){
    if(e.code!=="ENOENT")throw e;
    let h;try{h=await fs.open(file,"wx",0o600)}catch(err){if(err.code!=="EEXIST")throw err}
    finally{await h?.close()}
  }
  return file;
}
export class UnifiedControlPlane {
  #directory;#mission;
  constructor(directory,mission){this.#directory=directory;this.#mission=mission;}
  static async open(directory,mission){
    name(mission,"mission");const file=await privateJournal(directory);
    const {state}=replay(await fs.readFile(file,"utf8"));
    if(state.mission!==null&&state.mission!==mission)throw new Error("Different mission already exists");
    return new UnifiedControlPlane(directory,mission);
  }
  async inspect(){
    const {state,records}=replay(await fs.readFile(await privateJournal(this.#directory),"utf8"));
    if(state.mission!==null&&state.mission!==this.#mission)throw new Error("Different mission");
    return {mission:this.#mission,created:state.created,stopped:state.stopped,
      count:records.length,headHash:records.at(-1)?.hash??null,
      leases:Object.fromEntries([...state.leases].map(([artifact,v])=>[artifact,{
        actor:v.actor,generation:v.generation,expiresAt:v.expiresAt,
        status:v.status,result:v.result
      }]))};
  }
  async #append(make,now){
    integer(now,"timestamp");
    const lock=join(this.#directory,LOCK);
    try{await fs.mkdir(lock,{mode:0o700})}
    catch(e){if(e.code==="EEXIST")throw new Error("Control plane busy; fail closed");throw e}
    try{
      const file=await privateJournal(this.#directory);
      const contents=await fs.readFile(file,"utf8");
      const {state,records,previous}=replay(contents);
      if(state.mission!==null&&state.mission!==this.#mission)throw new Error("Different mission");
      const {event,receipt={}}=make(state);
      validate(event);
      transition(state,event);
      const seq=records.length+1;
      const record={format:VERSION,seq,prev:previous,event};
      record.hash=digest(JSON.stringify([record.format,record.seq,record.prev,record.event]));
      const line=JSON.stringify(record)+"\n";
      if(Buffer.byteLength(contents,"utf8")+Buffer.byteLength(line,"utf8")>MAX_BYTES)
        throw new Error("Control plane journal size limit");
      const fd=await fs.open(file,"a",0o600);
      try{await fd.writeFile(line,"utf8");await fd.sync()}finally{await fd.close()}
      return {seq,headHash:record.hash,...receipt};
    }finally{await fs.rmdir(lock)}
  }
  async createMission(now=Date.now()){
    return this.#append(()=>({event:{type:"MISSION_CREATED",mission:this.#mission,actor:"operator",at:now}}),now);
  }
  async stopMission(now=Date.now()){
    return this.#append(()=>({event:{type:"MISSION_STOPPED",mission:this.#mission,actor:"operator",at:now}}),now);
  }
  async acquire({actor,artifact,ttlMs=60_000,now=Date.now()}){
    name(actor,"actor");name(artifact,"artifact");
    if(actor==="operator")throw new Error("Operator cannot impersonate agent");
    if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>MAX_TTL)
      throw new TypeError("Invalid lease duration");
    return this.#append(s=>{
      const prior=s.leases.get(artifact);
      const token=randomBytes(32).toString("hex");
      const generation=(prior?.generation??0)+1;
      return {event:{type:"LEASE_ACQUIRED",mission:this.#mission,actor,at:now,artifact,
        generation,expiresAt:now+ttlMs,tokenHash:digest(token)},
        receipt:{actor,artifact,generation,expiresAt:now+ttlMs,token}};
    },now);
  }
  #check(s,{actor,artifact,generation,token,now}){
    const v=s.leases.get(artifact);
    if(typeof token!=="string"||!HEX.test(token)||!v||
      v.actor!==actor||v.generation!==generation||
      v.tokenHash!==digest(token)||v.status!=="active"||now>=v.expiresAt)
      throw new Error("Lease authorization or fencing rejected");
  }
  async attest({actor,artifact,generation,token,task,resultDigest,now=Date.now()}){
    name(actor,"actor");name(artifact,"artifact");name(task,"task");
    if(typeof resultDigest!=="string"||!HEX.test(resultDigest))
      throw new TypeError("Invalid SHA-256 result digest");
    return this.#append(s=>{
      this.#check(s,{actor,artifact,generation,token,now});
      return {event:{type:"RESULT_ATTESTED",mission:this.#mission,actor,at:now,
        artifact,generation,task,resultDigest},receipt:{artifact,generation,task,resultDigest}};
    },now);
  }
  async release({actor,artifact,generation,token,now=Date.now()}){
    name(actor,"actor");name(artifact,"artifact");
    return this.#append(s=>{
      this.#check(s,{actor,artifact,generation,token,now});
      return {event:{type:"LEASE_RELEASED",mission:this.#mission,actor,at:now,
        artifact,generation},receipt:{artifact,generation,released:true}};
    },now);
  }
}
