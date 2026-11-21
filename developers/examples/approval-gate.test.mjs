import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAction, appendRecord } from "./approval-gate.mjs";
test("allows harmless synthetic read and draft without external calls", () => {
  for (const kind of ["read", "draft"]) {
    assert.equal(evaluateAction({ id: "a1", kind, scope: "synthetic" }).status, "allow");
  }
});
test("requires explicit approval for a synthetic simulation", () => {
  const action = { id: "run-1", kind: "simulate", scope: "synthetic" };
  assert.equal(evaluateAction(action).status, "review");
  assert.equal(evaluateAction(action, ["not-run-1"]).status, "review");
  assert.equal(evaluateAction(action, ["run-1"]).status, "allow");
});
test("denies missing IDs, unsupported operations and real-world scope", () => {
  assert.equal(evaluateAction({ id: "../x", kind: "read", scope: "synthetic" }).status, "deny");
  assert.equal(evaluateAction({ id: "x", kind: "execute", scope: "synthetic" }).status, "deny");
  assert.equal(evaluateAction({ id: "x", kind: "read", scope: "production" }).status, "deny");
  assert.equal(evaluateAction(null).status, "deny");
});
test("appends an immutable local decision without mutating history", () => {
  const action = { id: "a", kind: "simulate", scope: "synthetic" };
  const old = [];
  const record = appendRecord(old, action, evaluateAction(action));
  assert.equal(old.length, 0);
  assert.equal(record.length, 1);
  assert.equal(record[0].status, "review");
  assert.ok(Object.isFrozen(record[0]));
  assert.throws(() => appendRecord(null, action, { status: "allow" }), TypeError);
});
