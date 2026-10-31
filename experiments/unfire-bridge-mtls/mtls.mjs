/**
 * Unfire Bridge · TLS 1.3 mutual-certificate localhost research ONLY.
 * Enrollment and grants are trusted test-harness calls, not network APIs.
 * No real OS commands, user data, remote hosts or persistent state.
 */
import { createServer } from 'node:https';
import { request as httpsRequest } from 'node:https';
import { X509Certificate } from 'node:crypto';

const PLATFORMS = new Set(['macos', 'windows', 'linux']);
const OPS = new Set(['synthetic.echo', 'synthetic.uppercase']);
const CAP = new Set(['synthetic.send', 'synthetic.receive']);
const FIELDS = ['v','tenant','messageId','fromNodeId','toNodeId','operation','payload','issuedAt','expiresAt'];
const MAX_BYTES = 2048;
function fail(code) { const e = new Error(code); e.code=code; throw e; }
function exact(v,keys) {
  if (!v || typeof v!=='object' || Array.isArray(v) ||
      Object.keys(v).length!==keys.length ||
      Object.keys(v).some(k=>!keys.includes(k))) fail('INVALID_SHAPE');
}
function id(v) { if (typeof v!=='string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(v)) fail('INVALID_ID');return v; }
function nowNumber(v) { if (!Number.isSafeInteger(v) || v < 0) fail('INVALID_TIME'); return v; }
function consent(v) { if (v !== true) fail('CONSENT_REQUIRED'); }
function address(tenant,node) { return tenant+':'+node; }

export function createMtlsLab({serverKeyPem,serverCertPem,caCertPem,clock=()=>Date.now()}) {
  if (![serverKeyPem,serverCertPem,caCertPem].every(x=>typeof x==='string' && x.includes('-----BEGIN ')) ||
      typeof clock !== 'function') fail('INVALID_CONFIG');
  const nodes=new Map(), fingerprints=new Set(), grants=new Map(), replay=new Set(), stopped=new Set();
  let server=null,port=null;
  function active(tenant) { id(tenant); if(stopped.has(tenant)) fail('TENANT_STOPPED'); }
  function getNode(tenant,nodeId) {
    const found=nodes.get(address(id(tenant),id(nodeId)));
    if(!found || found.revoked) fail('NODE_DENIED');
    return found;
  }
  function allowed(tenant,nodeId,capability,t) {
    const g=grants.get(address(tenant,nodeId)+':'+capability);
    if(!g || g.revoked || t>=g.expiresAt) fail('GRANT_DENIED');
  }
  function relay(req,input) {
    exact(input,FIELDS);
    if(input.v!==1)fail('INVALID_VERSION');
    active(input.tenant);
    id(input.messageId);id(input.fromNodeId);id(input.toNodeId);
    if(input.fromNodeId===input.toNodeId)fail('SAME_NODE');
    if(!OPS.has(input.operation))fail('OPERATION_DENIED');
    if(typeof input.payload!=='string' || Buffer.byteLength(input.payload)>256)fail('PAYLOAD_DENIED');
    const t=nowNumber(clock()), issued=nowNumber(input.issuedAt), expiry=nowNumber(input.expiresAt);
    if(expiry<=issued || expiry-issued>10_000 || issued>t+2000 || expiry<=t || t-issued>10_000)fail('MESSAGE_EXPIRED');
    const source=getNode(input.tenant,input.fromNodeId), target=getNode(input.tenant,input.toNodeId);
    if(!source.connected || !target.connected)fail('NODE_DISCONNECTED');
    if(req.socket.authorized!==true)fail('UNAUTHORIZED_PEER');
    const peer=req.socket.getPeerCertificate();
    if(!peer || typeof peer.fingerprint256!=='string' || peer.fingerprint256!==source.fingerprint)
      fail('IDENTITY_MISMATCH');
    allowed(input.tenant,input.fromNodeId,'synthetic.send',t);
    allowed(input.tenant,input.toNodeId,'synthetic.receive',t);
    const key=address(input.tenant,input.messageId);
    if(replay.has(key))fail('REPLAY');
    replay.add(key);
    return {status:'simulated',transport:'tls13_mtls_loopback',externalActionAllowed:false,
      targetPlatform:target.platform,messageId:input.messageId,
      value:input.operation==='synthetic.uppercase'?input.payload.toUpperCase():input.payload};
  }
  function respond(res,status,body) {
    res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(JSON.stringify(body));
  }
  async function handler(req,res) {
    try {
      if(req.method!=='POST' || req.url!=='/v1/relay')fail('ROUTE_DENIED');
      if(req.socket.remoteAddress!=='127.0.0.1')fail('NON_LOOPBACK');
      if(req.socket.getProtocol()!=='TLSv1.3')fail('TLS_REQUIRED');
      if(req.headers.host!=='127.0.0.1:'+port || req.headers.origin ||
         req.headers['content-type']!=='application/json')fail('HEADERS_DENIED');
      const declared=req.headers['content-length'];
      if(declared!==undefined && (!/^\d+$/.test(declared) || Number(declared)>MAX_BYTES))
        fail('OVERSIZED');
      let size=0;const parts=[];
      for await(const part of req) {
        size+=part.length;
        if(size>MAX_BYTES)fail('OVERSIZED');
        parts.push(part);
      }
      const input=JSON.parse(Buffer.concat(parts).toString('utf8'));
      respond(res,200,relay(req,input));
    }catch(e) {
      if(!res.writableEnded && !res.destroyed)
        respond(res,e.code==='OVERSIZED'?413:e.code==='REPLAY'?409:403,
          {status:'denied',code:e.code||'BAD_REQUEST'});
    }
  }
  return Object.freeze({
    enroll({tenant,nodeId,platform,clientCertificatePem,approved}) {
      active(tenant);id(nodeId);consent(approved);
      if(!PLATFORMS.has(platform)||typeof clientCertificatePem!=='string'||clientCertificatePem.length>10000)
        fail('ENROLLMENT_DENIED');
      let cert;try{cert=new X509Certificate(clientCertificatePem);}catch{fail('ENROLLMENT_DENIED');}
      const fingerprint=cert.fingerprint256;
      if(fingerprints.has(fingerprint)||nodes.has(address(tenant,nodeId)))fail('DUPLICATE_ENROLLMENT');
      fingerprints.add(fingerprint);
      nodes.set(address(tenant,nodeId),{fingerprint,platform,connected:false,revoked:false});
      return {status:'enrolled_test_only',connected:false,externalActionAllowed:false};
    },
    connect({tenant,nodeId,approved}) {
      active(tenant);consent(approved);getNode(tenant,nodeId).connected=true;
      return {status:'connected_test_only',externalActionAllowed:false};
    },
    disconnect({tenant,nodeId}) {active(tenant);getNode(tenant,nodeId).connected=false;},
    revoke({tenant,nodeId}) {active(tenant);const n=getNode(tenant,nodeId);n.revoked=true;n.connected=false;},
    grant({tenant,nodeId,capability,ttlMs,approved}) {
      active(tenant);getNode(tenant,nodeId);consent(approved);nowNumber(ttlMs);
      if(!CAP.has(capability)||ttlMs<1||ttlMs>60_000)fail('GRANT_DENIED');
      grants.set(address(tenant,nodeId)+':'+capability,{expiresAt:nowNumber(clock())+ttlMs,revoked:false});
      return {status:'granted_test_only',externalActionAllowed:false};
    },
    revokeGrant({tenant,nodeId,capability}) {
      active(tenant);id(nodeId);
      const g=grants.get(address(tenant,nodeId)+':'+capability);
      if(!g)fail('GRANT_DENIED');g.revoked=true;
    },
    stop({tenant}) {stopped.add(id(tenant));return {status:'stopped',externalActionAllowed:false};},
    async start() {
      if(server)fail('ALREADY_STARTED');
      server=createServer({key:serverKeyPem,cert:serverCertPem,ca:caCertPem,
        minVersion:'TLSv1.3',maxVersion:'TLSv1.3',requestCert:true,rejectUnauthorized:true},
        (req,res)=>{void handler(req,res);});
      server.requestTimeout=3000;server.headersTimeout=3000;server.keepAliveTimeout=500;
      try{await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});}
      catch(e){server=null;throw e;}
      const a=server.address();
      if(a.address!=='127.0.0.1')fail('NON_LOOPBACK');
      port=a.port;
      return 'https://127.0.0.1:'+port+'/v1/relay';
    },
    async close() {
      if(!server)return;
      const previous=server;server=null;port=null;
      previous.closeAllConnections();
      await new Promise((resolve,reject)=>previous.close(e=>e?reject(e):resolve()));
    },
    snapshot({tenant}) {
      id(tenant);
      return {tenant,stopped:stopped.has(tenant),enrolled:[...nodes.keys()].filter(k=>k.startsWith(tenant+':')).length,
        accepted:[...replay].filter(k=>k.startsWith(tenant+':')).length};
    }
  });
}

export async function sendMtlsSynthetic({url,keyPem,certPem,caPem,packet,hostHeader}) {
  const u=new URL(url);
  if(u.protocol!=='https:'||u.hostname!=='127.0.0.1'||!u.port||
     u.pathname!=='/v1/relay'||u.search||u.hash||u.username||u.password)fail('LOOPBACK_ONLY');
  const body=JSON.stringify(packet);
  return await new Promise((resolve,reject)=>{
    const q=httpsRequest(u,{method:'POST',key:keyPem,cert:certPem,ca:caPem,
      minVersion:'TLSv1.3',maxVersion:'TLSv1.3',rejectUnauthorized:true,agent:false,
      timeout:3000,headers:{'content-type':'application/json','host':hostHeader||u.host}},
      res=>{
        let data='';res.setEncoding('utf8');
        res.on('data',chunk=>{data+=chunk;if(data.length>MAX_BYTES)res.destroy(new Error('RESPONSE_TOO_LARGE'));});
        res.on('error',reject);
        res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(data)});}catch(e){reject(e);}});
      });
    q.on('timeout',()=>q.destroy(new Error('TIMEOUT')));
    q.on('error',reject);
    q.end(body);
  });
}
