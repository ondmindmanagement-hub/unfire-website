import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
import { createMtlsLab, sendMtlsSynthetic } from './mtls.mjs';

let dir, ca, rogueCa, serverKey, serverCert, firstKey, firstCert, secondCert, otherKey, otherCert, thirdKey, thirdCert;
function openssl(...args) {
  const exe=process.env.OPENSSL_BIN||'openssl';
  const r=spawnSync(exe,args,{cwd:dir,encoding:'utf8',windowsHide:true,timeout:20000});
  if(r.error || r.status!==0)throw new Error('OpenSSL fixture generation failed: '+(r.error?.message||r.stderr));
}
function file(path) {return readFileSync(join(dir,path),'utf8');}
function authority(prefix) {
  openssl('req','-x509','-newkey','rsa:2048','-nodes','-sha256','-days','1',
    '-keyout',prefix+'.key','-out',prefix+'.pem','-subj','/CN='+prefix,
    '-addext','basicConstraints=critical,CA:TRUE','-addext','keyUsage=critical,keyCertSign,cRLSign');
}
function leaf(name, caName, kind) {
  const ext=kind==='server'
    ? 'basicConstraints=critical,CA:FALSE\nsubjectAltName=IP:127.0.0.1,DNS:localhost\nextendedKeyUsage=serverAuth\nkeyUsage=digitalSignature,keyEncipherment\n'
    : 'basicConstraints=critical,CA:FALSE\nextendedKeyUsage=clientAuth\nkeyUsage=digitalSignature,keyEncipherment\n';
  writeFileSync(join(dir,name+'.ext'),ext);
  openssl('req','-newkey','rsa:2048','-nodes','-keyout',name+'.key','-out',name+'.csr','-subj','/CN='+name);
  openssl('x509','-req','-in',name+'.csr','-CA',caName+'.pem','-CAkey',caName+'.key',
    '-CAcreateserial','-out',name+'.pem','-days','1','-sha256','-extfile',name+'.ext');
}
before(()=>{
  dir=mkdtempSync(join(tmpdir(),'unfire-bridge-mtls-fixtures-'));
  authority('labCA');authority('rogueCA');
  leaf('server','labCA','server');
  leaf('sender','labCA','client');leaf('receiver','labCA','client');
  leaf('other','labCA','client');leaf('rogue','rogueCA','client');
  ca=file('labCA.pem');rogueCa=file('rogueCA.pem');
  serverKey=file('server.key');serverCert=file('server.pem');
  firstKey=file('sender.key');firstCert=file('sender.pem');
  secondCert=file('receiver.pem');otherKey=file('other.key');otherCert=file('other.pem');
  thirdKey=file('rogue.key');thirdCert=file('rogue.pem');
});
after(()=>{if(dir)rmSync(dir,{recursive:true,force:true});});
const denial=(fn,code)=>assert.throws(fn,e=>e.code===code);
function setup({consent=true,grant=true}={}) {
  let t=Date.now();
  const lab=createMtlsLab({serverKeyPem:serverKey,serverCertPem:serverCert,caCertPem:ca,clock:()=>t});
  const enroll=(tenant,nodeId,platform,certificate,approved=true)=>lab.enroll({tenant,nodeId,platform,clientCertificatePem:certificate,approved});
  enroll('university','sender','macos',firstCert,consent);
  enroll('university','receiver','linux',secondCert);
  lab.connect({tenant:'university',nodeId:'sender',approved:true});
  lab.connect({tenant:'university',nodeId:'receiver',approved:true});
  if(grant) {
    lab.grant({tenant:'university',nodeId:'sender',capability:'synthetic.send',ttlMs:60000,approved:true});
    lab.grant({tenant:'university',nodeId:'receiver',capability:'synthetic.receive',ttlMs:60000,approved:true});
  }
  const packet={v:1,tenant:'university',messageId:'a1',fromNodeId:'sender',toNodeId:'receiver',
    operation:'synthetic.uppercase',payload:'safe research',issuedAt:t,expiresAt:t+5000};
  const send=(url,p=packet,key=firstKey,cert=firstCert,trust=ca,hostHeader)=>sendMtlsSynthetic({
    url,keyPem:key,certPem:cert,caPem:trust,packet:p,hostHeader
  });
  return {lab,packet,send,setTime:(n)=>{t=n;},enroll};
}
async function withHost(fn) {
  const obj=setup();
  const url=await obj.lab.start();
  try {await fn({...obj,url});}
  finally {await obj.lab.close();}
}

