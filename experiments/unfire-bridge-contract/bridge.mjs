/**
 * Unfire Bridge research Phase 0. Offline simulation only.
 * No networking, operating-system access, identity verification, or real execution.
 */
const PLATFORMS = new Set(['macos', 'windows', 'linux']);
const CAPABILITIES = new Set(['synthetic.send', 'synthetic.receive']);
const OPERATIONS = new Set(['synthetic.echo', 'synthetic.uppercase']);
const MAX_TTL_MS = 86_400_000;

function deny(code) {
  const error = new Error(code);
  error.code = code;
  throw error;
}
function shape(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) deny('INVALID_INPUT');
  const found = Object.keys(value);
  if (found.length !== keys.length || found.some(k => !keys.includes(k))) deny('INVALID_INPUT');
}
function id(value) {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,63}$/.test(value)) deny('INVALID_ID');
  return value;
}
function tick(value) {
  if (!Number.isSafeInteger(value) || value < 0) deny('INVALID_TIME');
  return value;
}
function consent(value) {
  if (value !== true) deny('CONSENT_REQUIRED');
}
const nodeKey = (tenant, nodeId) => `${tenant}:${nodeId}`;

export function createBridgeSimulator() {
  const nodes = new Map();
  const grants = new Map();
  const usedMessages = new Set();
  const stopped = new Set();

  function activeTenant(tenant) {
    id(tenant);
    if (stopped.has(tenant)) deny('TENANT_STOPPED');
  }
  function node(tenant, nodeId) {
    const found = nodes.get(nodeKey(id(tenant), id(nodeId)));
    if (!found) deny('NODE_NOT_FOUND');
    if (found.revoked) deny('NODE_REVOKED');
    return found;
  }
  function connected(tenant, nodeId) {
    const found = node(tenant, nodeId);
    if (!found.connected) deny('NODE_DISCONNECTED');
    return found;
  }
  function authorized(grantId, tenant, nodeId, capability, now) {
    const grant = grants.get(id(grantId));
    if (!grant || grant.revoked || grant.tenant !== tenant || grant.nodeId !== nodeId ||
        grant.capability !== capability || grant.expiresAt <= now) deny('GRANT_DENIED');
  }

  return Object.freeze({
    enrollNode(input) {
      shape(input, ['tenant', 'nodeId', 'platform', 'approved']);
      const { tenant, nodeId, platform, approved } = input;
      activeTenant(tenant); id(nodeId); consent(approved);
      if (!PLATFORMS.has(platform)) deny('UNSUPPORTED_PLATFORM');
      const key = nodeKey(tenant, nodeId);
      if (nodes.has(key)) deny('NODE_ALREADY_REGISTERED');
      nodes.set(key, { tenant, nodeId, platform, connected: false, revoked: false });
      return Object.freeze({ status: 'enrolled_offline', connected: false, externalActionAllowed: false });
    },
    connectNode(input) {
      shape(input, ['tenant', 'nodeId', 'approved']);
      const { tenant, nodeId, approved } = input;
      activeTenant(tenant); consent(approved);
      node(tenant, nodeId).connected = true;
      return Object.freeze({ status: 'connected_simulated', transport: 'none' });
    },
    disconnectNode(input) {
      shape(input, ['tenant', 'nodeId']);
      activeTenant(input.tenant);
      node(input.tenant, input.nodeId).connected = false;
      return Object.freeze({ status: 'disconnected' });
    },
    revokeNode(input) {
      shape(input, ['tenant', 'nodeId']);
      activeTenant(input.tenant);
      const current = node(input.tenant, input.nodeId);
      current.connected = false;
      current.revoked = true;
      return Object.freeze({ status: 'revoked' });
    },
    issueGrant(input) {
      shape(input, ['tenant', 'nodeId', 'grantId', 'capability', 'approved', 'now', 'expiresAt']);
      const { tenant, nodeId, grantId, capability, approved, now, expiresAt } = input;
      activeTenant(tenant); node(tenant, nodeId); id(grantId); consent(approved);
      tick(now); tick(expiresAt);
      if (!CAPABILITIES.has(capability)) deny('UNKNOWN_CAPABILITY');
      if (expiresAt <= now || expiresAt - now > MAX_TTL_MS) deny('INVALID_EXPIRY');
      if (grants.has(grantId)) deny('GRANT_ALREADY_EXISTS');
      grants.set(grantId, { tenant, nodeId, capability, expiresAt, revoked: false });
      return Object.freeze({ status: 'granted_simulated', externalActionAllowed: false });
    },
    revokeGrant(input) {
      shape(input, ['tenant', 'grantId']);
      activeTenant(input.tenant); id(input.grantId);
      const grant = grants.get(input.grantId);
      if (!grant || grant.tenant !== input.tenant) deny('GRANT_DENIED');
      grant.revoked = true;
      return Object.freeze({ status: 'grant_revoked' });
    },
    relay(input) {
      shape(input, ['tenant', 'messageId', 'fromNodeId', 'toNodeId', 'sendGrantId', 'receiveGrantId', 'operation', 'payload', 'now']);
      const { tenant, messageId, fromNodeId, toNodeId, sendGrantId, receiveGrantId, operation, payload, now } = input;
      activeTenant(tenant); id(messageId); tick(now);
      if (fromNodeId === toNodeId) deny('DISTINCT_NODES_REQUIRED');
      const source = connected(tenant, fromNodeId);
      const target = connected(tenant, toNodeId);
      if (!OPERATIONS.has(operation)) deny('UNKNOWN_OPERATION');
      if (typeof payload !== 'string' || new TextEncoder().encode(payload).length > 256) deny('INVALID_PAYLOAD');
      const messageKey = nodeKey(tenant, messageId);
      if (usedMessages.has(messageKey)) deny('MESSAGE_REPLAY');
      authorized(sendGrantId, tenant, source.nodeId, 'synthetic.send', now);
      authorized(receiveGrantId, tenant, target.nodeId, 'synthetic.receive', now);
      usedMessages.add(messageKey);
      const value = operation === 'synthetic.uppercase' ? payload.toUpperCase() : payload;
      return Object.freeze({ status: 'simulated', transport: 'none', externalActionAllowed: false,
        targetPlatform: target.platform, messageId, value });
    },
    stopTenant(input) {
      shape(input, ['tenant']);
      stopped.add(id(input.tenant));
      return Object.freeze({ status: 'stopped', externalActionAllowed: false });
    },
    snapshot(input) {
      shape(input, ['tenant']);
      const tenant = id(input.tenant);
      const current = [...nodes.values()].filter(n => n.tenant === tenant)
        .map(({nodeId, platform, connected, revoked}) => ({nodeId, platform, connected, revoked}));
      return structuredClone({ tenant, stopped: stopped.has(tenant), nodes: current,
        simulatedMessages: [...usedMessages].filter(k => k.startsWith(`${tenant}:`)).length });
    },
  });
}
