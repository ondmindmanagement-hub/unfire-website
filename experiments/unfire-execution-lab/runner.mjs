/**
 * Unfire OS · Evidence Runner Lab
 * A deliberately in-memory, synthetic-only task lifecycle.
 * Nothing here launches agents, executes shell commands, contacts services or writes user data.
 * Evidence hashes are integrity checks, NOT worker signatures or remote attestation.
 */
import { createHash } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';

export const STATES = Object.freeze(['READY', 'CLAIMED', 'RUNNING', 'EVIDENCE_READY', 'VERIFIED', 'FAILED', 'CANCELLED']);
export const OPERATIONS = Object.freeze(['math.sum', 'text.uppercase', 'text.wordCount']);
const MAX_TASKS = 32;
const MAX_ATTEMPTS = 3;
const MAX_LEASE_MS = 60000;
const ID = /^[a-z][a-z0-9_-]{0,31}$/;
const own = (object, key) => Object.prototype.hasOwnProperty.call(object, key);
const validNow = now => Number.isSafeInteger(now) && now >= 0;
function objectExact(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).some(key => !keys.includes(key))) {
    throw new TypeError(`Invalid ${label} shape`);
  }
}
function validateSpec(spec) {
  objectExact(spec, ['id', 'operation', 'input', 'dependsOn', 'requiresApproval'], 'task');
  if (typeof spec.id !== 'string' || !ID.test(spec.id) || !OPERATIONS.includes(spec.operation))
    throw new TypeError('Invalid task id or operation');
  if (!Array.isArray(spec.dependsOn) || spec.dependsOn.length > 8 ||
      spec.dependsOn.some(x => typeof x !== 'string' || !ID.test(x)) ||
      new Set(spec.dependsOn).size !== spec.dependsOn.length)
    throw new TypeError('Invalid dependencies');
  if (typeof spec.requiresApproval !== 'boolean') throw new TypeError('Invalid approval requirement');
  if (spec.operation === 'math.sum') {
    if (!Array.isArray(spec.input) || spec.input.length === 0 || spec.input.length > 16 ||
        spec.input.some(x => typeof x !== 'number' || !Number.isFinite(x)))
      throw new TypeError('Invalid numeric input');
    if (!Number.isFinite(spec.input.reduce((a,b) => a+b, 0))) throw new TypeError('Invalid sum');
  } else if (typeof spec.input !== 'string' || spec.input.length > 500) {
    throw new TypeError('Invalid text input');
  }
  return structuredClone(spec);
}
export function evaluatePure(spec) {
  if (spec.operation === 'math.sum') return spec.input.reduce((a,b)=>a+b, 0);
  if (spec.operation === 'text.uppercase') return spec.input.toUpperCase();
  if (spec.operation === 'text.wordCount') return spec.input.trim().length === 0 ? 0 : spec.input.trim().split(/\s+/u).length;
  throw new TypeError('Unsupported operation');
}
export function evidenceDigest(id, generation, output) {
  if (typeof id !== 'string' || !ID.test(id) || !Number.isSafeInteger(generation) || generation < 1 ||
      !(typeof output === 'number' && Number.isFinite(output) || typeof output === 'string' && output.length <= 1024))
    throw new TypeError('Invalid evidence');
  return createHash('sha256').update(JSON.stringify([id, generation, output])).digest('hex');
}
function validWorker(worker) {return typeof worker === 'string' && ID.test(worker);}
export class EvidenceRunner {
  #tasks = new Map();
  #stopped = false;
  #events = [];
  register(spec) {
    if (this.#stopped || this.#tasks.size >= MAX_TASKS) throw new Error('Registration closed');
    const safe = validateSpec(spec);
    if (this.#tasks.has(safe.id)) throw new Error('Duplicate task id');
    if (safe.dependsOn.some(dep => !this.#tasks.has(dep))) throw new Error('Unresolved dependency');
    const task = {spec: safe, state:'READY', revision:1, attempts:0, generation:0,
      approved:false, lease:null, evidence:null, reason:null};
    this.#tasks.set(safe.id,task);
    this.#log('registered',task);
    return this.snapshot(safe.id);
  }
  #get(id) {
    const task=this.#tasks.get(id);
    if(!task) throw new Error('Unknown task');
    return task;
  }
  #log(type,task) {
    this.#events.push(Object.freeze({sequence:this.#events.length+1, type, taskId:task.spec.id,
      state:task.state, revision:task.revision, generation:task.generation}));
  }
  #advance(type,task) {task.revision++; this.#log(type,task);}
  snapshot(id) {return structuredClone(this.#get(id));}
  snapshots() {return [...this.#tasks.keys()].map(id=>this.snapshot(id));}
  events() {return this.#events.map(event=>({...event}));}
  approve(id, expectedRevision) {
    const task=this.#get(id);
    if(this.#stopped || task.state!=='READY' || task.revision!==expectedRevision)
      throw new Error('Approval rejected: state or revision');
    task.approved=true;
    this.#advance('approved',task);
    return this.snapshot(id);
  }
  claim(id, {worker, now, leaseMs, expectedRevision}) {
    const task=this.#get(id);
    if(!validWorker(worker)||!validNow(now)||!Number.isSafeInteger(leaseMs)||leaseMs<1||leaseMs>MAX_LEASE_MS)
      throw new TypeError('Invalid claim');
    if(this.#stopped || task.state!=='READY' || task.revision!==expectedRevision)
      throw new Error('Claim rejected: stopped, state or revision');
    if(task.spec.requiresApproval && !task.approved) throw new Error('Approval required');
    if(task.spec.dependsOn.some(dep=>this.#get(dep).state!=='VERIFIED')) throw new Error('Dependencies unverified');
    if(task.attempts>=MAX_ATTEMPTS) throw new Error('Attempt budget exhausted');
    task.attempts++;
    task.generation++;
    task.lease={worker, deadline:now+leaseMs};
    task.evidence=null;
    task.state='CLAIMED';
    this.#advance('claimed',task);
    return this.snapshot(id);
  }
  #requireLease(task,worker,generation,now) {
    if(!validWorker(worker)||!Number.isSafeInteger(generation)||!validNow(now)||
       !task.lease||task.lease.worker!==worker||task.generation!==generation||now>=task.lease.deadline)
      throw new Error('Stale, invalid or expired lease');
  }
  start(id,{worker,generation,now}) {
    const task=this.#get(id);
    if(this.#stopped || task.state!=='CLAIMED') throw new Error('Start rejected');
    this.#requireLease(task,worker,generation,now);
    task.state='RUNNING';
    this.#advance('started',task);
    return this.snapshot(id);
  }
  perform(id,{worker,generation,now}) {
    const task=this.#get(id);
    if(this.#stopped || task.state!=='RUNNING') throw new Error('Execution rejected');
    this.#requireLease(task,worker,generation,now);
    const output=evaluatePure(task.spec);
    return Object.freeze({id, generation, output, digest:evidenceDigest(id,generation,output)});
  }
  submit(id,{worker,generation,now,evidence}) {
    const task=this.#get(id);
    if(this.#stopped || task.state!=='RUNNING') throw new Error('Submission rejected');
    this.#requireLease(task,worker,generation,now);
    objectExact(evidence,['id','generation','output','digest'],'evidence');
    if(evidence.id!==id||evidence.generation!==generation||typeof evidence.digest!=='string'||
       !/^[a-f0-9]{64}$/.test(evidence.digest)) throw new Error('Evidence identity mismatch');
    // Reject all unsupported or non-JSON-safe values before persisting evidence.
    evidenceDigest(id,generation,evidence.output);
    task.evidence=structuredClone(evidence);
    task.state='EVIDENCE_READY';
    this.#advance('evidence_submitted',task);
    return this.snapshot(id);
  }
  verify(id,{worker,generation,now}) {
    const task=this.#get(id);
    if(this.#stopped || task.state!=='EVIDENCE_READY') throw new Error('Verification rejected');
    this.#requireLease(task,worker,generation,now);
    const {evidence}=task;
    const expected=evaluatePure(task.spec);
    const computed=evidenceDigest(id,generation,evidence.output);
    const valid=evidence.id===id&&evidence.generation===generation&&
      evidence.digest===computed&&isDeepStrictEqual(evidence.output,expected);
    task.state=valid?'VERIFIED':'FAILED';
    task.reason=valid?null:'Evidence does not match independent computation';
    task.lease=null;
    this.#advance(valid?'verified':'rejected_evidence',task);
    return this.snapshot(id);
  }
  expire(id,now) {
    const task=this.#get(id);
    if(!validNow(now)) throw new TypeError('Invalid time');
    if(this.#stopped || !['CLAIMED','RUNNING','EVIDENCE_READY'].includes(task.state) || !task.lease || now<task.lease.deadline)
      return this.snapshot(id);
    task.state=task.attempts>=MAX_ATTEMPTS?'FAILED':'READY';
    task.reason=task.state==='FAILED'?'Attempt budget exhausted':null;
    task.lease=null;
    task.evidence=null;
    this.#advance('lease_expired',task);
    return this.snapshot(id);
  }
  cancel(id,reason='user_stop') {
    const task=this.#get(id);
    if(typeof reason!=='string'||reason.length>80) throw new TypeError('Invalid stop reason');
    if(task.state==='VERIFIED'||task.state==='FAILED'||task.state==='CANCELLED') return this.snapshot(id);
    task.state='CANCELLED';task.lease=null;task.evidence=null;task.reason=reason;
    this.#advance('cancelled',task);
    return this.snapshot(id);
  }
  stop() {
    if(this.#stopped) return this.snapshots();
    this.#stopped=true;
    for(const task of this.#tasks.values()) this.cancel(task.spec.id,'global_stop');
    return this.snapshots();
  }
  get isStopped(){return this.#stopped;}
}
