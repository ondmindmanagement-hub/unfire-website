/**
 * Unfire Super Chat | Deterministic, offline planner. No AI model calls.
 * A single AI coordinator MAY dispatch several agents in a future adapter.
 * This file only produces a proposed schedule and denies unapproved writes.
 */
const NAME = /^[a-z][a-z0-9_-]{0,39}$/u;
function id(value, what) {
  if (typeof value !== "string" || !NAME.test(value)) throw new TypeError("Invalid " + what);
}
export function researchTemplate(question) {
  if (typeof question !== "string" || question.trim().length < 4 || question.length > 240)
    throw new TypeError("Research question must contain 4-240 characters");
  return [
    { id: "sources", role: "researcher", lane: "discover", kind: "read", dependsOn: [], targets: [] },
    { id: "challenge", role: "skeptic", lane: "discover", kind: "read", dependsOn: [], targets: [] },
    { id: "technical", role: "engineer", lane: "discover", kind: "read", dependsOn: [], targets: [] },
    { id: "evidence", role: "verifier", lane: "verify", kind: "read", dependsOn: ["sources","challenge","technical"], targets: [] },
    { id: "synthesis", role: "editor", lane: "build", kind: "write", dependsOn: ["evidence"], targets: ["report"] },
    { id: "quality", role: "auditor", lane: "verify", kind: "read", dependsOn: ["synthesis"], targets: [] },
    { id: "release", role: "coordinator", lane: "deliver", kind: "release", dependsOn: ["quality"], targets: ["report"] }
  ];
}
export function planAgentWaves(tasks, { concurrency = 3, approved = [] } = {}) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1 || concurrency > 8)
    throw new TypeError("Concurrency must be between 1 and 8");
  if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > 24 ||
      !Array.isArray(approved) || approved.some(x => typeof x !== "string"))
    throw new TypeError("Invalid scheduling input");
  const map = new Map();
  for (const task of tasks) {
    if (task === null || typeof task !== "object" || Array.isArray(task) ||
      Object.keys(task).some(k => !["id","role","lane","kind","dependsOn","targets"].includes(k)))
      throw new TypeError("Unexpected task field");
    id(task.id, "task identifier"); id(task.role, "agent role");
    if (map.has(task.id) || !["discover","build","verify","deliver"].includes(task.lane) ||
        !["read","write","release"].includes(task.kind) ||
        !Array.isArray(task.dependsOn) || !Array.isArray(task.targets) ||
        task.dependsOn.length > 24 || task.targets.length > 8)
      throw new TypeError("Duplicate or invalid task");
    task.dependsOn.forEach(x => id(x, "dependency"));
    task.targets.forEach(x => id(x, "reservation"));
    if (new Set(task.dependsOn).size !== task.dependsOn.length ||
        new Set(task.targets).size !== task.targets.length ||
        ((task.kind === "read") !== (task.targets.length === 0)))
      throw new TypeError("Invalid dependencies or write reservations");
    map.set(task.id, {
      id:task.id, role:task.role, lane:task.lane, kind:task.kind,
      dependsOn:[...task.dependsOn], targets:[...task.targets]
    });
  }
  const visiting = new Set(), checked = new Set();
  function visit(step) {
    if (!map.has(step)) throw new TypeError("Unresolved dependency: " + step);
    if (visiting.has(step)) throw new TypeError("Dependency cycle");
    if (checked.has(step)) return;
    visiting.add(step);
    for (const dep of map.get(step).dependsOn) visit(dep);
    visiting.delete(step); checked.add(step);
  }
  for (const name of map.keys()) visit(name);
  const finished = new Set(), permissions = new Set(approved), waves = [];
  while (finished.size < map.size) {
    const ready = [...map.values()].filter(t => !finished.has(t.id) &&
      t.dependsOn.every(dep => finished.has(dep)) &&
      (t.kind === "read" || permissions.has(t.id)));
    const reserved = new Set(), selected = [];
    for (const t of ready) {
      if (selected.length >= concurrency) break;
      if (t.targets.some(target => reserved.has(target))) continue;
      selected.push(t);
      t.targets.forEach(target => reserved.add(target));
    }
    if (!selected.length) break;
    waves.push(selected.map(t => ({ id:t.id, role:t.role, lane:t.lane, kind:t.kind, targets:[...t.targets] })));
    selected.forEach(t => finished.add(t.id));
  }
  return Object.freeze({
    waves, blocked:[...map.keys()].filter(x => !finished.has(x)),
    concurrency, total:map.size, scheduled:finished.size,
    disclaimer:"Simulation only. No agent, model, OS or remote service has executed."
  });
}
