/**
 * Unfire Bridge · loopback transport research, NOT a production authentication system.
 * Strictly 127.0.0.1, ephemeral port, synthetic transformations only.
 * All enrollment/grant functions are trusted test-harness methods, not HTTP endpoints.
 */
import { createServer } from 'node:http';
import { createPublicKey, sign as signBytes, verify as verifyBytes } from 'node:crypto';

const TYPES = Object.freeze(['v','tenant','messageId','fromNodeId','toNodeId','operation','payload','issuedAt','expiresAt']);
const OPS = new Set(['synthetic.echo', 'synthetic.uppercase']);
const GRANTS = new Set(['synthetic.send', 'synthetic.receive']);
const PLATFORMS = new Set(['macos', 'windows', 'linux']);
const DOMAIN = Buffer.from('UNFIRE-BRIDGE-LOOPBACK/v1\0', 'utf8');
const LIMIT_BYTES = 2048;
const MAX_GRANT_MS = 60_000;
const MAX_PACKET_MS = 10_000;
const MAX_SKEW_MS = 2_000;

function reject(code) { const e = new Error(code); e.code = code; throw e; }
function exact(obj, fields) {
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) reject('INVALID_SHAPE');
  const keys = Object.keys(obj);
  if (keys.length !== fields.length || keys.some(key => !fields.includes(key))) reject('INVALID_SHAPE');
}
function ident(s) {
  if (typeof s !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(s)) reject('INVALID_ID');
  return s;
}
function integer(n) { if (!Number.isSafeInteger(n) || n < 0) reject('INVALID_NUMBER'); return n; }
function approved(value) { if (value !== true) reject('CONSENT_REQUIRED'); }
function nodeKey(tenant,nodeId) { return `${tenant}:${nodeId}`; }
function grantKey(tenant,nodeId,capability) { return `${tenant}:${nodeId}:${capability}`; }

function packetFields(packet) {
  exact(packet, TYPES);
  if (packet.v !== 1) reject('INVALID_VERSION');
  ident(packet.tenant); ident(packet.messageId); ident(packet.fromNodeId); ident(packet.toNodeId);
  if (packet.fromNodeId === packet.toNodeId) reject('INVALID_DESTINATION');
  if (!OPS.has(packet.operation)) reject('UNKNOWN_OPERATION');
  if (typeof packet.payload !== 'string' || Buffer.byteLength(packet.payload, 'utf8') > 256) reject('INVALID_PAYLOAD');
  integer(packet.issuedAt); integer(packet.expiresAt);
  if (packet.expiresAt <= packet.issuedAt || packet.expiresAt - packet.issuedAt > MAX_PACKET_MS) reject('INVALID_EXPIRY');
  return TYPES.map(k => packet[k]);
}
function signingInput(packet) {
  return Buffer.concat([DOMAIN, Buffer.from(JSON.stringify(packetFields(packet)))]);
}
export function signSyntheticPacket(packet, privateKey) {
  const signed = signBytes(null, signingInput(packet), privateKey);
  return { packet: { ...packet }, signature: signed.toString('base64url') };
}
export async function postSyntheticPacket(url, envelope) {
  const dest = new URL(url);
  if (dest.protocol !== 'http:' || dest.hostname !== '127.0.0.1' || !/^\d{1,5}$/.test(dest.port) ||
      dest.port === '0' || dest.pathname !== '/v1/relay' || dest.search || dest.hash || dest.username || dest.password) reject('LOOPBACK_ONLY');
  const r = await fetch(dest, { method:'POST', headers:{'content-type':'application/json'},
    body:JSON.stringify(envelope), signal:AbortSignal.timeout(3000), redirect:'error' });
  return { status:r.status, body:await r.json() };
}

