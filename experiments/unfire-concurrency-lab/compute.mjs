/**
 * Unfire OS · pure bounded synthetic hash-fold workload.
 * Mathematics only. No AI model calls, filesystem, network, or user data.
 */
export const OPERATION = "synthetic.hashFold";
export const MAX_TASKS = 32;
export const MAX_ROUNDS = 150000;
const ID = /^[a-z][a-z0-9_-]{0,31}$/;
export function validateTasks(tasks) {
  if (!Array.isArray(tasks) || tasks.length < 1 || tasks.length > MAX_TASKS) {
    throw new TypeError("Invalid bounded task list");
  }
  const seen = new Set();
  return Object.freeze(tasks.map(task => {
    if (!task || Object.getPrototypeOf(task) !== Object.prototype ||
        Object.keys(task).sort().join(",") !== "id,operation,rounds,salt" ||
        typeof task.id !== "string" || !ID.test(task.id) || seen.has(task.id) ||
        task.operation !== OPERATION ||
        !Number.isSafeInteger(task.rounds) || task.rounds < 1 || task.rounds > MAX_ROUNDS ||
        !Number.isSafeInteger(task.salt) || task.salt < 0 || task.salt > 65535) {
      throw new TypeError("Invalid synthetic task or duplicate id");
    }
    seen.add(task.id);
    return Object.freeze({ id:task.id, operation:OPERATION, rounds:task.rounds, salt:task.salt });
  }));
}
export function hashFold(task) {
  let x = (task.salt + 0x9e3779b9) >>> 0;
  for (let i = 0; i < task.rounds; i++) {
    x = (Math.imul(x ^ (x >>> 13), 0x85ebca6b) + i + 0xc2b2ae35) >>> 0;
    x ^= x >>> 16;
  }
  return x >>> 0;
}
export function sampleTasks(count = 24, rounds = 100000) {
  if (!Number.isSafeInteger(count) || count < 1 || count > MAX_TASKS ||
      !Number.isSafeInteger(rounds) || rounds < 1 || rounds > MAX_ROUNDS)
    throw new TypeError("Invalid synthetic sample size");
  return Object.freeze(Array.from({length:count}, (_, i) => Object.freeze({
    id:"job_"+String(i).padStart(2,"0"),
    operation:OPERATION, rounds, salt:(i * 7919 + 125) % 65536
  })));
}
