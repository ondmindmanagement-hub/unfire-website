import test from "node:test";
import assert from "node:assert/strict";
import { researchTemplate, planAgentWaves } from "./superchat.mjs";
const sample = () => researchTemplate("How do coordinated agents reduce duplicated work?");
test("one coordinator can plan seven specialist stages", () => assert.equal(sample().length, 7));
test("three discovery tasks can run in one wave", () => {
  const p = planAgentWaves(sample(), { concurrency: 3, approved: ["synthesis","release"] });
  assert.deepEqual(p.waves[0].map(t=>t.id), ["sources","challenge","technical"]);
});
test("dependency ordering includes quality before release", () => {
  const p=planAgentWaves(sample(),{concurrency:8,approved:["synthesis","release"]});
  assert.deepEqual(p.waves.map(w=>w.map(t=>t.id)), [
    ["sources","challenge","technical"],["evidence"],["synthesis"],["quality"],["release"]]);
});
test("writes require approval", () => {
  const p=planAgentWaves(sample());
  assert.deepEqual(p.blocked,["synthesis","quality","release"]);
});
test("approved write still blocks unapproved release", () => {
  const p=planAgentWaves(sample(),{approved:["synthesis"]});
  assert.deepEqual(p.blocked,["release"]);
});
test("two writers cannot edit same target within wave", () => {
  const t=[{id:"first",role:"author",lane:"build",kind:"write",dependsOn:[],targets:["report"]},
    {id:"second",role:"reviewer",lane:"build",kind:"write",dependsOn:[],targets:["report"]}];
  const p=planAgentWaves(t,{approved:["first","second"],concurrency:5});
  assert.equal(p.waves.length,2);
});
test("independent writers can parallelize", () => {
  const t=[{id:"first",role:"author",lane:"build",kind:"write",dependsOn:[],targets:["report"]},
    {id:"second",role:"reviewer",lane:"build",kind:"write",dependsOn:[],targets:["notes"]}];
  assert.equal(planAgentWaves(t,{approved:["first","second"]}).waves[0].length,2);
});
test("reject dependency loops", () => {
  const t=sample(); t[0].dependsOn=["evidence"];
  assert.throws(()=>planAgentWaves(t), /cycle/);
});
test("reject missing dependencies", () => {
  const t=sample(); t[0].dependsOn=["missing"];
  assert.throws(()=>planAgentWaves(t), /Unresolved/);
});
test("reject more than 8 parallel workers", () => assert.throws(
  ()=>planAgentWaves(sample(),{concurrency:9}), /Concurrency/));
test("reject shell kind", () => {
  const t=sample(); t[0].kind="shell";
  assert.throws(()=>planAgentWaves(t), /invalid task/);
});
test("reject read task with write target", () => {
  const t=sample();t[0].targets=["private_file"];
  assert.throws(()=>planAgentWaves(t),/reservations/);
});
test("reject unexpected task field", () => {
  const t=sample();t[0].secret="abc";
  assert.throws(()=>planAgentWaves(t),/Unexpected/);
});
test("reject invalid research input", () => assert.throws(()=>researchTemplate("x"),/Research question/));
test("cap number of tasks", () => assert.throws(
  ()=>planAgentWaves(Array.from({length:25},(_,i)=>({id:"t"+i,role:"worker",lane:"discover",kind:"read",dependsOn:[],targets:[]}))),/Invalid scheduling/));
test("reject duplicates", () => {
  const t=sample(); t[1].id="sources";
  assert.throws(()=>planAgentWaves(t),/Duplicate/);
});
