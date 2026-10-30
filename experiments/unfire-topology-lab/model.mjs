/**
 * Unfire Atlas | Multiscale Topology Lab
 * Offline, deterministic network-model comparison. NOT an AI runtime.
 * All vertices, messages and failures are synthetic.
 */

export const WORKER_COUNT = 24;
export const ROOT = WORKER_COUNT;
const NODE_COUNT = WORKER_COUNT + 1;
const GROUP_SIZE = 6;
export const TOPOLOGIES = Object.freeze(["hub", "hierarchy", "regional", "mesh"]);

function assertCount(value, max, name) {
  if (!Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new RangeError(name + " must be between 1 and " + max);
  }
}
function group(worker) { return Math.floor(worker / GROUP_SIZE); }
function addEdge(neighbors, a, b) {
  if (a === b) throw new Error("No self-edges");
  neighbors[a].add(b);
  neighbors[b].add(a);
}
export function buildTopology(name) {
  if (!TOPOLOGIES.includes(name)) throw new TypeError("Unknown topology");
  const neighbors = Array.from({ length: NODE_COUNT }, () => new Set());
  if (name === "hub") {
    for (let i = 0; i < WORKER_COUNT; i++) addEdge(neighbors, i, ROOT);
  } else if (name === "hierarchy" || name === "regional") {
    for (let g = 0; g < WORKER_COUNT / GROUP_SIZE; g++) {
      const leader = g * GROUP_SIZE;
      addEdge(neighbors, leader, ROOT);
      for (let k = 1; k < GROUP_SIZE; k++) {
        addEdge(neighbors, leader, leader + k);
      }
      if (name === "regional") {
        for (let a = 1; a < GROUP_SIZE; a++) {
          for (let b = a + 1; b < GROUP_SIZE; b++) {
            addEdge(neighbors, leader + a, leader + b);
          }
        }
      }
    }
  } else {
    for (let a = 0; a < NODE_COUNT; a++) {
      for (let b = a + 1; b < NODE_COUNT; b++) addEdge(neighbors, a, b);
    }
  }
  const adjacency = neighbors.map(s => Object.freeze([...s].sort((a, b) => a - b)));
  return Object.freeze({
    name, workers: WORKER_COUNT, root: ROOT,
    links: adjacency.reduce((n, arr) => n + arr.length, 0) / 2,
    adjacency: Object.freeze(adjacency)
  });
}
export function route(topology, origin, destination, removed = null) {
  if (![origin, destination].every(x => Number.isSafeInteger(x) && x >= 0 && x < NODE_COUNT)) {
    throw new TypeError("Invalid vertex");
  }
  if (removed !== null && (!Number.isSafeInteger(removed) || removed < 0 || removed >= NODE_COUNT)) {
    throw new TypeError("Invalid removed vertex");
  }
  if (origin === removed || destination === removed) return null;
  if (origin === destination) return [origin];
  const parent = new Map([[origin, null]]);
  const queue = [origin];
  for (let i = 0; i < queue.length; i++) {
    for (const next of topology.adjacency[queue[i]]) {
      if (next === removed || parent.has(next)) continue;
      parent.set(next, queue[i]);
      if (next === destination) {
        const path = [];
        let current = next;
        while (current !== null) {
          path.push(current);
          current = parent.get(current);
        }
        return path.reverse();
      }
      queue.push(next);
    }
  }
  return null;
}
function seeded(seed) {
  if (!Number.isSafeInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new TypeError("Invalid 32-bit seed");
  }
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
export function syntheticMessages({ count = 2400, locality = 0.85, seed = 20261030 } = {}) {
  assertCount(count, 20000, "message count");
  if (typeof locality !== "number" || !Number.isFinite(locality) || locality < 0 || locality > 1) {
    throw new RangeError("locality must be between 0 and 1");
  }
  const next = seeded(seed);
  const messages = [];
  for (let i = 0; i < count; i++) {
    const from = Math.floor(next() * WORKER_COUNT);
    const local = next() < locality;
    let to;
    if (local) {
      const base = group(from) * GROUP_SIZE;
      const pick = Math.floor(next() * (GROUP_SIZE - 1));
      to = base + (pick >= from - base ? pick + 1 : pick);
    } else {
      const other = Math.floor(next() * (WORKER_COUNT - GROUP_SIZE));
      // Select a worker outside this sender's group.
      to = other >= group(from) * GROUP_SIZE ? other + GROUP_SIZE : other;
    }
    messages.push(Object.freeze({ from, to, local }));
  }
  return Object.freeze(messages);
}
export function measure(topology, messages, { removed = null } = {}) {
  if (!TOPOLOGIES.includes(topology.name) || !Array.isArray(messages)) throw new TypeError("Invalid test setup");
  const forwards = Array(NODE_COUNT).fill(0);
  let delivered = 0;
  let totalHops = 0;
  let totalTransmissions = 0;
  for (const message of messages) {
    if (!Number.isSafeInteger(message.from) || !Number.isSafeInteger(message.to)) {
      throw new TypeError("Invalid synthetic message");
    }
    const path = route(topology, message.from, message.to, removed);
    if (path === null) continue;
    delivered++;
    totalHops += path.length - 1;
    totalTransmissions += path.length - 1;
    for (const node of path.slice(1, -1)) forwards[node]++;
  }
  const maxRelay = Math.max(...forwards);
  return Object.freeze({
    topology: topology.name, links: topology.links, messages: messages.length,
    delivered, deliveryRate: messages.length ? delivered / messages.length : null,
    averageHops: delivered ? totalHops / delivered : null,
    totalTransmissions, rootRelays: forwards[ROOT], peakNodeRelays: maxRelay,
    removed, disclaimer: "Synthetic graph routes only. Not measured AI performance."
  });
}
export function compare({ count = 2400, locality = 0.85, seed = 20261030 } = {}) {
  const messages = syntheticMessages({ count, locality, seed });
  return TOPOLOGIES.map(name => {
    const topology = buildTopology(name);
    return Object.freeze({
      name,
      intact: measure(topology, messages),
      rootFailure: measure(topology, messages, { removed: ROOT }),
      leaderFailure: measure(topology, messages, { removed: 0 })
    });
  });
}
