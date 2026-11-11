import test from "node:test";
import assert from "node:assert/strict";
import { plan, runSyntheticTask, OPERATIONS } from "./core.mjs";
const task = () => ({ taskId: "demo", requiresApproval: true, steps: [
  { id: "second", operation: "text.wordCount", input: "one two three", dependsOn: ["first"] },
  { id: "first", operation: "text.uppercase", input: "hello" },
  { id: "third", operation: "math.sum", input: [3, 5] }
]});
test("strict allowlist", () => assert.deepEqual(OPERATIONS, ["text.uppercase", "text.wordCount", "math.sum"]));
test("topological ordering", () => assert.deepEqual(plan(task()).steps.map(s => s.id), ["first", "second", "third"]));
test("approval required", () => assert.equal(runSyntheticTask(task()).status, "BLOCKED"));
test("approved pure execution", () => {
  const r = runSyntheticTask(task(), { approved: true });
  assert.equal(r.status, "COMPLETE");
  assert.equal(r.results.first, "HELLO");
  assert.equal(r.results.second, 3);
  assert.equal(r.results.third, 8);
});
test("STOP before execution", () => {
  const r = runSyntheticTask(task(), { approved: true, shouldStop: () => true });
  assert.equal(r.status, "STOPPED");
  assert.equal(Object.keys(r.results).length, 0);
});
test("STOP after one step", () => {
  let n = 0;
  const r = runSyntheticTask(task(), { approved: true, shouldStop: () => n++ > 0 });
  assert.equal(r.status, "STOPPED");
  assert.deepEqual(Object.keys(r.results), ["first"]);
});
test("reject shell capability", () => {
  const t = task(); t.steps[0].operation = "shell.exec";
  assert.throws(() => plan(t), /unsupported/);
});
test("reject network capability", () => {
  const t = task(); t.steps[0].operation = "network.fetch";
  assert.throws(() => plan(t), /unsupported/);
});
test("reject cycles", () => {
  const t = task(); t.steps[1].dependsOn = ["second"];
  assert.throws(() => plan(t), /cycle/);
});
test("reject missing dependency", () => {
  const t = task(); t.steps[0].dependsOn = ["missing"];
  assert.throws(() => plan(t), /Unknown/);
});
test("reject duplicate identifiers", () => {
  const t = task(); t.steps[2].id = "first";
  assert.throws(() => plan(t), /Duplicate/);
});
test("reject oversize manifest", () => {
  const t = task(); t.steps = Array.from({ length: 17 }, (_, i) => ({ id: "a" + i, operation: "math.sum", input: [1] }));
  assert.throws(() => plan(t), /Invalid task/);
});
test("reject unsafe input", () => {
  const t = task(); t.steps[0].input = ["wrong"];
  assert.throws(() => plan(t), /text/);
});
test("reject extra keys", () => {
  const t = task(); t.command = "rm -rf /";
  assert.throws(() => plan(t), /Unexpected/);
});
test("reject invalid number", () => {
  const t = task(); t.steps[2].input = [Infinity];
  assert.throws(() => plan(t), /finite/);
});
test("reject task without steps", () => {
  const t = task(); t.steps = [];
  assert.throws(() => plan(t), /Invalid task/);
});
test("pure task can run without approval", () => {
  const t = task(); t.requiresApproval = false;
  assert.equal(runSyntheticTask(t).status, "COMPLETE");
});
test("validate run options", () => assert.throws(() => runSyntheticTask(task(), { approved: "yes" }), /Invalid run/));
