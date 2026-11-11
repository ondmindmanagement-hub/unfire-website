import test from "node:test";
import assert from "node:assert/strict";
import { buildTopology, route, syntheticMessages, ROOT, measure } from "./model.mjs";
import { buildRingTopology, measureRing, compareRing } from "./ring-experiment.mjs";

const testMessages = syntheticMessages({ count: 2400, locality: 0.85, seed: 20261030 });

test("a four-leader ring adds precisely four links", () => {
  assert.equal(buildRingTopology("hierarchy").links, 28);
  assert.equal(buildRingTopology("regional").links, 68);
  assert.equal(buildTopology("hierarchy").links, 24);
  assert.equal(buildTopology("regional").links, 64);
});
test("augmented graphs have symmetric links without duplicates", () => {
  for (const base of ["hierarchy", "regional"]) {
    const graph = buildRingTopology(base);
    for (let node = 0; node < graph.adjacency.length; node++) {
      assert.equal(new Set(graph.adjacency[node]).size, graph.adjacency[node].length);
      for (const peer of graph.adjacency[node]) assert.ok(graph.adjacency[peer].includes(node));
    }
  }
});
test("ring fallback preserves inter-team routes after coordinator loss", () => {
  for (const base of ["hierarchy", "regional"]) {
    const graph = buildRingTopology(base);
    assert.deepEqual(route(graph, 1, 7, ROOT), [1, 0, 6, 7]);
    assert.equal(measureRing(graph, testMessages, { removed: ROOT }).delivered, 2400);
  }
});
test("added edges do not reduce reachability after any one-node removal", () => {
  for (const base of ["hierarchy", "regional"]) {
    const graph = buildRingTopology(base);
    for (let removed = 0; removed < 25; removed++) {
      const augmented = measureRing(graph, testMessages, { removed });
      const plain = measure(buildTopology(base), testMessages, { removed });
      assert.ok(augmented.delivered >= plain.delivered, base + " vertex " + removed);
    }
  }
});
test("plain hierarchy retains exposure to its team leader", () => {
  const baseline = measure(buildTopology("hierarchy"), testMessages, { removed: 0 });
  const ring = measureRing(buildRingTopology("hierarchy"), testMessages, { removed: 0 });
  assert.equal(ring.delivered, baseline.delivered);
  assert.ok(ring.delivered < testMessages.length);
});
test("full mesh offers shorter paths with far more links", () => {
  const ring = compareRing()[0].intact;
  const full = measure(buildTopology("mesh"), testMessages);
  assert.ok(ring.links < full.links);
  assert.ok(ring.averageHops > full.averageHops);
});
test("ring paths reduce coordinator relays for cross-team messages", () => {
  const messages = syntheticMessages({ count: 2400, locality: 0, seed: 20261030 });
  const original = measure(buildTopology("hierarchy"), messages);
  const augmented = measureRing(buildRingTopology("hierarchy"), messages);
  assert.ok(augmented.rootRelays < original.rootRelays);
});
test("study is repeatable for four distinct traffic mixes", () => {
  for (const locality of [0, 0.5, 0.85, 1]) {
    const a = compareRing({ count: 2400, locality, seed: 347 });
    const b = compareRing({ count: 2400, locality, seed: 347 });
    assert.deepEqual(a, b);
    for (const item of a) {
      assert.equal(item.intact.delivered, 2400);
      assert.equal(item.rootFailure.delivered, 2400);
    }
  }
});
test("unsupported graph and malformed traffic are rejected", () => {
  assert.throws(() => buildRingTopology("mesh"), /Unsupported/);
  assert.throws(() => measureRing(buildTopology("hub"), testMessages), /Invalid/);
  assert.throws(() => compareRing({ locality: -1 }), /locality/);
});
test("results are labeled as simulations, not benchmarks", () => {
  for (const item of compareRing()) assert.match(item.intact.disclaimer, /No real AI performance/);
});
