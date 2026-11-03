import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateSimulation, validatePolicy, validateRequest, validateGrant, validateSnapshot} from './policy.mjs';

const fixture = () => ({
  policy: {schema:'unfire.enterprise.policy.v0',tenantId:'alpha_org',revision:3,mode:'ACTIVE',allowedOperations:['transform.uppercase','aggregate.sum'],allowedResources:['synthetic:docs','synthetic:analytics'],maxUnitsPerRequest:10,maxUnitsPerTenant:100},
  request: {tenantId:'alpha_org',principalId:'alice_dev',requestId:'job_0000001',operation:'transform.uppercase',resource:'synthetic:docs',units:3,policyRevision:3},
  grant: {tenantId:'alpha_org',principalId:'alice_dev',requestId:'job_0000001',operation:'transform.uppercase',resource:'synthetic:docs',policyRevision:3,approvedForSimulation:true,notBefore:1000,expiresAt:2000},
  snapshot: {tenantId:'alpha_org',policyRevision:3,stopped:false,usedUnits:0,revokedRequestIds:[],consumedRequestIds:[]},
  now:1500
});
const decision = update => {
  const args=fixture();
  update?.(args);
  return evaluateSimulation(args);
};
const refuses = (label, mutate, reason) => test(label, () => {
  const r=decision(mutate);
  assert.equal(r.eligible,false);
  assert.equal(r.decision,'DENY');
  assert.equal(r.externalActionAllowed,false);
  if(reason) assert.equal(r.reason,reason);
});

test('valid synthetic fixture is only eligible, never externally authorised', () => {
  const r=decision();
  assert.equal(r.eligible,true);
  assert.equal(r.decision,'ELIGIBLE_FOR_SYNTHETIC_SIMULATION_ONLY');
  assert.equal(r.externalActionAllowed,false);
  for(const field of ['authenticatedIdentityProven','tenantIsolationProven','approvalSignatureVerified','atomicReplayProtectionProven']) assert.equal(r[field],false);
});
test('all fixture schema validators pass', () => {
  const f=fixture();
  assert.equal(validatePolicy(f.policy),true);
  assert.equal(validateRequest(f.request),true);
  assert.equal(validateGrant(f.grant),true);
  assert.equal(validateSnapshot(f.snapshot),true);
});
refuses('foreign request tenant', a=>a.request.tenantId='beta_org','TENANT_MISMATCH');
refuses('foreign grant tenant', a=>a.grant.tenantId='beta_org','TENANT_MISMATCH');
refuses('foreign snapshot tenant', a=>a.snapshot.tenantId='beta_org','TENANT_MISMATCH');
refuses('STOP state from policy', a=>a.policy.mode='STOPPED','STOPPED');
refuses('STOP state from snapshot', a=>a.snapshot.stopped=true,'STOPPED');
refuses('stale request revision', a=>a.request.policyRevision=2,'STALE_POLICY');
refuses('stale grant revision', a=>a.grant.policyRevision=2,'STALE_POLICY');
refuses('stale snapshot revision', a=>a.snapshot.policyRevision=2,'STALE_POLICY');
refuses('operation not allowlisted', a=>a.request.operation='text.count','OUT_OF_SCOPE');
refuses('resource not allowlisted', a=>a.request.resource='synthetic:secret','OUT_OF_SCOPE');
refuses('mismatched grant principal', a=>a.grant.principalId='bob_admin','GRANT_MISMATCH');
refuses('mismatched grant resource', a=>a.grant.resource='synthetic:analytics','GRANT_MISMATCH');
refuses('mismatched grant operation', a=>a.grant.operation='aggregate.sum','GRANT_MISMATCH');
refuses('mismatched request id', a=>a.grant.requestId='job_0000002','GRANT_MISMATCH');
refuses('no synthetic grant approval', a=>a.grant.approvedForSimulation=false,'GRANT_MISMATCH');
refuses('before grant window', a=>a.now=999,'GRANT_EXPIRED_OR_NOT_YET_VALID');
refuses('exact expiry is refused', a=>a.now=2000,'GRANT_EXPIRED_OR_NOT_YET_VALID');
refuses('revoked simulated request', a=>a.snapshot.revokedRequestIds=['job_0000001'],'REVOKED');
refuses('replayed simulated request', a=>a.snapshot.consumedRequestIds=['job_0000001'],'REPLAY');
refuses('too many units per request', a=>a.request.units=11,'BUDGET_EXCEEDED');
refuses('exhausted tenant budget', a=>a.snapshot.usedUnits=98,'BUDGET_EXCEEDED');
refuses('numeric overrun cannot overflow budget check', a=>{a.policy.maxUnitsPerTenant=Number.MAX_SAFE_INTEGER;a.snapshot.usedUnits=Number.MAX_SAFE_INTEGER;a.request.units=3;},'BUDGET_EXCEEDED');
refuses('grant longer than maximum 5 minutes', a=>a.grant.expiresAt=302000,'MALFORMED_INPUT');
refuses('unknown operation rejects fixture', a=>a.request.operation='shell.exec','MALFORMED_INPUT');
refuses('unexpected request fields reject fixture', a=>a.request.secret='accidental','MALFORMED_INPUT');
refuses('duplicate resource policy rejects fixture', a=>a.policy.allowedResources.push('synthetic:docs'),'MALFORMED_INPUT');
refuses('negative budget input rejects fixture', a=>a.snapshot.usedUnits=-1,'MALFORMED_INPUT');
refuses('noninteger clock rejects fixture', a=>a.now=NaN,'MALFORMED_INPUT');
refuses('missing grant rejects fixture', a=>delete a.grant,'MALFORMED_INPUT');
refuses('root object prototype invalid', a=>Object.setPrototypeOf(a, new Date()),'MALFORMED_INPUT');
refuses('global prototype injection-like extra key fails closed', a=>a.request.__proto__={unsafe:true},'MALFORMED_INPUT');
refuses('simulated approval must be boolean', a=>a.grant.approvedForSimulation='true','MALFORMED_INPUT');
refuses('unsafely large manifest is denied', a=>a.snapshot.consumedRequestIds=Array.from({length:129},(_,i)=>'job_'+String(i).padStart(8,'0')),'MALFORMED_INPUT');
test('does not mutate caller objects, issue access tokens or perform effects', () => {
  const f=fixture();
  const before=JSON.stringify(f);
  const result=evaluateSimulation(f);
  assert.equal(JSON.stringify(f),before);
  assert.deepEqual(Object.keys(result).sort(),['approvalSignatureVerified','atomicReplayProtectionProven','authenticatedIdentityProven','decision','eligible','externalActionAllowed','reason','tenantIsolationProven'].sort());
});
test('fuzzed untrusted root shapes never throw and never authorize external action', () => {
  for(const input of [null,undefined,false,0,'x',[],new Date(),Object.create(null),{policy:null},{...fixture(),now:BigInt(1)}]){
    const r=evaluateSimulation(input);
    assert.equal(r.externalActionAllowed,false);
    assert.equal(r.eligible,false);
  }
});