test('temporary server certificate verifies against its local CA',()=>{
  openssl('verify','-CAfile','labCA.pem','-purpose','sslserver','server.pem');
});
test('temporary client certificate verifies against its local CA',()=>{
  openssl('verify','-CAfile','labCA.pem','-purpose','sslclient','sender.pem');
});
test('enrollment is offline and requires opt-in',()=>{
  const lab=createMtlsLab({serverKeyPem:serverKey,serverCertPem:serverCert,caCertPem:ca});
  denial(()=>lab.enroll({tenant:'x',nodeId:'a',platform:'macos',clientCertificatePem:firstCert,approved:false}),'CONSENT_REQUIRED');
  assert.deepEqual(lab.snapshot({tenant:'x'}),{tenant:'x',stopped:false,enrolled:0,accepted:0});
});
test('only three OS platform labels are allowed',()=>{
  const lab=createMtlsLab({serverKeyPem:serverKey,serverCertPem:serverCert,caCertPem:ca});
  denial(()=>lab.enroll({tenant:'x',nodeId:'a',platform:'android',clientCertificatePem:firstCert,approved:true}),'ENROLLMENT_DENIED');
});
test('duplicate certificate across tenants is denied',()=>{
  const {lab}=setup();
  denial(()=>lab.enroll({tenant:'other',nodeId:'impostor',platform:'linux',clientCertificatePem:firstCert,approved:true}),'DUPLICATE_ENROLLMENT');
});
test('grants require explicit approval',()=>{
  const {lab}=setup();
  denial(()=>lab.grant({tenant:'university',nodeId:'sender',capability:'synthetic.send',ttlMs:1000,approved:false}),'CONSENT_REQUIRED');
});
test('unknown capabilities are refused',()=>{
  const {lab}=setup();
  denial(()=>lab.grant({tenant:'university',nodeId:'sender',capability:'shell.execute',ttlMs:1000,approved:true}),'GRANT_DENIED');
});
test('real TLS 1.3 mTLS transports synthetic uppercase over 127.0.0.1',async()=>{
  await withHost(async({lab,url,send})=>{
    assert.match(url,/^https:\/\/127\.0\.0\.1:\d+\/v1\/relay$/);
    const r=await send(url);assert.equal(r.status,200);
    assert.deepEqual(r.body,{status:'simulated',transport:'tls13_mtls_loopback',externalActionAllowed:false,
      targetPlatform:'linux',messageId:'a1',value:'SAFE RESEARCH'});
    assert.equal(lab.snapshot({tenant:'university'}).accepted,1);
  });
});
test('replay of a previously accepted message is denied',async()=>{
  await withHost(async({url,send})=>{
    assert.equal((await send(url)).status,200);
    const r=await send(url);assert.equal(r.status,409);assert.equal(r.body.code,'REPLAY');
  });
});
test('a valid CA client certificate for the wrong node does not impersonate sender',async()=>{
  await withHost(async({url,send})=>{
    const r=await send(url,undefined,otherKey,otherCert);
    assert.equal(r.status,403);assert.equal(r.body.code,'IDENTITY_MISMATCH');
  });
});
test('a client without a certificate cannot establish an authorized TLS request',async()=>{
  await withHost(async({url,send})=>{await assert.rejects(send(url,undefined,null,null));});
});
test('a client from a rogue CA cannot establish a trusted mTLS connection',async()=>{
  await withHost(async({url,send})=>{await assert.rejects(send(url,undefined,thirdKey,thirdCert));});
});
test('a client using wrong server CA fails server verification',async()=>{
  await withHost(async({url,send})=>{await assert.rejects(send(url,undefined,firstKey,firstCert,rogueCa));});
});
test('grant removal immediately blocks delivery in the in-memory host',async()=>{
  await withHost(async({lab,url,send})=>{
    lab.revokeGrant({tenant:'university',nodeId:'sender',capability:'synthetic.send'});
    const r=await send(url);assert.equal(r.status,403);assert.equal(r.body.code,'GRANT_DENIED');
  });
});
test('connection revocation blocks delivery',async()=>{
  await withHost(async({lab,url,send})=>{
    lab.revoke({tenant:'university',nodeId:'sender'});
    const r=await send(url);assert.equal(r.status,403);assert.equal(r.body.code,'NODE_DENIED');
  });
});
test('disconnecting a recipient stops delivery',async()=>{
  await withHost(async({lab,url,send})=>{
    lab.disconnect({tenant:'university',nodeId:'receiver'});
    const r=await send(url);assert.equal(r.status,403);assert.equal(r.body.code,'NODE_DISCONNECTED');
  });
});
test('STOP prevents delivery and future consented connections',async()=>{
  await withHost(async({lab,url,send})=>{
    lab.stop({tenant:'university'});
    assert.equal(lab.snapshot({tenant:'university'}).stopped,true);
    const r=await send(url);assert.equal(r.status,403);assert.equal(r.body.code,'TENANT_STOPPED');
    denial(()=>lab.connect({tenant:'university',nodeId:'sender',approved:true}),'TENANT_STOPPED');
  });
});
test('messages from outside tenant cannot reach another tenant',async()=>{
  await withHost(async({url,send,packet})=>{
    const r=await send(url,{...packet,tenant:'external'});
    assert.equal(r.status,403);assert.equal(r.body.code,'NODE_DENIED');
  });
});
test('short-lived synthetic message expiry is checked',async()=>{
  await withHost(async({url,send,setTime,packet})=>{
    setTime(packet.expiresAt);
    const r=await send(url);assert.equal(r.status,403);assert.equal(r.body.code,'MESSAGE_EXPIRED');
  });
});
test('unauthorized operation name never executes',async()=>{
  await withHost(async({url,send,packet})=>{
    const r=await send(url,{...packet,operation:'os.shell'});
    assert.equal(r.status,403);assert.equal(r.body.code,'OPERATION_DENIED');
  });
});
test('extra untrusted packet fields are denied',async()=>{
  await withHost(async({url,send,packet})=>{
    const r=await send(url,{...packet,execute:true});
    assert.equal(r.status,403);assert.equal(r.body.code,'INVALID_SHAPE');
  });
});
test('incorrect Host header is denied by TLS hostname verification or HTTP policy',async()=>{
  await withHost(async({url,send})=>{
    const result=await send(url,undefined,firstKey,firstCert,ca,'evil.example')
      .then(value=>({kind:'response',value}),error=>({kind:'error',code:error.code}));
    if(result.kind==='error')assert.equal(result.code,'ERR_TLS_CERT_ALTNAME_INVALID');
    else {assert.equal(result.value.status,403);assert.equal(result.value.body.code,'HEADERS_DENIED');}
  });
});
test('external network URLs are refused before connecting',async()=>{
  const {send}=setup();
  await assert.rejects(send('https://example.org/v1/relay'),e=>e.code==='LOOPBACK_ONLY');
});
test('stopping the service closes its listening port',async()=>{
  const {lab,send}=setup();const url=await lab.start();await lab.close();
  await assert.rejects(send(url));
});
test('separate child Node process performs real mTLS exchange',async()=>{
  const {lab,packet}=setup();const url=await lab.start();
  try {
    const path=fileURLToPath(new URL('./client-fixture.mjs',import.meta.url));
    const child=spawn(process.execPath,[path],{stdio:['pipe','pipe','pipe'],windowsHide:true});
    let output='',errorText='';
    child.stdout.on('data',b=>{output+=b.toString();});
    child.stderr.on('data',b=>{errorText+=b.toString();});
    child.stdin.end(JSON.stringify({url,keyPem:firstKey,certPem:firstCert,caPem:ca,packet}));
    const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('close',resolve);});
    assert.equal(code,0,errorText);
    const result=JSON.parse(output);
    assert.equal(result.status,200);
    assert.equal(result.body.transport,'tls13_mtls_loopback');
    assert.equal(result.body.externalActionAllowed,false);
  }finally{await lab.close();}
});
