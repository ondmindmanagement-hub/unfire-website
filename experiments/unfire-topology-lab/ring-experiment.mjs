/**
 * Unfire Atlas · selective inter-team resilience experiment.
 * Offline mathematical graph model. No network or agent operations.
 */
import { buildTopology, route, ROOT, WORKER_COUNT, syntheticMessages } from "./model.mjs";

const LEADERS = Object.freeze([0, 6, 12, 18]);
const NODES = WORKER_COUNT + 1;

export function buildRingTopology(base = "hierarchy") {
  if (!["hierarchy", "regional"].includes(base)) throw new TypeError("Unsupported ring base");
  const original = buildTopology(base);
  const graph = original.adjacency.map(neighbors => new Set(neighbors));
  for (let i = 0; i < LEADERS.length; i++) {
    const a = LEADERS[i], b = LEADERS[(i + 1) % LEADERS.length];
    graph[a].add(b);
    graph[b].add(a);
  }
  const adjacency = graph.map(neighbors =>
    Object.freeze([...neighbors].sort((a, b) => a - b)));
  const links = adjacency.reduce((sum, neighbors) => sum + neighbors.length, 0) / 2;
  return Object.freeze({
    name: base === "hierarchy" ? "hierarchy-ring" : "regional-ring",
    workers: WORKER_COUNT, root: ROOT, links, adjacency: Object.freeze(adjacency)
  });
}

/* Model only: no real timing, CPU, API traffic, network or fault-tolerance measurements. */
export function measureRing(topology, messages, { removed = null } = {}) {
  if (!topology || !["hierarchy-ring", "regional-ring"].includes(topology.name)
      || !Array.isArray(messages)) throw new TypeError("Invalid experiment input");
  const forwarded = Array(NODES).fill(0);
  let delivered = 0, totalHops = 0, localDelivered = 0, remoteDelivered = 0;
  for (const message of messages) {
    const path = route(topology, message.from, message.to, removed);
    if (path === null) continue;
    delivered++;
    totalHops += path.length - 1;
    if (message.local) localDelivered++; else remoteDelivered++;
    for (const node of path.slice(1, -1)) forwarded[node]++;
  }
  return Object.freeze({
    topology: topology.name,
    links: topology.links,
    messages: messages.length,
    delivered,
    deliveryRate: messages.length ? delivered / messages.length : null,
    localDelivered,
    remoteDelivered,
    averageHops: delivered ? totalHops / delivered : null,
    totalTransmissions: totalHops,
    rootRelays: forwarded[ROOT],
    peakNodeRelays: Math.max(...forwarded),
    removed,
    disclaimer: "Synthetic shortest-path graph experiment. No real AI performance, security or fault tolerance measured."
  });
}

export function compareRing({ count = 2400, locality = 0.85, seed = 20261030 } = {}) {
  const messages = syntheticMessages({ count, locality, seed });
  return ["hierarchy", "regional"].map(base => {
    const topology = buildRingTopology(base);
    return Object.freeze({
      name: topology.name,
      intact: measureRing(topology, messages),
      rootFailure: measureRing(topology, messages, { removed: ROOT }),
      leaderFailure: measureRing(topology, messages, { removed: LEADERS[0] })
    });
  });
}
