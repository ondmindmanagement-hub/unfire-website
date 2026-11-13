/**
 * Unfire Enterprise Policy Lab v0.1
 * Pure, synthetic-only eligibility checks. NOT authentication or an OS sandbox.
 * No I/O, processes, network calls, AI calls or actual task execution.
 */
const SCHEMA = 'unfire.enterprise.policy.v0';
const OPS = new Set(['transform.uppercase', 'aggregate.sum', 'text.count']);
const IDENTIFIER = /^[a-z][a-z0-9_-]{2,39}$/;
const REQUEST_ID = /^[a-zA-Z0-9_-]{8,80}$/;
const RESOURCE = /^synthetic:[a-z][a-z0-9_-]{0,39}$/;
const MAX_LIST = 128;

const own = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const record = (obj, keys) => {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
  const proto = Object.getPrototypeOf(obj);
  if (proto !== Object.prototype && proto !== null) return false;
  const present = Object.keys(obj);
  return present.length === keys.length && keys.every(k => own(obj, k)) && present.every(k => keys.includes(k));
};
const str = (value, pattern) => typeof value === 'string' && pattern.test(value);
const uniqueList = (xs, validate) => Array.isArray(xs) && xs.length <= MAX_LIST && xs.every(validate) && new Set(xs).size === xs.length;
const int = n => Number.isSafeInteger(n) && n >= 0;

export function validatePolicy(policy) {
  return record(policy, ['schema', 'tenantId', 'revision', 'mode', 'allowedOperations', 'allowedResources', 'maxUnitsPerRequest', 'maxUnitsPerTenant']) &&
    policy.schema === SCHEMA && str(policy.tenantId, IDENTIFIER) && int(policy.revision) && policy.revision > 0 &&
    (policy.mode === 'ACTIVE' || policy.mode === 'STOPPED') &&
    uniqueList(policy.allowedOperations, v => typeof v === 'string' && OPS.has(v)) &&
    uniqueList(policy.allowedResources, v => str(v, RESOURCE)) &&
    int(policy.maxUnitsPerRequest) && policy.maxUnitsPerRequest > 0 &&
    int(policy.maxUnitsPerTenant) && policy.maxUnitsPerTenant >= policy.maxUnitsPerRequest;
}

export function validateRequest(request) {
  return record(request, ['tenantId', 'principalId', 'requestId', 'operation', 'resource', 'units', 'policyRevision']) &&
    str(request.tenantId, IDENTIFIER) && str(request.principalId, IDENTIFIER) &&
    str(request.requestId, REQUEST_ID) && OPS.has(request.operation) &&
    str(request.resource, RESOURCE) && int(request.units) && request.units > 0 &&
    int(request.policyRevision) && request.policyRevision > 0;
}

export function validateGrant(grant) {
  return record(grant, ['tenantId', 'principalId', 'requestId', 'operation', 'resource', 'policyRevision', 'approvedForSimulation', 'notBefore', 'expiresAt']) &&
    str(grant.tenantId, IDENTIFIER) && str(grant.principalId, IDENTIFIER) &&
    str(grant.requestId, REQUEST_ID) && OPS.has(grant.operation) &&
    str(grant.resource, RESOURCE) && int(grant.policyRevision) && grant.policyRevision > 0 &&
    typeof grant.approvedForSimulation === 'boolean' && int(grant.notBefore) &&
    int(grant.expiresAt) && grant.expiresAt > grant.notBefore &&
    grant.expiresAt - grant.notBefore <= 300_000; // bounded synthetic grant, milliseconds
}

export function validateSnapshot(snapshot) {
  return record(snapshot, ['tenantId', 'policyRevision', 'stopped', 'usedUnits', 'revokedRequestIds', 'consumedRequestIds']) &&
    str(snapshot.tenantId, IDENTIFIER) && int(snapshot.policyRevision) && snapshot.policyRevision > 0 &&
    typeof snapshot.stopped === 'boolean' && int(snapshot.usedUnits) &&
    uniqueList(snapshot.revokedRequestIds, v => str(v, REQUEST_ID)) &&
    uniqueList(snapshot.consumedRequestIds, v => str(v, REQUEST_ID));
}

/**
 * Fail-closed decision. "eligible" is ONLY eligibility for a synthetic fixture.
 * The snapshot/grant are caller-supplied and UNTRUSTED, not evidence of identity
 * or durable authorization; caller must never forward these to real adapters.
 *
 * @param {{policy: object, request: object, grant: object, snapshot: object, now: number}} args
 */
export function evaluateSimulation(args) {
  const base = {
    eligible: false,
    decision: 'DENY',
    reason: 'MALFORMED_INPUT',
    externalActionAllowed: false,
    authenticatedIdentityProven: false,
    tenantIsolationProven: false,
    approvalSignatureVerified: false,
    atomicReplayProtectionProven: false
  };
  if (!record(args, ['policy', 'request', 'grant', 'snapshot', 'now']) ||
    !validatePolicy(args.policy) || !validateRequest(args.request) ||
    !validateGrant(args.grant) || !validateSnapshot(args.snapshot) ||
    !int(args.now)) return base;
  const { policy: p, request: r, grant: g, snapshot: s, now } = args;
  const deny = reason => ({...base, reason});
  if (p.mode !== 'ACTIVE' || s.stopped) return deny('STOPPED');
  if (p.tenantId !== r.tenantId || p.tenantId !== g.tenantId || p.tenantId !== s.tenantId) return deny('TENANT_MISMATCH');
  if (p.revision !== r.policyRevision || p.revision !== g.policyRevision || p.revision !== s.policyRevision) return deny('STALE_POLICY');
  if (!p.allowedOperations.includes(r.operation) || !p.allowedResources.includes(r.resource)) return deny('OUT_OF_SCOPE');
  if (!g.approvedForSimulation || g.principalId !== r.principalId || g.requestId !== r.requestId ||
      g.operation !== r.operation || g.resource !== r.resource) return deny('GRANT_MISMATCH');
  if (now < g.notBefore || now >= g.expiresAt) return deny('GRANT_EXPIRED_OR_NOT_YET_VALID');
  if (s.revokedRequestIds.includes(r.requestId)) return deny('REVOKED');
  if (s.consumedRequestIds.includes(r.requestId)) return deny('REPLAY');
  if (r.units > p.maxUnitsPerRequest || s.usedUnits > p.maxUnitsPerTenant - r.units) return deny('BUDGET_EXCEEDED');
  return {
    ...base,
    eligible: true,
    decision: 'ELIGIBLE_FOR_SYNTHETIC_SIMULATION_ONLY',
    reason: 'SIMULATION_POLICY_MATCH',
    // No mutable state or token is issued. External I/O remains forbidden.
  };
}
