import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRingTopology, measureRing } from './ring-experiment.mjs';
import { buildTopology, ROOT, syntheticMessages } from './model.mjs';
import { buildLeaderTopology, simulateLeaderTraffic, leaderFailureMatrix, leaderCapacityMatrix, LEADER_DESIGNS } from './leader-redundancy.mjs';

const messages=syntheticMessages({count:2400,locality:0.85,seed:20261030});

test('all designs have expected links and reciprocal adjacency',()=>{
  assert.deepEqual(LEADER_DESIGNS.map(n=>buildLeaderTopology(n).links),[28,44,48,52,300]);
  for(const name of LEADER_DESIGNS){
    const graph=buildLeaderTopology(name);
    assert.equal(graph.adjacency.length,25);
    for(let a=0;a<25;a++)for(const b of graph.adjacency[a]) assert.ok(graph.adjacency[b].includes(a));
  }
});
test('leader-ring matches existing graph with no failures or quotas',()=>{
  const a=simulateLeaderTraffic('leader-ring',messages);
  const b=buildRingTopology('hierarchy');
  assert.equal(a.links,b.links);
  assert.equal(a.delivered,2400);
  assert.equal(a.averageHops,measureRing(b,messages).averageHops);
  assert.equal(a.coordinatorRelays,measureRing(b,messages).rootRelays);
});
test('additional cross-team links are tracked as an explicit exposure proxy',()=>{
  assert.deepEqual(LEADER_DESIGNS.map(n=>buildLeaderTopology(n).crossTeamWorkerLinks),[4,4,8,12,216]);
});
test('local backup improves intra-team reachability after primary leader failure',()=>{
  const a=simulateLeaderTraffic('leader-ring',messages,{removed:[0]});
  const b=simulateLeaderTraffic('backup-local',messages,{removed:[0]});
  assert.ok(b.delivered>a.delivered);
  assert.ok(b.partitioned<a.partitioned);
});
test('backup-local still partitions team members away from other groups',()=>{
  const x=simulateLeaderTraffic('backup-local',messages,{removed:[0]});
  assert.ok(x.partitioned>0);
});
test('backup-forward maintains global reachability after one primary leader fails',()=>{
  for(const leader of [0,6,12,18]){
    const x=simulateLeaderTraffic('backup-forward',messages,{removed:[leader]});
    assert.equal(x.delivered,x.eligible);
    assert.equal(x.partitioned,0);
  }
});
test('backup-forward survives coordinator and one leader removal',()=>{
  for(const leader of [0,6,12,18]){
    const x=simulateLeaderTraffic('backup-forward',messages,{removed:[ROOT,leader]});
    assert.equal(x.delivered,x.eligible);
  }
});
test('dual bridge survives two neighboring primary leader losses in this model',()=>{
  for(const pair of [[0,6],[6,12],[12,18],[0,18]]){
    const x=simulateLeaderTraffic('backup-dual',messages,{removed:pair});
    assert.equal(x.delivered,x.eligible);
  }
});
test('no backup provides complete survival of a leader+backup loss',()=>{
  for(const name of ['backup-local','backup-forward','backup-dual']){
    const x=simulateLeaderTraffic(name,messages,{removed:[0,1]});
    assert.ok(x.partitioned>0);
  }
});
test('all 300 pairs enumerated per design; average and minimum within bounds',()=>{
  const results=leaderFailureMatrix({count:180});
  for(const r of results){
    assert.equal(r.pairs,300);
    assert.ok(r.worstDeliveryRate>=0&&r.worstDeliveryRate<=1);
    assert.ok(r.averageDeliveryRate>=r.worstDeliveryRate&&r.averageDeliveryRate<=1);
  }
});
test('capacity is a hard per-link quota and delivery accounts for each message',()=>{
  for(const name of LEADER_DESIGNS)for(const quota of [24,96,256]){
    const x=simulateLeaderTraffic(name,messages,{quota});
    assert.ok(x.maxLinkUsage<=quota);
    assert.equal(x.delivered+x.endpointsLost+x.partitioned+x.capacityBlocked,messages.length);
  }
});
test('unlimited capacity delivers every message when no nodes fail',()=>{
  for(const row of leaderCapacityMatrix()){
    assert.equal(row.scenarios[3].delivered,2400);
    assert.ok(row.scenarios[0].delivered<=2400);
  }
});
test('results must not claim actual platform performance or safety',()=>{
  assert.match(simulateLeaderTraffic('backup-dual',messages).disclaimer,/not measured speed, security, availability/);
});
test('invalid inputs fail closed',()=>{
  assert.throws(()=>buildLeaderTopology('auto-consciousness'),/Unknown leader design/);
  assert.throws(()=>simulateLeaderTraffic('backup-dual',messages,{removed:[0,0]}),/Invalid failure/);
  assert.throws(()=>simulateLeaderTraffic('backup-dual',messages,{removed:[0,1,2]}),/Invalid failure/);
  assert.throws(()=>simulateLeaderTraffic('backup-dual',messages,{quota:0}),/Invalid capacity/);
  assert.throws(()=>simulateLeaderTraffic('backup-dual',[{from:-1,to:2}]),/Invalid synthetic/);
});
test('different localities and seeds never claim perfect worst-case availability',()=>{
  for(const locality of [0,0.5,0.85,1]) {
    for(const seed of [1,42,20261030]){
      const r=leaderFailureMatrix({count:120,locality,seed});
      assert.ok(r.every(x=>x.worstDeliveryRate<1));
      assert.ok(r.every(x=>x.pairs===300));
    }
  }
});
test('seeded experiment is reproducible',()=>{
  assert.deepEqual(leaderCapacityMatrix({count:120,seed:5,quotas:[3,null]}),leaderCapacityMatrix({count:120,seed:5,quotas:[3,null]}));
});
