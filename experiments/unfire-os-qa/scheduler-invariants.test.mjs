import test from "node:test";
import assert from "node:assert/strict";
import { researchTemplate, planAgentWaves } from "../unfire-os-layer/superchat.mjs";
import { runSyntheticTask } from "../unfire-os-layer/core.mjs";

const SEED = 0x51a7b1e;
function random(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}
function makeDag(next, size) {
  const tasks = [];
  for (let i = 0; i < size; i++) {
    const dependsOn = new Set();
    if (i > 0) {
      const count = Math.floor(next() * Math.min(4, i + 1));
      for (let k = 0; k < count; k++) dependsOn.add("t" + Math.floor(next() * i));
    }
    const write = next() < 0.35;
    tasks.push({
      id: "t" + i, role: "worker", lane: write ? "build" : "discover",
      kind: write ? "write" : "read", dependsOn: [...dependsOn],
      targets: write ? ["artifact" + Math.floor(next() * 5)] : []
    });
  }
  return tasks;
}
function assertWaveInvariants(tasks, plan, concurrency) {
  assert.equal(plan.blocked.length, 0, "all approved synthetic tasks must be schedulable");
  assert.equal(plan.scheduled, tasks.length);
  const byId = new Map(tasks.map(task => [task.id, task]));
  const waveOf = new Map();
  for (const [waveIndex, wave] of plan.waves.entries()) {
    assert.ok(wave.length > 0 && wave.length <= concurrency, "bounded concurrency");
    const reserved = new Set();
    for (const task of wave) {
      assert.ok(byId.has(task.id), "do not invent a task");
      assert.ok(!waveOf.has(task.id), "schedule every task once");
      waveOf.set(task.id, waveIndex);
      for (const target of task.targets) {
        assert.ok(!reserved.has(target), "one writer per target within a wave");
        reserved.add(target);
      }
    }
  }
  assert.equal(waveOf.size, tasks.length);
  for (const task of tasks) {
    for (const dependency of task.dependsOn) {
      assert.ok(waveOf.get(dependency) < waveOf.get(task.id), "dependencies must precede work");
    }
  }
}
test("512 seeded synthetic DAGs honor dependencies and exclusive write waves", () => {
  const next = random(SEED);
  for (let i = 0; i < 512; i++) {
    const size = 1 + Math.floor(next() * 24);
    const concurrency = 1 + Math.floor(next() * 8);
    const tasks = makeDag(next, size);
    const approved = tasks.filter(t => t.kind === "write").map(t => t.id);
    const plan = planAgentWaves(tasks, { concurrency, approved });
    assertWaveInvariants(tasks, plan, concurrency);
  }
});
test("simulated plan is not evidence of actual execution", () => {
  const plan = planAgentWaves(researchTemplate("Validate scheduling semantics"), {
    concurrency: 8, approved: ["synthesis", "release"]
  });
  assert.ok(plan.disclaimer.includes("Simulation only"));
  assert.equal(Object.hasOwn(plan, "workerResults"), false);
  assert.equal(Object.hasOwn(plan, "verifiedOutputs"), false);
});
test("approving release does not bypass an unapproved predecessor", () => {
  const plan = planAgentWaves(researchTemplate("Validate authorization boundaries"), {
    approved: ["release"], concurrency: 8
  });
  assert.ok(plan.blocked.includes("synthesis"));
  assert.ok(plan.blocked.includes("quality"));
  assert.ok(plan.blocked.includes("release"));
});
test("missing approval blocks writes even if later reads are available", () => {
  const plan = planAgentWaves(researchTemplate("Verify protected writes"));
  assert.deepEqual(plan.blocked, ["synthesis", "quality", "release"]);
});
test("two writers to one target are not scheduled in the same wave", () => {
  const tasks = Array.from({ length: 20 }, (_, index) => ({
    id: "w" + index, role: "editor", lane: "build",
    kind: "write", dependsOn: [], targets: ["single_artifact"]
  }));
  const plan = planAgentWaves(tasks, { concurrency: 8, approved: tasks.map(t => t.id) });
  assert.equal(plan.waves.length, 20);
  assert.ok(plan.waves.every(wave => wave.length === 1));
});
test("synthetic STOP cancels subsequent pure work", () => {
  const task = { taskId: "controlled", requiresApproval: false, steps: [
    { id: "first", operation: "math.sum", input: [1, 2] },
    { id: "second", operation: "math.sum", input: [4, 5] }
  ] };
  let checks = 0;
  const result = runSyntheticTask(task, { shouldStop: () => ++checks > 1 });
  assert.equal(result.status, "STOPPED");
  assert.deepEqual(Object.keys(result.results), ["first"]);
});
test("unsupported operations remain denied", () => {
  const task = { taskId: "denied", requiresApproval: false, steps: [
    { id: "unsafe", operation: "shell.exec", input: "untrusted" }
  ] };
  assert.throws(() => runSyntheticTask(task), /unsupported/);
});
test("a task field cannot smuggle an extra capability", () => {
  const tasks = researchTemplate("Reject untrusted task capabilities");
  tasks[0].networkAccess = true;
  assert.throws(() => planAgentWaves(tasks), /Unexpected task field/);
});
test("a cyclic graph cannot be turned into a scheduled task", () => {
  const tasks = researchTemplate("Reject cyclic workflow dependencies");
  tasks[0].dependsOn = ["quality"];
  assert.throws(() => planAgentWaves(tasks), /Dependency cycle/);
});
