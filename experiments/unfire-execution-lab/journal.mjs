/**
 * Unfire OS · event-metadata journal laboratory.
 * Pure encode/decode only. No filesystem, remote, or model access.
 * A checksum detects corruption; it is NOT a signature or trustworthy provenance.
 */
import { createHash } from 'node:crypto';

export const JOURNAL_VERSION = 1;
export const MAX_EVENTS = 2048;
export const MAX_TEXT_BYTES = 512 * 1024;
const HASH_ZERO = '0'.repeat(64);
const ID = /^[a-z][a-z0-9_-]{0,31}$/;
const STATES = new Set(['READY','CLAIMED','RUNNING','EVIDENCE_READY','VERIFIED','FAILED','CANCELLED']);
const EVENT_FIELDS = ['sequence','type','taskId','state','revision','generation'];
const RECORD_FIELDS = ['version','event','previousHash','hash'];
const TYPE_STATES = Object.freeze({
  registered: ['READY'],
  approved: ['READY'],
  claimed: ['CLAIMED'],
  started: ['RUNNING'],
  evidence_submitted: ['EVIDENCE_READY'],
  verified: ['VERIFIED'],
  rejected_evidence: ['FAILED'],
  lease_expired: ['READY','FAILED'],
  cancelled: ['CANCELLED']
});
const TERMINAL = new Set(['VERIFIED','FAILED','CANCELLED']);

function exactObject(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.getPrototypeOf(value) !== Object.prototype ||
      Object.keys(value).length !== keys.length ||
      keys.some(key => !Object.hasOwn(value,key))) {
    throw new TypeError('Invalid journal schema or unapproved fields');
  }
}
function normalizeEvent(input) {
  exactObject(input, EVENT_FIELDS);
  const { sequence, type, taskId, state, revision, generation } = input;
  if (![sequence,revision,generation].every(Number.isSafeInteger) ||
      sequence < 1 || revision < 1 || generation < 0 ||
      typeof taskId !== 'string' || !ID.test(taskId) ||
      typeof type !== 'string' || !Object.hasOwn(TYPE_STATES,type) ||
      typeof state !== 'string' || !STATES.has(state) ||
      !TYPE_STATES[type].includes(state)) {
    throw new TypeError('Invalid journal event');
  }
  return { sequence, type, taskId, state, revision, generation };
}
function digest(previousHash, event) {
  return createHash('sha256').update(
    JSON.stringify([JOURNAL_VERSION,previousHash,event])
  ).digest('hex');
}
function assertTransition(event, previous) {
  if (!previous) {
    if (event.type !== 'registered' || event.state !== 'READY' ||
        event.revision !== 1 || event.generation !== 0) {
      throw new Error('Journal task must begin with registration');
    }
    return;
  }
  if (TERMINAL.has(previous.state)) throw new Error('Terminal task cannot advance');
  if (event.revision !== previous.revision + 1) throw new Error('Noncontiguous task revision');
  if (event.type === 'registered') throw new Error('Duplicate task registration');
  if (event.generation !== previous.generation + (event.type === 'claimed' ? 1 : 0)) {
    throw new Error('Invalid generation transition');
  }
  const from = previous.state;
  const allowed = (
    event.type === 'approved' && from === 'READY' ||
    event.type === 'claimed' && from === 'READY' ||
    event.type === 'started' && from === 'CLAIMED' ||
    event.type === 'evidence_submitted' && from === 'RUNNING' ||
    (event.type === 'verified' || event.type === 'rejected_evidence') && from === 'EVIDENCE_READY' ||
    event.type === 'lease_expired' && ['CLAIMED','RUNNING','EVIDENCE_READY'].includes(from) ||
    event.type === 'cancelled' && !TERMINAL.has(from)
  );
  if (!allowed) throw new Error('Invalid journal state transition');
}
function apply(events, onEvent) {
  if (!Array.isArray(events) || events.length > MAX_EVENTS) throw new RangeError('Journal event limit exceeded');
  const tasks = new Map();
  let sequence = 0;
  for (const raw of events) {
    const event = normalizeEvent(raw);
    if (event.sequence !== ++sequence) throw new Error('Noncontiguous journal sequence');
    assertTransition(event, tasks.get(event.taskId));
    tasks.set(event.taskId,event);
    onEvent?.(event);
  }
  return tasks;
}
/** Return a canonical, newline-delimited, integrity-chained metadata journal. */
export function encodeJournal(events) {
  const lines = [];
  let previousHash = HASH_ZERO;
  apply(events, event => {
    const hash = digest(previousHash,event);
    lines.push(JSON.stringify({version:JOURNAL_VERSION,event,previousHash,hash}));
    previousHash = hash;
  });
  const text = lines.length ? lines.join('\n') + '\n' : '';
  if (Buffer.byteLength(text,'utf8') > MAX_TEXT_BYTES) throw new RangeError('Journal byte limit exceeded');
  return text;
}
/** Validate a saved journal and return event metadata only. Never restore permissions. */
export function decodeJournal(text) {
  if (typeof text !== 'string' || Buffer.byteLength(text,'utf8') > MAX_TEXT_BYTES)
    throw new TypeError('Invalid journal text or size');
  if (!text) return [];
  if (!text.endsWith('\n')) throw new Error('Truncated journal line');
  const lines = text.slice(0,-1).split('\n');
  if (lines.length > MAX_EVENTS) throw new RangeError('Journal event limit exceeded');
  const events = [];
  let previousHash = HASH_ZERO;
  for (const line of lines) {
    let record;
    try { record = JSON.parse(line); } catch { throw new Error('Unreadable journal record'); }
    exactObject(record, RECORD_FIELDS);
    // Reject duplicate JSON keys, alternate key ordering and whitespace tricks.
    if (JSON.stringify(record) !== line) throw new Error('Noncanonical journal line');
    if (record.version !== JOURNAL_VERSION || record.previousHash !== previousHash ||
        typeof record.hash !== 'string' || !/^[0-9a-f]{64}$/.test(record.hash)) {
      throw new Error('Journal version or chain mismatch');
    }
    const event = normalizeEvent(record.event);
    if (record.hash !== digest(previousHash,event)) throw new Error('Journal checksum mismatch');
    events.push(event);
    previousHash = record.hash;
  }
  apply(events);
  return events.map(e => Object.freeze({...e}));
}
/** A cautious read-only recovery view, NOT a restartable worker or credentials. */
export function auditAfterRestart(journalText) {
  const events = decodeJournal(journalText);
  const tasks = apply(events);
  return Object.freeze({
    version: JOURNAL_VERSION,
    eventCount: events.length,
    tasks: Object.freeze([...tasks.values()].map(task => Object.freeze({
      id: task.taskId, recordedState: task.state,
      revision: task.revision, generation: task.generation,
      resumable: false, approvalsRestored: false, leasesRestored: false
    }))),
    disclaimer: 'Audit metadata only; historical checksums cannot restore a task or authorize execution.'
  });
}
