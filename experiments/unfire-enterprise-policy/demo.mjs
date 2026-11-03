import {evaluateSimulation} from './policy.mjs';

const example = {
  policy: {
    schema:'unfire.enterprise.policy.v0', tenantId:'sample_org', revision:1,
    mode:'ACTIVE', allowedOperations:['transform.uppercase'],
    allowedResources:['synthetic:documents'], maxUnitsPerRequest:3, maxUnitsPerTenant:10
  },
  request: {
    tenantId:'sample_org', principalId:'sample_user', requestId:'demo_00000001',
    operation:'transform.uppercase', resource:'synthetic:documents',
    units:1, policyRevision:1
  },
  grant: {
    tenantId:'sample_org', principalId:'sample_user', requestId:'demo_00000001',
    operation:'transform.uppercase', resource:'synthetic:documents',
    policyRevision:1, approvedForSimulation:true, notBefore:1000, expiresAt:2000
  },
  snapshot: {
    tenantId:'sample_org', policyRevision:1, stopped:false, usedUnits:0,
    revokedRequestIds:[], consumedRequestIds:[]
  },
  now:1500
};
const print = (name, input) => {
  const result = evaluateSimulation(input);
  console.log(JSON.stringify({case:name, ...result}));
};
print('synthetic_eligible_only',example);
const stopped = structuredClone(example);
stopped.snapshot.stopped = true;
print('synthetic_stop',stopped);
const otherTenant = structuredClone(example);
otherTenant.request.tenantId = 'other_org';
print('synthetic_cross_tenant',otherTenant);
