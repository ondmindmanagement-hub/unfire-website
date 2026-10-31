/** Unfire Bridge: offline SQLite security-state research ONLY. No real identity, network or actions. */
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { isAbsolute, dirname } from 'node:path';

const F = new Set(['macos','windows','linux']);
const CAP = new Set(['synthetic.send','synthetic.receive']);
const OPS = new Set(['synthetic.echo','synthetic.uppercase']);
function denied(code) { const e=new Error(code);e.code=code;throw e; }
function shape(x,keys) {
  if(!x||typeof x!=='object'||Array.isArray(x)||Object.keys(x).length!==keys.length||
    Object.keys(x).some(k=>!keys.includes(k)))denied('INVALID_INPUT');
}
function id(x) {if(typeof x!=='string'||!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(x))denied('INVALID_ID');return x;}
function fp(x) {if(typeof x!=='string'||!/^[a-fA-F0-9]{64}$/.test(x))denied('INVALID_FINGERPRINT');return x.toUpperCase();}
function time(x) {if(!Number.isSafeInteger(x)||x<0)denied('INVALID_TIME');return x;}
function approval(x) {if(x!==true)denied('CONSENT_REQUIRED');}
export function openDurablePolicy({dbPath}) {
  if(typeof dbPath!=='string'||!isAbsolute(dbPath)||dbPath.length>1024)denied('INVALID_PATH');
  mkdirSync(dirname(dbPath),{recursive:true,mode:0o700});
  const db=new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA busy_timeout=3000;');
  const tables=[
    'CREATE TABLE IF NOT EXISTS tenants(tenant TEXT PRIMARY KEY, stopped INTEGER NOT NULL DEFAULT 0, last_time INTEGER NOT NULL DEFAULT 0)',
    'CREATE TABLE IF NOT EXISTS nodes(tenant TEXT NOT NULL, node_id TEXT NOT NULL, platform TEXT NOT NULL, fingerprint TEXT NOT NULL UNIQUE, connected INTEGER NOT NULL DEFAULT 0, revoked INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(tenant,node_id))',
    'CREATE TABLE IF NOT EXISTS grants(grant_id TEXT PRIMARY KEY, tenant TEXT NOT NULL, node_id TEXT NOT NULL, capability TEXT NOT NULL, expires_at INTEGER NOT NULL, revoked INTEGER NOT NULL DEFAULT 0)',
    'CREATE TABLE IF NOT EXISTS delivered(tenant TEXT NOT NULL, message_id TEXT NOT NULL, accepted_at INTEGER NOT NULL, PRIMARY KEY(tenant,message_id))'
  ];for(const sql of tables)db.exec(sql);
  let closed=false;
  const available=()=>{if(closed)denied('STORE_CLOSED');};
  function tx(fn) {
    available();db.exec('BEGIN IMMEDIATE');
    try {const x=fn();db.exec('COMMIT');return x;}
    catch(e){db.exec('ROLLBACK');throw e;}
  }
  function active(t) {
    id(t);db.prepare('INSERT OR IGNORE INTO tenants(tenant) VALUES(?)').run(t);
    const row=db.prepare('SELECT * FROM tenants WHERE tenant=?').get(t);
    if(row.stopped)denied('TENANT_STOPPED');return row;
  }
  function clock(t,n) {
    const x=active(t);time(n);
    if(n<x.last_time)denied('CLOCK_ROLLBACK');
    db.prepare('UPDATE tenants SET last_time=? WHERE tenant=?').run(n,t);
  }
  function node(t,n) {
    const row=db.prepare('SELECT * FROM nodes WHERE tenant=? AND node_id=?').get(id(t),id(n));
    if(!row||row.revoked)denied('NODE_DENIED');return row;
  }
  function grant(g,t,n,c,when) {
    const row=db.prepare('SELECT * FROM grants WHERE grant_id=?').get(id(g));
    if(!row||row.tenant!==t||row.node_id!==n||row.capability!==c||row.revoked||row.expires_at<=when)denied('GRANT_DENIED');
  }
  return Object.freeze({
    enroll(x) {
      shape(x,['tenant','nodeId','platform','fingerprint','approved']);
      id(x.tenant);id(x.nodeId);approval(x.approved);const digest=fp(x.fingerprint);
      if(!F.has(x.platform))denied('PLATFORM_DENIED');
      return tx(()=>{
        active(x.tenant);
        if(db.prepare('SELECT 1 FROM nodes WHERE tenant=? AND node_id=?').get(x.tenant,x.nodeId)||
           db.prepare('SELECT 1 FROM nodes WHERE fingerprint=?').get(digest))denied('ALREADY_ENROLLED');
        db.prepare('INSERT INTO nodes(tenant,node_id,platform,fingerprint) VALUES(?,?,?,?)').run(x.tenant,x.nodeId,x.platform,digest);
        return {status:'enrolled_synthetic',externalActionAllowed:false};
      });
    },
    connect(x) {
      shape(x,['tenant','nodeId','approved']);approval(x.approved);
      return tx(()=>{active(x.tenant);node(x.tenant,x.nodeId);
        db.prepare('UPDATE nodes SET connected=1 WHERE tenant=? AND node_id=?').run(x.tenant,x.nodeId);
        return {status:'connected_synthetic',externalActionAllowed:false};
      });
    },
    disconnect(x) {
      shape(x,['tenant','nodeId']);return tx(()=>{node(x.tenant,x.nodeId);
        db.prepare('UPDATE nodes SET connected=0 WHERE tenant=? AND node_id=?').run(x.tenant,x.nodeId);
        return {status:'disconnected'};
      });
    },
    revokeNode(x) {
      shape(x,['tenant','nodeId']);return tx(()=>{node(x.tenant,x.nodeId);
        db.prepare('UPDATE nodes SET revoked=1,connected=0 WHERE tenant=? AND node_id=?').run(x.tenant,x.nodeId);
        return {status:'revoked'};
      });
    },
    issueGrant(x) {
      shape(x,['tenant','nodeId','grantId','capability','now','expiresAt','approved']);
      id(x.tenant);id(x.nodeId);id(x.grantId);approval(x.approved);
      if(!CAP.has(x.capability))denied('CAPABILITY_DENIED');
      time(x.now);time(x.expiresAt);
      if(x.expiresAt<=x.now||x.expiresAt-x.now>60000)denied('INVALID_EXPIRY');
      return tx(()=>{clock(x.tenant,x.now);node(x.tenant,x.nodeId);
        if(db.prepare('SELECT 1 FROM grants WHERE grant_id=?').get(x.grantId))denied('GRANT_ALREADY_EXISTS');
        db.prepare('INSERT INTO grants(grant_id,tenant,node_id,capability,expires_at) VALUES(?,?,?,?,?)')
          .run(x.grantId,x.tenant,x.nodeId,x.capability,x.expiresAt);
        return {status:'granted_synthetic',externalActionAllowed:false};
      });
    },
    revokeGrant(x) {
      shape(x,['tenant','grantId']);return tx(()=>{id(x.tenant);id(x.grantId);
        const g=db.prepare('SELECT tenant FROM grants WHERE grant_id=?').get(x.grantId);
        if(!g||g.tenant!==x.tenant)denied('GRANT_DENIED');
        db.prepare('UPDATE grants SET revoked=1 WHERE grant_id=?').run(x.grantId);
        return {status:'grant_revoked'};
      });
    },
    acceptSynthetic(x) {
      shape(x,['tenant','messageId','fromNodeId','toNodeId','fingerprint','sendGrantId','receiveGrantId','operation','payload','issuedAt','expiresAt','now']);
      id(x.tenant);id(x.messageId);id(x.fromNodeId);id(x.toNodeId);
      if(x.fromNodeId===x.toNodeId)denied('SAME_NODE');
      const digest=fp(x.fingerprint);
      if(!OPS.has(x.operation))denied('OPERATION_DENIED');
      if(typeof x.payload!=='string'||Buffer.byteLength(x.payload)>256)denied('PAYLOAD_DENIED');
      time(x.now);time(x.issuedAt);time(x.expiresAt);
      if(x.expiresAt<=x.now||x.issuedAt>x.now||x.now-x.issuedAt>10000||x.expiresAt-x.issuedAt>10000)denied('MESSAGE_EXPIRED');
      return tx(()=>{
        clock(x.tenant,x.now);
        const a=node(x.tenant,x.fromNodeId),b=node(x.tenant,x.toNodeId);
        if(!a.connected||!b.connected)denied('NODE_DISCONNECTED');
        if(a.fingerprint!==digest)denied('IDENTITY_MISMATCH');
        grant(x.sendGrantId,x.tenant,x.fromNodeId,'synthetic.send',x.now);
        grant(x.receiveGrantId,x.tenant,x.toNodeId,'synthetic.receive',x.now);
        if(db.prepare('SELECT 1 FROM delivered WHERE tenant=? AND message_id=?').get(x.tenant,x.messageId))denied('REPLAY');
        if(db.prepare('SELECT COUNT(*) AS n FROM delivered WHERE tenant=?').get(x.tenant).n>=1000)denied('REPLAY_CAPACITY');
        db.prepare('INSERT INTO delivered(tenant,message_id,accepted_at) VALUES(?,?,?)').run(x.tenant,x.messageId,x.now);
        return {status:'accepted_synthetic',messageId:x.messageId,targetPlatform:b.platform,externalActionAllowed:false};
      });
    },
    stop(x) {
      shape(x,['tenant']);return tx(()=>{id(x.tenant);
        db.prepare('INSERT OR IGNORE INTO tenants(tenant) VALUES(?)').run(x.tenant);
        db.prepare('UPDATE tenants SET stopped=1 WHERE tenant=?').run(x.tenant);
        return {status:'stopped',externalActionAllowed:false};
      });
    },
    snapshot(x) {
      shape(x,['tenant']);available();id(x.tenant);
      const row=db.prepare('SELECT stopped,last_time FROM tenants WHERE tenant=?').get(x.tenant);
      const enrolled=db.prepare('SELECT COUNT(*) AS n FROM nodes WHERE tenant=?').get(x.tenant).n;
      const accepted=db.prepare('SELECT COUNT(*) AS n FROM delivered WHERE tenant=?').get(x.tenant).n;
      return {tenant:x.tenant,stopped:!!row?.stopped,lastTime:row?.last_time??0,enrolled,accepted};
    },
    close(){if(!closed){db.close();closed=true;}}
  });
}