export function createLoopbackHost({ clock = () => Date.now() } = {}) {
  if (typeof clock !== 'function') reject('INVALID_CLOCK');
  const nodes = new Map(), grants = new Map(), seen = new Set(), stopped = new Set();
  let server, address;
  const active = tenant => { ident(tenant); if (stopped.has(tenant)) reject('TENANT_STOPPED'); };
  const getNode = (tenant,nodeId) => {
    const node = nodes.get(nodeKey(ident(tenant), ident(nodeId)));
    if (!node || node.revoked) reject('NODE_DENIED');
    return node;
  };
  const allow = (tenant,nodeId,capability,now) => {
    const grant = grants.get(grantKey(tenant,nodeId,capability));
    if (!grant || grant.revoked || grant.expiresAt <= now) reject('CAPABILITY_DENIED');
  };
  function execute(envelope) {
    exact(envelope, ['packet','signature']);
    const packet = envelope.packet;
    const signed = signingInput(packet);
    const now = integer(clock());
    active(packet.tenant);
    if (packet.issuedAt > now + MAX_SKEW_MS || packet.expiresAt <= now || now - packet.issuedAt > MAX_PACKET_MS) reject('PACKET_EXPIRED');
    const from = getNode(packet.tenant, packet.fromNodeId);
    const to = getNode(packet.tenant, packet.toNodeId);
    if (!from.connected || !to.connected) reject('NODE_DISCONNECTED');
    if (typeof envelope.signature !== 'string' || !/^[A-Za-z0-9_-]{86}$/.test(envelope.signature)) reject('INVALID_SIGNATURE');
    const signature = Buffer.from(envelope.signature, 'base64url');
    if (signature.length !== 64 || signature.toString('base64url') !== envelope.signature ||
        !verifyBytes(null, signed, from.key, signature)) reject('INVALID_SIGNATURE');
    allow(packet.tenant, packet.fromNodeId, 'synthetic.send', now);
    allow(packet.tenant, packet.toNodeId, 'synthetic.receive', now);
    const key = nodeKey(packet.tenant,packet.messageId);
    if (seen.has(key)) reject('REPLAY');
    seen.add(key);
    const value = packet.operation === 'synthetic.uppercase' ? packet.payload.toUpperCase() : packet.payload;
    return {status:'simulated',transport:'real_loopback_http',externalActionAllowed:false,
      messageId:packet.messageId,targetPlatform:to.platform,value};
  }
  function respond(res,status,body) {
    res.writeHead(status, {'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(JSON.stringify(body));
  }
  async function handler(req,res) {
    try {
      if (req.method !== 'POST' || req.url !== '/v1/relay') reject('ROUTE_DENIED');
      if (req.socket.remoteAddress !== '127.0.0.1') reject('LOOPBACK_ONLY');
      if (req.headers.host !== `127.0.0.1:${address.port}` || req.headers.origin ||
          req.headers['content-type'] !== 'application/json') reject('REQUEST_DENIED');
      const length = req.headers['content-length'];
      if (length !== undefined && (!/^\d+$/.test(length) || Number(length) > LIMIT_BYTES)) reject('PAYLOAD_TOO_LARGE');
      const parts = []; let size = 0;
      for await (const part of req) {
        size += part.length;
        if (size > LIMIT_BYTES) reject('PAYLOAD_TOO_LARGE');
        parts.push(part);
      }
      const data = JSON.parse(Buffer.concat(parts).toString('utf8'));
      const output = execute(data);
      respond(res,200,output);
    } catch (e) {
      if (!res.writableEnded && !res.destroyed) {
        const code = e?.code || 'INVALID_REQUEST';
        const status = code === 'PAYLOAD_TOO_LARGE' ? 413 :
          (code === 'INVALID_SIGNATURE' ? 401 : (code === 'REPLAY' ? 409 : 403));
        respond(res,status,{status:'denied',code});
      }
    }
  }
  return Object.freeze({
    enroll({tenant,nodeId,platform,publicKeyPem,consent}) {
      active(tenant); ident(nodeId); approved(consent);
      if (!PLATFORMS.has(platform) || typeof publicKeyPem !== 'string' || publicKeyPem.length > 1024) reject('INVALID_ENROLLMENT');
      let key; try { key = createPublicKey(publicKeyPem); } catch { reject('INVALID_ENROLLMENT'); }
      if (key.asymmetricKeyType !== 'ed25519') reject('INVALID_ENROLLMENT');
      const ref = nodeKey(tenant,nodeId);
      if (nodes.has(ref)) reject('ALREADY_ENROLLED');
      nodes.set(ref,{key,platform,connected:false,revoked:false});
      return {status:'enrolled',connected:false,externalActionAllowed:false};
    },
    connect({tenant,nodeId,consent}) {
      active(tenant); approved(consent); getNode(tenant,nodeId).connected = true;
      return {status:'connected_simulated',externalActionAllowed:false};
    },
    disconnect({tenant,nodeId}) { active(tenant); getNode(tenant,nodeId).connected = false; },
    revoke({tenant,nodeId}) { active(tenant); const node=getNode(tenant,nodeId);node.connected=false;node.revoked=true; },
    grant({tenant,nodeId,capability,ttlMs,consent}) {
      active(tenant);getNode(tenant,nodeId);approved(consent);integer(ttlMs);
      if (!GRANTS.has(capability) || ttlMs < 1 || ttlMs > MAX_GRANT_MS) reject('GRANT_DENIED');
      const now=integer(clock());
      grants.set(grantKey(tenant,nodeId,capability),{expiresAt:now+ttlMs,revoked:false});
      return {status:'granted_simulated',externalActionAllowed:false};
    },
    revokeGrant({tenant,nodeId,capability}) {
      active(tenant);ident(nodeId);
      const g=grants.get(grantKey(tenant,nodeId,capability));if (!g) reject('GRANT_DENIED');g.revoked=true;
    },
    stopTenant({tenant}) { stopped.add(ident(tenant));return {status:'stopped',externalActionAllowed:false}; },
    async start() {
      if (server) reject('ALREADY_STARTED');
      server=createServer((req,res)=>{ void handler(req,res); });
      server.requestTimeout=3_000;
      server.headersTimeout=3_000;
      server.keepAliveTimeout=500;
      try {
        await new Promise((resolve,rejectStart)=> { server.once('error',rejectStart);server.listen(0,'127.0.0.1',resolve); });
      } catch(e) { server=undefined;throw e; }
      address=server.address();
      if (address.address !== '127.0.0.1') reject('NOT_LOOPBACK');
      return `http://127.0.0.1:${address.port}/v1/relay`;
    },
    async close() { if (server) { const current=server;server=undefined;await new Promise((resolve,rejectClose)=>current.close(e=>e?rejectClose(e):resolve())); } },
    snapshot({tenant}) { ident(tenant);return {tenant,stopped:stopped.has(tenant),nodes:[...nodes.keys()].filter(k=>k.startsWith(`${tenant}:`)).length,
      acceptedMessages:[...seen].filter(k=>k.startsWith(`${tenant}:`)).length}; },
  });
}