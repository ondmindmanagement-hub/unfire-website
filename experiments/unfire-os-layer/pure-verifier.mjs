/**
 * Unfire OS Layer · deterministic evidence verifier.
 * Independent from the Swift worker. Deliberately supports a tiny,
 * ASCII-only synthetic contract; not an LLM quality/safety evaluation.
 */
import { createHash } from "node:crypto";

const OPS = Object.freeze(["uppercase","word_count","sha256"]);
const ASCII = /^[\x20-\x7e]{0,512}$/u;
const hash = bytes => createHash("sha256").update(bytes).digest("hex");

export function validatePureTask(task) {
  if (task === null || typeof task !== "object" || Array.isArray(task) ||
      Object.getPrototypeOf(task) !== Object.prototype ||
      Object.keys(task).length !== 2 ||
      !Object.hasOwn(task, "operation") || !Object.hasOwn(task, "input") ||
      !OPS.includes(task.operation) || typeof task.input !== "string" ||
      !ASCII.test(task.input)) {
    throw new TypeError("Only bounded printable-ASCII synthetic transforms are allowed");
  }
  return Object.freeze({ operation: task.operation, input: task.input });
}
export function independentlyVerify(task, outputText) {
  const input = validatePureTask(task);
  if (typeof outputText !== "string" || Buffer.byteLength(outputText, "utf8") > 8192) {
    throw new Error("Worker output exceeds the strict size limit");
  }
  let result;
  try { result = JSON.parse(outputText); }
  catch { throw new Error("Worker did not return valid JSON"); }
  if (result === null || typeof result !== "object" || Array.isArray(result) ||
      Object.getPrototypeOf(result) !== Object.prototype ||
      Object.keys(result).length !== 2 || result.ok !== true ||
      !Object.hasOwn(result, "value")) {
    throw new Error("Worker response has an untrusted or unexpected shape");
  }
  const expected = input.operation === "uppercase" ? input.input.toUpperCase()
    : input.operation === "word_count"
      ? (input.input.trim() ? input.input.trim().split(/ +/u).length : 0)
      : hash(Buffer.from(input.input,"utf8"));
  if (result.value !== expected) {
    throw new Error("Independent result verification failed");
  }
  const normalized = JSON.stringify({ok:true,value:expected});
  return Object.freeze({
    operation:input.operation, value:expected,
    resultDigest:hash(Buffer.from(normalized,"utf8")),
    verification:"deterministic-recomputed"
  });
}
