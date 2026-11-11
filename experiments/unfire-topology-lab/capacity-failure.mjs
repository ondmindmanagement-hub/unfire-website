/**
 * Unfire Atlas · offline synthetic resilience + link-capacity experiment.
 * Abstract graphs and synthetic messages ONLY.
 * No network, real agent, operating system, account or API actions.
 */
import { buildTopology, syntheticMessages, WORKER_COUNT, ROOT } from "./model.mjs";
import { buildRingTopology } from "./ring-experiment.mjs";
const NODES = WORKER_COUNT + 1;
export const DESIGNS = Object.freeze(["hub","hierarchy","regional","mesh","hierarchy-ring","regional-ring"]);
export const DEFAULT_SEED = 20261030;
export function topology(name) {
  if (!DESIGNS.includes(name)) throw new TypeError("Unknown topology");
  return name.endsWith("-ring") ? buildRingTopology(name.slice(0,-5)) : buildTopology(name);
}
function validGraph(g) {
  return g && DESIGNS.includes(g.name) && g.root===ROOT &&
    Array.isArray(g.adjacency) && g.adjacency.length===NODES;
}
function validateRemovals(values) {
  if (!Array.isArray(values) || values.length>2 ||
      values.some(x=>!Number.isSafeInteger(x)||x<0||x>=NODES) ||
      new Set(values).size!==values.length) throw new TypeError("Invalid removed vertices");
  return new Set(values);
}
function key(a,b) {return Math.min(a,b)+":"+Math.max(a,b);}
/* Shortest available route: sorted-neighbor BFS, optional fixed edge-use quota. */
export function availablePath(graph,origin,destination,{removedNodes=[],used=new Map(),linkCapacity=null}={}) {
  if (!validGraph(graph)) throw new TypeError("Invalid topology");
  const removed=validateRemovals(removedNodes);
  if (![origin,destination].every(x=>Number.isSafeInteger(x)&&x>=0&&x<NODES))
    throw new TypeError("Invalid endpoint");
  if (!(used instanceof Map)) throw new TypeError("Invalid link usage");
  if (linkCapacity!==null && (!Number.isSafeInteger(linkCapacity)||linkCapacity<1||linkCapacity>1000000))
    throw new TypeError("Invalid link capacity");
  if (removed.has(origin)||removed.has(destination)) return null;
  if (origin===destination) return [origin];
  const parent=new Map([[origin,null]]), queue=[origin];
  for (let head=0;head<queue.length;head++) {
    const here=queue[head];
    for(const next of graph.adjacency[here]) {
      if(removed.has(next)||parent.has(next)||
         (linkCapacity!==null&&(used.get(key(here,next))??0)>=linkCapacity)) continue;
      parent.set(next,here);
      if(next===destination) {
        const path=[destination];
        for(let node=here;node!==null;node=parent.get(node)) path.push(node);
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}
export function simulateTraffic(graph,messages,{removedNodes=[],linkCapacity=null}={}) {
  if(!validGraph(graph)||!Array.isArray(messages)||messages.length>20000)
    throw new TypeError("Invalid scenario");
  const removed=validateRemovals(removedNodes), used=new Map();
  const relayLoad=Array(NODES).fill(0);
  let delivered=0,failedEndpoint=0,unreachable=0,saturated=0,hops=0;
  for(const item of messages) {
    if(!item||!Number.isSafeInteger(item.from)||!Number.isSafeInteger(item.to)||
       item.from<0||item.to<0||item.from>=WORKER_COUNT||item.to>=WORKER_COUNT||
       item.from===item.to) throw new TypeError("Invalid message");
    if(removed.has(item.from)||removed.has(item.to)) {failedEndpoint++;continue;}
    const path=availablePath(graph,item.from,item.to,{removedNodes,used,linkCapacity});
    if(!path) {
      if(!availablePath(graph,item.from,item.to,{removedNodes})) unreachable++;
      else saturated++;
      continue;
    }
    delivered++;hops+=path.length-1;
    for(let i=0;i<path.length-1;i++) {
      const edge=key(path[i],path[i+1]);used.set(edge,(used.get(edge)??0)+1);
    }
    for(let i=1;i<path.length-1;i++) relayLoad[path[i]]++;
  }
  if(delivered+failedEndpoint+unreachable+saturated!==messages.length)
    throw new Error("Conservation invariant violated");
  return Object.freeze({
    topology:graph.name, messages:messages.length,
    removedNodes:Object.freeze([...removed].sort((a,b)=>a-b)),
    linkCapacity,links:graph.links,delivered,failedEndpoint,unreachable,saturated,
    deliveryRate:messages.length?delivered/messages.length:null,
    reachableRate:messages.length>failedEndpoint?delivered/(messages.length-failedEndpoint):null,
    averageHops:delivered?hops/delivered:null,coordinatorRelays:relayLoad[ROOT],
    peakRelayLoad:Math.max(...relayLoad),activeLinks:used.size,
    maxLinkUsage:used.size?Math.max(...used.values()):0,
    disclaimer:"Abstract sequential message routing with per-link quotas, not speed, security, real resilience or AI-agent execution."
  });
}
export function evaluatePairs({count=180,locality=0.85,seed=DEFAULT_SEED}={}) {
  const messages=syntheticMessages({count,locality,seed}), pairs=[];
  for(let a=0;a<NODES;a++) for(let b=a+1;b<NODES;b++) pairs.push([a,b]);
  return DESIGNS.map(name=>{
    const graph=topology(name);
    let sum=0,worstRate=Infinity,worstPairs=[],sumReachable=0;
    for(const removedNodes of pairs) {
      const r=simulateTraffic(graph,messages,{removedNodes});
      sum+=r.deliveryRate;sumReachable+=r.reachableRate??0;
      if(r.deliveryRate<worstRate-1e-12) {worstRate=r.deliveryRate;worstPairs=[removedNodes];}
      else if(Math.abs(r.deliveryRate-worstRate)<=1e-12) worstPairs.push(removedNodes);
    }
    return Object.freeze({
      topology:name,links:graph.links,pairs:pairs.length,
      averageDeliveryRate:sum/pairs.length,
      averageEligibleDeliveryRate:sumReachable/pairs.length,
      worstDeliveryRate:worstRate,
      worstPairs:Object.freeze(worstPairs.slice(0,5).map(pair=>Object.freeze([...pair]))),
      tiesForWorst:worstPairs.length,
      disclaimer:"Toy graph with two removed vertices. Not measured platform resilience."
    });
  });
}
export function capacitySweep({count=2400,locality=0.85,seed=DEFAULT_SEED,caps=[24,96,256,null]}={}) {
  if(!Array.isArray(caps)||caps.length<1||caps.length>8) throw new TypeError("Invalid caps");
  const messages=syntheticMessages({count,locality,seed});
  return DESIGNS.map(name=>Object.freeze({
    topology:name,links:topology(name).links,
    cases:Object.freeze(caps.map(linkCapacity=>
      simulateTraffic(topology(name),messages,{linkCapacity})))
  }));
}
