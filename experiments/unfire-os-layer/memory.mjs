/**
 * Unfire OS Layer · local, append-only research memory.
 *
 * Explicit directory only. No daemon, sockets, external agents, elevated rights
 * or access to another project. Not an OS security boundary.
 */
import * as fs from "node:fs/promises";
import { createHash } from "node:crypto";
import { isAbsolute, join } from "node:path";

const FORMAT = "unfire-memory-v1";
const MAX_JOURNAL = 2_000_000;
const MAX_EVENT = 1500;
const JOURNAL = "events.jsonl";
const LOCK = ".journal.lock";
const IDENT = /^[a-z][a-z0-9_-]{0,39}$/u;
const TYPES = Object.freeze({
  "MISSION_CREATED": "mission:create",
  "ARTIFACT_CLAIMED": "artifact:claim",
  "ARTIFACT_RELEASED": "artifact:release",
  "TASK_COMPLETED": "task:complete",
  "MISSION_STOPPED": "mission:stop"
});
const sha = value => createHash("sha256").update(value).digest("hex");
const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
function isPlain(obj) {
  return obj !== null && typeof obj === "object" && !Array.isArray(obj) &&
    (Object.getPrototypeOf(obj) === Object.prototype || Object.getPrototypeOf(obj) === null);
}
function name(value, kind) {
  if (typeof value !== "string" || !IDENT.test(value)) throw new TypeError("Invalid "+kind);
}
function exactFields(value, allowed) {
  if (!isPlain(value) || Object.keys(value).some(key => !allowed.includes(key)))
    throw new TypeError("Unexpected event field");
}
function validateEvent(event) {
  exactFields(event,["type","mission","actor","artifact","task","note"]);
  if (!own(TYPES,event.type)) throw new TypeError("Unsupported event type");
  name(event.mission,"mission");
  name(event.actor,"actor");
  if (event.artifact !== undefined) name(event.artifact,"artifact");
  if (event.task !== undefined) name(event.task,"task");
  if (event.note !== undefined &&
    (typeof event.note !== "string" || event.note.length > 240 ||
      /[\u0000-\u001f]/u.test(event.note)))
    throw new TypeError("Invalid note");
  if ((event.type === "ARTIFACT_CLAIMED" || event.type === "ARTIFACT_RELEASED") && !event.artifact)
    throw new TypeError("Artifact identifier required");
  if (event.type === "TASK_COMPLETED" && !event.task)
    throw new TypeError("Task identifier required");
  const s = JSON.stringify(event);
  if (Buffer.byteLength(s, "utf8") > MAX_EVENT) throw new RangeError("Event too large");
  return s;
}
function empty() { return {mission:null, stopped:false, claims:new Map(), tasks:new Set()}; }
function apply(state,event) {
  if (event.type === "MISSION_CREATED") {
    if (state.mission) throw new Error("Mission already exists");
    state.mission=event.mission;
    return;
  }
  if (!state.mission || state.mission !== event.mission) throw new Error("Wrong or missing mission");
  if (state.stopped) throw new Error("Mission STOPPED");
  switch(event.type) {
    case "ARTIFACT_CLAIMED":
      if (state.claims.has(event.artifact)) throw new Error("Artifact already claimed");
      state.claims.set(event.artifact,event.actor);
      break;
    case "ARTIFACT_RELEASED":
      if (state.claims.get(event.artifact) !== event.actor) throw new Error("Claim owner required");
      state.claims.delete(event.artifact);
      break;
    case "TASK_COMPLETED":
      if (state.tasks.has(event.task)) throw new Error("Task already completed");
      state.tasks.add(event.task);
      break;
    case "MISSION_STOPPED": state.stopped=true; break;
    default: throw new Error("Unknown state transition");
  }
}
function decode(text) {
  if (Buffer.byteLength(text,"utf8")>MAX_JOURNAL) throw new RangeError("Journal too large");
  if (text && !text.endsWith("\n")) throw new Error("Truncated event journal");
  const lines=text ? text.trimEnd().split("\n") : [];
  const state=empty();
  let previous="GENESIS";
  const records=[];
  for (const [index,line] of lines.entries()) {
    if (line.length>MAX_EVENT+300) throw new Error("Oversized record");
    let record;
    try { record=JSON.parse(line); } catch { throw new Error("Invalid journal JSON"); }
    exactFields(record,["format","seq","prev","event","hash"]);
    if (record.format!==FORMAT || record.seq!==index+1 || record.prev!==previous)
      throw new Error("Journal sequence or previous hash mismatch");
    validateEvent(record.event);
    const hash=sha(JSON.stringify([record.format,record.seq,record.prev,record.event]));
    if (hash!==record.hash) throw new Error("Journal integrity check failed");
    apply(state,record.event);
    records.push(record);
    previous=hash;
  }
  return {state,records,previous};
}
async function ensureRoot(directory) {
  if (typeof directory!=="string" || !isAbsolute(directory)) throw new TypeError("Require absolute workspace path");
  try { await fs.mkdir(directory,{mode:0o700}); } catch (e) { if(e.code!=="EEXIST") throw e; }
  const st=await fs.lstat(directory);
  if (!st.isDirectory() || st.isSymbolicLink()) throw new Error("Workspace cannot be a symlink");
}
async function ensureJournal(directory) {
  const file=join(directory,JOURNAL);
  try {
    const stat=await fs.lstat(file);
    if(!stat.isFile()||stat.isSymbolicLink()) throw new Error("Journal must be a regular file");
  } catch(e) {
    if(e.code!=="ENOENT") throw e;
    let h;
    try {h=await fs.open(file,"wx",0o600);}
    catch(err) {if(err.code!=="EEXIST") throw err;}
    finally {await h?.close();}
  }
  return file;
}
export class LocalMissionMemory {
  constructor(directory) {this.directory=directory;}
  static async open(directory) {
    await ensureRoot(directory);
    await ensureJournal(directory);
    return new LocalMissionMemory(directory);
  }
  async read() {
    const file=await ensureJournal(this.directory);
    const result=decode(await fs.readFile(file,"utf8"));
    return {
      count:result.records.length,
      records:result.records,
      summary: {mission:result.state.mission,stopped:result.state.stopped,
        claims:Object.fromEntries(result.state.claims),completed:[...result.state.tasks]}
    };
  }
  async append(event) {
    validateEvent(event);
    const lockPath=join(this.directory,LOCK);
    try {await fs.mkdir(lockPath,{mode:0o700});}
    catch(e) { if(e.code==="EEXIST") throw new Error("Workspace busy: manual lock recovery required"); throw e; }
    try {
      const file=await ensureJournal(this.directory);
      const current=decode(await fs.readFile(file,"utf8"));
      apply(current.state,event);
      const seq=current.records.length+1;
      const record={format:FORMAT,seq,prev:current.previous,event};
      record.hash=sha(JSON.stringify([record.format,record.seq,record.prev,record.event]));
      const line=JSON.stringify(record)+"\n";
      if(Buffer.byteLength(line)+ (await fs.stat(file)).size > MAX_JOURNAL)
        throw new RangeError("Journal full. Archive manually after verification.");
      const h=await fs.open(file,"a",0o600);
      try {await h.writeFile(line,"utf8"); await h.sync();}
      finally {await h.close();}
      return {seq,hash:record.hash};
    } finally {
      await fs.rmdir(lockPath);
    }
  }
}
export class MemoryPolicy {
  constructor(grants=[]) {
    if(!Array.isArray(grants)||grants.length>100) throw new TypeError("Invalid grants");
    this.grants=grants.map(g=>{
      exactFields(g,["actor","mission","capability","artifact","expires"]);
      name(g.actor,"grantee"); name(g.mission,"mission");
      if(!Object.values(TYPES).includes(g.capability)) throw new TypeError("Invalid capability");
      if(g.artifact!==undefined) name(g.artifact,"artifact scope");
      if(typeof g.expires!=="string"||!Number.isFinite(Date.parse(g.expires)))
        throw new TypeError("Invalid expiration");
      return Object.freeze({...g});
    });
    Object.freeze(this.grants);
  }
  permits(event,now=new Date()) {
    validateEvent(event);
    if(!(now instanceof Date) || !Number.isFinite(now.getTime())) throw new TypeError("Invalid clock");
    return this.grants.some(g=>g.actor===event.actor &&
      g.mission===event.mission && g.capability===TYPES[event.type] &&
      (g.artifact===undefined||g.artifact===event.artifact) &&
      Date.parse(g.expires)>now.getTime());
  }
}
export class AuthorizedMission {
  constructor(store,policy) {
    if(!(store instanceof LocalMissionMemory)||!(policy instanceof MemoryPolicy))
      throw new TypeError("Invalid memory configuration");
    this.store=store;this.policy=policy;
  }
  async record(event) {
    if(!this.policy.permits(event)) throw new Error("Access denied by explicit policy");
    return this.store.append(event);
  }
  async inspect() {
    // Caller of this trusted local API already has direct OS access to the store.
    // This is not an authenticated remote read endpoint.
    return this.store.read();
  }
}
