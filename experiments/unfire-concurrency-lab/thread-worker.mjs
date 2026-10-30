/** Fixed-function, bounded worker. NOT a sandbox for arbitrary input code. */
import { parentPort } from "node:worker_threads";
import { hashFold, validateTasks } from "./compute.mjs";
if (!parentPort) throw new Error("Synthetic worker requires parentPort");
parentPort.on("message", message => {
  try {
    if (!message || Object.keys(message).sort().join(",") !== "task,type" ||
        message.type !== "run") throw new TypeError("Invalid worker request");
    const task = validateTasks([message.task])[0];
    parentPort.postMessage({ type:"result", id:task.id, output:hashFold(task) });
  } catch {
    parentPort.postMessage({ type:"invalid" });
  }
});
