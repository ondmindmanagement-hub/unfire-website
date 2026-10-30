/**
 * Offline-only empirical selection for one fixed synthetic CPU operation.
 * Calibration is explicit. Nothing here adapts a customer task or starts AI agents.
 */
import { createHash } from "node:crypto";
import { performance } from "node:perf_hooks";
import { validateTasks } from "../unfire-concurrency-lab/compute.mjs";
import { runSequential, runThreaded } from "../unfire-concurrency-lab/pool.mjs";
import { MODES, decide, expectedDigest, taskSignature } from "./decision.mjs";

function abortError() {
  const error=new Error("Research run cancelled");error.name="AbortError";return error;
}
function validateSignal(signal) {
  if(signal!==undefined && (!signal ||
    typeof signal.aborted!=="boolean" ||
    typeof signal.addEventListener!=="function" ||
    typeof signal.removeEventListener!=="function"))
    throw new TypeError("Invalid AbortSignal");
}
function digestOutputs(actual,tasks) {
  if(!actual || actual.verified!==tasks.length ||
     !Array.isArray(actual.outputs) || actual.outputs.length!==tasks.length ||
     actual.outputs.some((o,i)=>!o || o.state!=="VERIFIED" || o.id!==tasks[i].id ||
       !Number.isSafeInteger(o.output) || o.output<0 || o.output>0xffffffff))
    throw new Error("Unverified synthetic result");
  return createHash("sha256").update(
    JSON.stringify(actual.outputs.map(x=>[x.id,x.output]))
  ).digest("hex");
}
async function execute(tasks,mode,{signal,taskTimeoutMs,onProgress}={}) {
  if(signal?.aborted) throw abortError();
  const actual=mode==="sequential" ? runSequential(tasks) :
    await runThreaded(tasks,{lanes:Number(mode),taskTimeoutMs,signal,onProgress});
  if(signal?.aborted) throw abortError();
  if(digestOutputs(actual,tasks)!==expectedDigest(tasks))
    throw new Error("Verification mismatch");
  return actual;
}
export async function calibrate(input,{repeats=3,modes=MODES,
  signal,taskTimeoutMs=5000}={}) {
  const tasks=validateTasks(input);
  validateSignal(signal);
  if(!Number.isSafeInteger(repeats)||repeats<3||repeats>5 ||
     !Array.isArray(modes)||modes.length<1||modes.length>5 ||
     modes.some(m=>!MODES.includes(m))||new Set(modes).size!==modes.length ||
     !modes.includes("sequential"))
    throw new TypeError("Invalid bounded calibration plan");
  const expected=expectedDigest(tasks), samples={};
  const started=performance.now();
  for(const mode of modes){
    samples[mode]=[];
    for(let trial=0;trial<repeats;trial++){
      if(signal?.aborted)throw abortError();
      const tick=performance.now();
      const outcome=await execute(tasks,mode,{signal,taskTimeoutMs});
      const elapsedMs=performance.now()-tick;
      const digest=digestOutputs(outcome,tasks);
      if(digest!==expected)throw new Error("Calibration result mismatch");
      samples[mode].push(Object.freeze({
        elapsedMs, verified:tasks.length,resultDigest:digest
      }));
    }
  }
  return Object.freeze({
    profile:Object.freeze({version:1,signature:taskSignature(tasks),samples}),
    calibrationMs:performance.now()-started,
    disclaimer:"Synthetic local empirical timing only, never authenticated real AI performance."
  });
}
export async function runAdaptive(input,{profile,signal,taskTimeoutMs=5000,
  onProgress}={}) {
  const tasks=validateTasks(input);
  validateSignal(signal);
  const choice=decide(tasks,profile);
  // A missing or invalid research profile always selects the low-overhead baseline.
  const outcome=await execute(tasks,choice.mode,{signal,taskTimeoutMs,onProgress});
  return Object.freeze({
    decision:choice,
    verified:outcome.verified,
    outputs:outcome.outputs,
    executionMode:choice.mode,
    disclaimer:"Fixed synthetic tasks only, no real AI models, external side effects or distributed proof."
  });
}
