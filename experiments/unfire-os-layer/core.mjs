/**
 * Unfire OS Layer. Inert, dependency-free research core.
 * This module cannot read files, use network, run shell commands or control devices.
 */
const OPS = Object.freeze({
  "text.uppercase": v => {
    if (typeof v !== "string" || v.length > 1000) throw new TypeError("Input must be text (max 1000 characters)");
    return v.toUpperCase();
  },
  "text.wordCount": v => {
    if (typeof v !== "string" || v.length > 1000) throw new TypeError("Input must be text (max 1000 characters)");
    const t = v.trim();
    return t ? t.split(/\s+/u).length : 0;
  },
  "math.sum": v => {
    if (!Array.isArray(v) || v.length > 100 || v.some(n => typeof n !== "number" || !Number.isFinite(n)))
      throw new TypeError("Input must be up to 100 finite numbers");
    const n = v.reduce((a, b) => a + b, 0);
    if (!Number.isFinite(n)) throw new RangeError("Sum out of range");
    return n;
  }
});
export const OPERATIONS = Object.freeze(Object.keys(OPS));
const ID = /^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/u;
function record(v) {
  return v !== null && typeof v === "object" && !Array.isArray(v) &&
    (Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
}
function keys(v, allowed) {
  if (!record(v) || Object.keys(v).some(k => !allowed.includes(k))) throw new TypeError("Unexpected manifest field");
}
export function plan(manifest) {
  keys(manifest, ["taskId", "requiresApproval", "steps"]);
  if (typeof manifest.taskId !== "string" || !ID.test(manifest.taskId) ||
      typeof manifest.requiresApproval !== "boolean" ||
      !Array.isArray(manifest.steps) || manifest.steps.length === 0 || manifest.steps.length > 16)
    throw new TypeError("Invalid task manifest");
  const m = new Map();
  for (const s of manifest.steps) {
    keys(s, ["id", "operation", "input", "dependsOn"]);
    if (typeof s.id !== "string" || !ID.test(s.id) || m.has(s.id) ||
        typeof s.operation !== "string" || !Object.hasOwn(OPS, s.operation) ||
        (s.dependsOn !== undefined && (!Array.isArray(s.dependsOn) ||
          s.dependsOn.length > 16 ||
          s.dependsOn.some(d => typeof d !== "string" || !ID.test(d)))))
      throw new TypeError("Duplicate step, invalid dependency, or unsupported capability");
    // Validate every step before any result is computed.
    OPS[s.operation](s.input);
    m.set(s.id, s);
  }
  const visited = new Set(), visiting = new Set(), ordered = [];
  function visit(id) {
    if (!m.has(id)) throw new TypeError("Unknown dependency: " + id);
    if (visiting.has(id)) throw new TypeError("Dependency cycle");
    if (visited.has(id)) return;
    visiting.add(id);
    for (const dep of m.get(id).dependsOn ?? []) visit(dep);
    visiting.delete(id);
    visited.add(id);
    const s = m.get(id);
    ordered.push(Object.freeze({ id: s.id, operation: s.operation, input: s.input,
      dependsOn: Object.freeze([...(s.dependsOn ?? [])]) }));
  }
  for (const id of m.keys()) visit(id);
  return Object.freeze({ taskId: manifest.taskId, requiresApproval: manifest.requiresApproval,
    steps: Object.freeze(ordered) });
}
export function runSyntheticTask(manifest, { approved = false, shouldStop = () => false } = {}) {
  if (typeof approved !== "boolean" || typeof shouldStop !== "function")
    throw new TypeError("Invalid run controls");
  const task = plan(manifest), events = [{ type: "VALIDATED", taskId: task.taskId }];
  const results = Object.create(null);
  if (task.requiresApproval && !approved) {
    events.push({ type: "BLOCKED_APPROVAL" });
    return { status: "BLOCKED", events, results };
  }
  for (const step of task.steps) {
    if (shouldStop()) {
      events.push({ type: "STOPPED", before: step.id });
      return { status: "STOPPED", events, results };
    }
    results[step.id] = OPS[step.operation](step.input);
    events.push({ type: "STEP_COMPLETE", stepId: step.id, operation: step.operation });
  }
  events.push({ type: "COMPLETE" });
  return { status: "COMPLETE", events, results };
}
