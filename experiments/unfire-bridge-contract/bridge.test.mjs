import test from 'node:test';
import assert from 'node:assert/strict';
import { createBridgeSimulator } from './bridge.mjs';

const assertCode = (fn, code) => assert.throws(fn, error => error.code === code);
function demo() {
  const bridge = createBridgeSimulator();
  for (const [nodeId, platform] of [['mac', 'macos'], ['win', 'windows'], ['lin', 'linux']]) {
    bridge.enrollNode({ tenant: 'lab', nodeId, platform, approved: true });
    bridge.connectNode({ tenant: 'lab', nodeId, approved: true });
  }
  bridge.issueGrant({ tenant: 'lab', nodeId: 'mac', grantId: 'send', capability: 'synthetic.send', approved: true, now: 100, expiresAt: 200 });
  bridge.issueGrant({ tenant: 'lab', nodeId: 'lin', grantId: 'receive', capability: 'synthetic.receive', approved: true, now: 100, expiresAt: 200 });
  const transfer = { tenant: 'lab', messageId: 'm1', fromNodeId: 'mac', toNodeId: 'lin', sendGrantId: 'send', receiveGrantId: 'receive', operation: 'synthetic.uppercase', payload: 'research', now: 110 };
  return { bridge, transfer };
}

test('empty by default, no auto-connected nodes', () => { assert.deepEqual(createBridgeSimulator().snapshot({ tenant: 'lab' }).nodes, []); });
test('enrollment does not connect automatically', () => {
  const b = createBridgeSimulator();
  assert.equal(b.enrollNode({ tenant: 'lab', nodeId: 'mac', platform: 'macos', approved: true }).connected, false);
  assert.equal(b.snapshot({ tenant: 'lab' }).nodes[0].connected, false);
});
test('explicit approval required for enrollment', () => assertCode(() => createBridgeSimulator().enrollNode({tenant:'lab',nodeId:'x',platform:'linux',approved:false}), 'CONSENT_REQUIRED'));
test('explicit approval required for simulated connection', () => { const b=demo().bridge; assertCode(() => b.connectNode({tenant:'lab',nodeId:'win',approved:false}), 'CONSENT_REQUIRED'); });
test('all three platform labels are supported', () => assert.deepEqual(demo().bridge.snapshot({ tenant:'lab' }).nodes.map(n=>n.platform), ['macos','windows','linux']));
test('unsupported platform rejected', () => assertCode(() => createBridgeSimulator().enrollNode({tenant:'lab',nodeId:'x',platform:'ios',approved:true}), 'UNSUPPORTED_PLATFORM'));
test('invalid node ID rejected', () => assertCode(() => createBridgeSimulator().enrollNode({tenant:'lab',nodeId:'../x',platform:'linux',approved:true}), 'INVALID_ID'));
test('unknown enrollment fields rejected', () => assertCode(() => createBridgeSimulator().enrollNode({tenant:'lab',nodeId:'x',platform:'linux',approved:true,extra:'remote'}), 'INVALID_INPUT'));
test('duplicate enrollment rejected', () => {const b=demo().bridge; assertCode(()=>b.enrollNode({tenant:'lab',nodeId:'mac',platform:'macos',approved:true}), 'NODE_ALREADY_REGISTERED');});
test('allows synthetic macOS to Linux transfer with metadata', () => { const {bridge,transfer}=demo(); assert.deepEqual(bridge.relay(transfer), {status:'simulated',transport:'none',externalActionAllowed:false,targetPlatform:'linux',messageId:'m1',value:'RESEARCH'}); });
test('echo is deterministic and not external execution', () => {const {bridge,transfer}=demo();assert.equal(bridge.relay({...transfer,operation:'synthetic.echo'}).value,'research');});
test('replay is rejected after accepted message', () => {const {bridge,transfer}=demo(); bridge.relay(transfer); assertCode(()=>bridge.relay(transfer),'MESSAGE_REPLAY');});
test('failed authorization does not consume message ID', () => {const {bridge,transfer}=demo(); assertCode(()=>bridge.relay({...transfer,sendGrantId:'bad'}),'GRANT_DENIED');assert.equal(bridge.relay(transfer).value,'RESEARCH');});
test('cross-tenant node cannot receive', () => {const {bridge,transfer}=demo();bridge.enrollNode({tenant:'other',nodeId:'remote',platform:'windows',approved:true});bridge.connectNode({tenant:'other',nodeId:'remote',approved:true});assertCode(()=>bridge.relay({...transfer,toNodeId:'remote'}),'NODE_NOT_FOUND');});
test('cross-tenant grant cannot be reused', () => {const {bridge,transfer}=demo();bridge.enrollNode({tenant:'other',nodeId:'mac',platform:'macos',approved:true});bridge.issueGrant({tenant:'other',nodeId:'mac',grantId:'foreign',capability:'synthetic.send',approved:true,now:100,expiresAt:200});assertCode(()=>bridge.relay({...transfer,sendGrantId:'foreign'}),'GRANT_DENIED');});
test('send grant is not a receive grant', () => {const {bridge,transfer}=demo();assertCode(()=>bridge.relay({...transfer,receiveGrantId:'send'}),'GRANT_DENIED');});
test('unknown capability is default denied', () => {const {bridge}=demo();assertCode(()=>bridge.issueGrant({tenant:'lab',nodeId:'mac',grantId:'bad',capability:'shell.execute',approved:true,now:100,expiresAt:200}),'UNKNOWN_CAPABILITY');});
test('unknown operation is default denied', () => {const {bridge,transfer}=demo();assertCode(()=>bridge.relay({...transfer,operation:'shell.execute'}),'UNKNOWN_OPERATION');});
test('payload byte cap rejects large and Unicode oversized payloads', () => {const {bridge,transfer}=demo();assertCode(()=>bridge.relay({...transfer,payload:'🙂'.repeat(65)}),'INVALID_PAYLOAD');});
test('expired grant rejected on boundary', () => {const {bridge,transfer}=demo();assertCode(()=>bridge.relay({...transfer,now:200}),'GRANT_DENIED');});
test('grant expiry has a bound', () => {const {bridge}=demo();assertCode(()=>bridge.issueGrant({tenant:'lab',nodeId:'mac',grantId:'long',capability:'synthetic.send',approved:true,now:100,expiresAt:100+86400001}),'INVALID_EXPIRY');});
test('invalid simulated clock rejected', () => {const {bridge,transfer}=demo();assertCode(()=>bridge.relay({...transfer,now:NaN}),'INVALID_TIME');});
test('disconnection stops relay', () => {const {bridge,transfer}=demo();bridge.disconnectNode({tenant:'lab',nodeId:'lin'});assertCode(()=>bridge.relay(transfer),'NODE_DISCONNECTED');});
test('reconnecting is explicit', () => {const {bridge,transfer}=demo();bridge.disconnectNode({tenant:'lab',nodeId:'lin'});bridge.connectNode({tenant:'lab',nodeId:'lin',approved:true});assert.equal(bridge.relay(transfer).value,'RESEARCH');});
test('grant revocation stops relay', () => {const {bridge,transfer}=demo();bridge.revokeGrant({tenant:'lab',grantId:'send'});assertCode(()=>bridge.relay(transfer),'GRANT_DENIED');});
test('cross-tenant grant revoke rejected', () => {const {bridge}=demo();assertCode(()=>bridge.revokeGrant({tenant:'other',grantId:'send'}),'GRANT_DENIED');});
test('node revocation cannot reconnect', () => {const {bridge,transfer}=demo();bridge.revokeNode({tenant:'lab',nodeId:'lin'});assertCode(()=>bridge.relay(transfer),'NODE_REVOKED');assertCode(()=>bridge.connectNode({tenant:'lab',nodeId:'lin',approved:true}),'NODE_REVOKED');});
test('STOP blocks existing and future relays and reconnects', () => {const {bridge,transfer}=demo();bridge.stopTenant({tenant:'lab'});assertCode(()=>bridge.relay(transfer),'TENANT_STOPPED');assertCode(()=>bridge.connectNode({tenant:'lab',nodeId:'lin',approved:true}),'TENANT_STOPPED');});
test('STOP persists across simulated snapshot reads', () => {const {bridge}=demo();bridge.stopTenant({tenant:'lab'});assert.equal(bridge.snapshot({tenant:'lab'}).stopped,true);});
test('stopping one tenant does not block unrelated tenant', () => {const {bridge}=demo();bridge.stopTenant({tenant:'lab'});assert.equal(bridge.enrollNode({tenant:'other',nodeId:'another',platform:'linux',approved:true}).connected,false);});
test('different source and target required', () => {const {bridge,transfer}=demo();assertCode(()=>bridge.relay({...transfer,toNodeId:'mac'}),'DISTINCT_NODES_REQUIRED');});
test('snapshot reports only metadata, not synthetic payloads', () => {const {bridge,transfer}=demo();bridge.relay(transfer);const s=bridge.snapshot({tenant:'lab'});assert.equal(s.simulatedMessages,1);assert.equal(JSON.stringify(s).includes('research'),false);});
test('duplicate grant IDs rejected', () => {const {bridge}=demo();assertCode(()=>bridge.issueGrant({tenant:'lab',nodeId:'mac',grantId:'send',capability:'synthetic.send',approved:true,now:100,expiresAt:200}),'GRANT_ALREADY_EXISTS');});
