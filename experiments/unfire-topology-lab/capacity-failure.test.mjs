import test from "node:test";
import assert from "node:assert/strict";
import { buildTopology, syntheticMessages, ROOT, measure } from "./model.mjs";
import { buildRingTopology, measureRing } from "./ring-experiment.mjs";
import { DESIGNS, topology, availablePath, simulateTraffic, evaluatePairs, capacitySweep } from "./capacity-failure.mjs";

const messages=syntheticMessages({count:2400,locality:0.85,seed:20261030});

test("six supported designs have expected link counts",()=>{
  assert.deepEqual(DESIGNS.map(n=>topology(n).links),[24,24,64,300,28,68]);
});
test("unlimited capacity agrees with prior routing for intact graphs",()=>{
  for(const design of DESIGNS){
    const g=topology(design), next=simulateTraffic(g,messages);
    const prior=design.includes("-ring")?measureRing(g,messages):measure(g,messages);
    assert.equal(next.delivered,prior.delivered);
    assert.equal(next.averageHops,prior.averageHops);
    assert.equal(next.coordinatorRelays,prior.rootRelays);
  }
});
test("single coordinator failure agrees with baseline routing",()=>{
  for(const design of DESIGNS) {
    const g=topology(design),next=simulateTraffic(g,messages,{removedNodes:[ROOT]});
    const prior=design.includes("-ring")?
      measureRing(g,messages,{removed:ROOT}):measure(g,messages,{removed:ROOT});
    assert.equal(next.delivered,prior.delivered);
  }
});
test("dual failure separates endpoint loss and disconnection",()=>{
  const mixed=simulateTraffic(buildRingTopology("hierarchy"),messages,{removedNodes:[ROOT,0]});
  assert.equal(mixed.delivered+mixed.failedEndpoint+mixed.unreachable+mixed.saturated,2400);
  assert.ok(mixed.unreachable>0);
  assert.ok(mixed.failedEndpoint>0);
});
test("each undirected link respects its fixed batch capacity",()=>{
  for(const name of DESIGNS)for(const cap of [24,96,256]){
    const r=simulateTraffic(topology(name),messages,{linkCapacity:cap});
    assert.ok(r.maxLinkUsage<=cap,name+" cap "+cap);
    assert.equal(r.delivered+r.failedEndpoint+r.unreachable+r.saturated,2400);
  }
});
test("direct link can reroute when spare graph paths exist",()=>{
  const three=[{from:1,to:2},{from:1,to:2},{from:1,to:2}];
  const mesh=simulateTraffic(topology("mesh"),three,{linkCapacity:1});
  assert.equal(mesh.delivered,3);assert.ok(mesh.averageHops>1);
  const hub=simulateTraffic(topology("hub"),three,{linkCapacity:1});
  assert.equal(hub.delivered,1);assert.equal(hub.saturated,2);
});
test("all 300 two-node pairs tested for each topology",()=>{
  const results=evaluatePairs({count:180});
  assert.equal(results.length,6);
  for(const r of results){
    assert.equal(r.pairs,300);
    assert.ok(r.averageDeliveryRate>=0&&r.averageDeliveryRate<=1);
    assert.ok(r.worstDeliveryRate>=0&&r.worstDeliveryRate<=1);
    assert.ok(r.worstDeliveryRate<=r.averageDeliveryRate);
  }
});
test("ring does not cure every dual-node failure",()=>{
  const records=evaluatePairs({count:180});
  assert.ok(records.find(x=>x.topology==="hierarchy-ring").worstDeliveryRate<1);
  const r=simulateTraffic(topology("hierarchy-ring"),messages,{removedNodes:[0,6]});
  assert.ok(r.unreachable>0);
});
test("same traffic seed and capacity settings produce identical results",()=>{
  const opts={count:180,locality:0.5,seed:33,caps:[16,64,null]};
  const a=capacitySweep(opts),b=capacitySweep(opts);
  assert.deepEqual(a,b);assert.equal(a.length,6);
});
test("unsupported inputs rejected",()=>{
  assert.throws(()=>topology("galaxy"),/Unknown topology/);
  assert.throws(()=>availablePath(topology("hub"),-1,2),/Invalid endpoint/);
  assert.throws(()=>simulateTraffic(topology("mesh"),messages,{removedNodes:[3,3]}),/Invalid removed/);
  assert.throws(()=>simulateTraffic(topology("mesh"),messages,{removedNodes:[1,2,3]}),/Invalid removed/);
  assert.throws(()=>simulateTraffic(topology("mesh"),messages,{linkCapacity:0}),/Invalid link capacity/);
  assert.throws(()=>capacitySweep({caps:[]}),/Invalid caps/);
});
test("the model disclaims real performance, security and execution",()=>{
  const r=simulateTraffic(topology("regional-ring"),messages,{linkCapacity:48});
  assert.match(r.disclaimer,/not speed, security, real resilience or AI-agent execution/);
});
