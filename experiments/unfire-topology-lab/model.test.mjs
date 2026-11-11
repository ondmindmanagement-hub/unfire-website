import test from "node:test";
import assert from "node:assert/strict";
import {
  ROOT, WORKER_COUNT, TOPOLOGIES,
  buildTopology, route, syntheticMessages, measure, compare
} from "./model.mjs";

test("stable topology sizes and symmetric links", () => {
  const expected = { hub: 24, hierarchy: 24, regional: 64, mesh: 300 };
  for (const name of TOPOLOGIES) {
    const g = buildTopology(name);
    assert.equal(g.links, expected[name]);
    assert.equal(g.adjacency.length, 25);
    for (let a = 0; a < 25; a++) for (const b of g.adjacency[a]) {
      assert.ok(g.adjacency[b].includes(a));
    }
  }
});
test("cross-team shortest paths are topology-dependent", () => {
  const expected = { hub: 2, hierarchy: 4, regional: 4, mesh: 1 };
  for (const name of TOPOLOGIES) {
    assert.equal(route(buildTopology(name), 1, 7).length - 1, expected[name]);
  }
});
test("local traffic gets shorter routes in regional mesh", () => {
  assert.equal(route(buildTopology("regional"), 1, 2).length - 1, 1);
  assert.equal(route(buildTopology("hierarchy"), 1, 2).length - 1, 2);
});
test("hub removal disables star communications but not mesh communications", () => {
  const messages = syntheticMessages();
  assert.equal(measure(buildTopology("hub"), messages, { removed: ROOT }).delivered, 0);
  assert.equal(measure(buildTopology("mesh"), messages, { removed: ROOT }).delivered, messages.length);
});
test("hierarchy preserves local communications after root removal", () => {
  const messages = syntheticMessages({ count: 200, locality: 1 });
  assert.equal(measure(buildTopology("hierarchy"), messages, { removed: ROOT }).delivered, 200);
});
test("hierarchy loses cross-team communications after root removal", () => {
  const messages = syntheticMessages({ count: 200, locality: 0 });
  assert.equal(measure(buildTopology("hierarchy"), messages, { removed: ROOT }).delivered, 0);
});
test("local workload is generated exactly and reproducibly", () => {
  const a = syntheticMessages({ count: 1500, locality: 0.85, seed: 123 });
  assert.deepEqual(a, syntheticMessages({ count: 1500, locality: 0.85, seed: 123 }));
  for (const event of a) {
    assert.ok(event.from >= 0 && event.from < WORKER_COUNT);
    assert.ok(event.to >= 0 && event.to < WORKER_COUNT && event.to !== event.from);
    assert.equal(Math.floor(event.from / 6) === Math.floor(event.to / 6), event.local);
  }
});
test("no topological layout wins on every metric", () => {
  const findings = compare();
  const by = Object.fromEntries(findings.map(r => [r.name, r]));
  assert.ok(by.hub.intact.links < by.mesh.intact.links);
  assert.ok(by.mesh.intact.averageHops < by.hierarchy.intact.averageHops);
  assert.ok(by.hierarchy.intact.rootRelays < by.hub.intact.rootRelays);
  assert.ok(by.regional.rootFailure.deliveryRate > by.hub.rootFailure.deliveryRate);
  assert.ok(by.mesh.rootFailure.deliveryRate > by.regional.rootFailure.deliveryRate);
});
test("invalid parameter values fail closed", () => {
  assert.throws(() => buildTopology("planetary-consciousness"), /Unknown topology/);
  assert.throws(() => syntheticMessages({ count: 20001 }), /count/);
  assert.throws(() => syntheticMessages({ locality: 1.2 }), /locality/);
  assert.throws(() => route(buildTopology("hub"), -1, 0), /vertex/);
  assert.throws(() => route(buildTopology("hub"), 0, 1, 999), /vertex/);
});
test("summary never claims any real execution or inferred awareness", () => {
  for (const result of compare({ count: 80 })) {
    assert.match(result.intact.disclaimer, /Not measured AI performance/);
    assert.ok(result.intact.delivered <= 80);
    assert.ok(result.rootFailure.deliveryRate >= 0 && result.rootFailure.deliveryRate <= 1);
  }
});
