/**
 * Unfire Atlas | Leader redundancy (offline graph experiment).
 * No real agents, network, OS actions, credentials or production effects.
 */
import { buildTopology, syntheticMessages, ROOT, WORKER_COUNT } from './model.mjs';
import { buildRingTopology } from './ring-experiment.mjs';

const NODES = WORKER_COUNT + 1;
const TEAM_SIZE = 6;
const GROUPS = WORKER_COUNT / TEAM_SIZE;
const LEADERS = Object.freeze([0, 6, 12, 18]);
export const LEADER_DESIGNS = Object.freeze([
  'leader-ring', 'backup-local', 'backup-forward', 'backup-dual', 'full-mesh'
]);
function add(graph, a, b) {
  if (a === b || a < 0 || b < 0 || a >= NODES || b >= NODES) throw new Error('Invalid edge');
  graph[a].add(b);
  graph[b].add(a);
}
function crossTeamLinks(adjacency) {
  let count = 0;
  for (let a = 0; a < WORKER_COUNT; a++) {
    for (const b of adjacency[a]) {
      if (b > a && b < WORKER_COUNT && Math.floor(a / TEAM_SIZE) !== Math.floor(b / TEAM_SIZE)) count++;
    }
  }
  return count;
}
function graphOf(name, edges) {
  const adjacency = Object.freeze(edges.map(v => Object.freeze([...v].sort((a,b) => a-b))));
  return Object.freeze({
    name, adjacency, workers: WORKER_COUNT, root: ROOT,
    links: adjacency.reduce((sum,row)=>sum+row.length,0)/2,
    crossTeamWorkerLinks: crossTeamLinks(adjacency)
  });
}
export function buildLeaderTopology(name) {
  if (!LEADER_DESIGNS.includes(name)) throw new TypeError('Unknown leader design');
  if (name === 'full-mesh') {
    const full = buildTopology('mesh');
    return Object.freeze({ ...full, name, crossTeamWorkerLinks: crossTeamLinks(full.adjacency) });
  }
  const source = buildRingTopology('hierarchy');
  if (name === 'leader-ring') return Object.freeze({ ...source, name, crossTeamWorkerLinks: crossTeamLinks(source.adjacency) });
  const graph = source.adjacency.map(row => new Set(row));
  for (let team = 0; team < GROUPS; team++) {
    const leader = LEADERS[team];
    const backup = leader + 1;
    // The secondary contact can reach every other surviving team member.
    for (let offset = 2; offset < TEAM_SIZE; offset++) add(graph, backup, leader + offset);
    if (name === 'backup-forward' || name === 'backup-dual') {
      add(graph, backup, LEADERS[(team+1)%GROUPS]);
    }
    if (name === 'backup-dual') {
      add(graph, backup, LEADERS[(team+GROUPS-1)%GROUPS]);
    }
  }
  return graphOf(name,graph);
}
function checkRemoved(removed) {
  if (!Array.isArray(removed) || removed.length > 2 ||
    removed.some(v => !Number.isInteger(v) || v < 0 || v >= NODES) ||
    new Set(removed).size !== removed.length) throw new TypeError('Invalid failure vertices');
  return new Set(removed);
}
function key(a,b) { return Math.min(a,b)+':'+Math.max(a,b); }
function validateQuota(quota) {
  if (quota!==null && (!Number.isSafeInteger(quota) || quota<1 || quota>1000000)) {
    throw new TypeError('Invalid capacity quota');
  }
}
function path(graph, from, to, failed, used, quota) {
  const parent = new Map([[from, null]]);
  const queue = [from];
  for (let i=0; i<queue.length; i++) {
    const u=queue[i];
    for (const v of graph.adjacency[u]) {
      if (failed.has(v) || parent.has(v) || (quota!==null && (used.get(key(u,v))??0)>=quota)) continue;
      parent.set(v,u);
      if (v===to) {
        const nodes=[to];
        for (let n=u; n!==null; n=parent.get(n)) nodes.push(n);
        return nodes.reverse();
      }
      queue.push(v);
    }
  }
  return null;
}
export function simulateLeaderTraffic(name, messages, { removed=[], quota=null } = {}) {
  const graph=buildLeaderTopology(name);
  const failed=checkRemoved(removed);
  validateQuota(quota);
  if (!Array.isArray(messages) || messages.length>20000) throw new TypeError('Invalid messages');
  const used=new Map(), forwards=Array(NODES).fill(0), groupSent=Array(GROUPS).fill(0), groupDelivered=Array(GROUPS).fill(0);
  let delivered=0, eligible=0, endpointsLost=0, partitioned=0, capacityBlocked=0, hops=0;
  for (const m of messages) {
    if (!m || !Number.isInteger(m.from) || !Number.isInteger(m.to) ||
        m.from<0 || m.to<0 || m.from>=WORKER_COUNT || m.to>=WORKER_COUNT || m.from===m.to) {
      throw new TypeError('Invalid synthetic message');
    }
    if (failed.has(m.from) || failed.has(m.to)) { endpointsLost++; continue; }
    eligible++;
    const group=Math.floor(m.from/TEAM_SIZE);groupSent[group]++;
    const found=path(graph,m.from,m.to,failed,used,quota);
    if (!found) {
      if (path(graph,m.from,m.to,failed,new Map(),null)) capacityBlocked++;
      else partitioned++;
      continue;
    }
    delivered++;groupDelivered[group]++;hops+=found.length-1;
    for(let i=0;i<found.length-1;i++) {
      const edge=key(found[i],found[i+1]);used.set(edge,(used.get(edge)??0)+1);
    }
    for(const via of found.slice(1,-1))forwards[via]++;
  }
  if (delivered+endpointsLost+partitioned+capacityBlocked!==messages.length) {
    throw new Error('Delivery conservation violated');
  }
  const eligibleGroupRates=groupSent.map((n,g)=>n?groupDelivered[g]/n:null).filter(v=>v!==null);
  return Object.freeze({
    topology:name, links:graph.links, crossTeamWorkerLinks:graph.crossTeamWorkerLinks, messages:messages.length, quota,
    removed:Object.freeze([...failed].sort((a,b)=>a-b)), delivered, eligible, endpointsLost, partitioned, capacityBlocked,
    deliveryRate:messages.length?delivered/messages.length:null,
    eligibleDeliveryRate:eligible?delivered/eligible:null,
    minEligibleSenderGroupRate:eligibleGroupRates.length?Math.min(...eligibleGroupRates):null,
    averageHops:delivered?hops/delivered:null,
    peakRelays:Math.max(...forwards), coordinatorRelays:forwards[ROOT],
    usedLinks:used.size, maxLinkUsage:used.size?Math.max(...used.values()):0,
    disclaimer:'Synthetic deterministic graph routing only; not measured speed, security, availability, AI quality or production resilience.'
  });
}
export function leaderFailureMatrix({count=180,locality=0.85,seed=20261030}={}) {
  const messages=syntheticMessages({count,locality,seed});
  const pairs=[];
  for(let a=0;a<NODES;a++)for(let b=a+1;b<NODES;b++)pairs.push([a,b]);
  return LEADER_DESIGNS.map(name=>{
    let sum=0,min=Infinity,worst=[],sumEligible=0;
    for(const pair of pairs){
      const x=simulateLeaderTraffic(name,messages,{removed:pair});
      sum+=x.deliveryRate;sumEligible+=x.eligibleDeliveryRate??0;
      if(x.deliveryRate<min-1e-12){min=x.deliveryRate;worst=[pair];}
      else if(Math.abs(x.deliveryRate-min)<=1e-12)worst.push(pair);
    }
    const built = buildLeaderTopology(name);
    return Object.freeze({topology:name,links:built.links,crossTeamWorkerLinks:built.crossTeamWorkerLinks,pairs:pairs.length,
      averageDeliveryRate:sum/pairs.length,averageEligibleDeliveryRate:sumEligible/pairs.length,
      worstDeliveryRate:min,worstPairSamples:Object.freeze(worst.slice(0,4).map(v=>Object.freeze([...v]))),worstPairCount:worst.length});
  });
}
export function leaderCapacityMatrix({count=2400,locality=0.85,seed=20261030,quotas=[24,96,256,null]}={}) {
  if(!Array.isArray(quotas)||quotas.length<1||quotas.length>8)throw new TypeError('Invalid quota list');
  const messages=syntheticMessages({count,locality,seed});
  return LEADER_DESIGNS.map(name=>Object.freeze({topology:name,links:buildLeaderTopology(name).links,crossTeamWorkerLinks:buildLeaderTopology(name).crossTeamWorkerLinks,
    scenarios:Object.freeze(quotas.map(quota=>simulateLeaderTraffic(name,messages,{quota})))}));
}
