/**
 * Real node:worker_threads for FIXED, synthetic, bounded CPU tasks only.
 * This demonstrates concurrency, not AI agents, OS sandboxing, or secure identities.
 */
import { Worker } from "node:worker_threads";
import { performance } from "node:perf_hooks";
import { hashFold, validateTasks } from "./compute.mjs";

const LANES = Object.freeze([1,2,4,8]);
function controls(lanes, taskTimeoutMs, signal) {
  if (!LANES.includes(lanes) || !Number.isSafeInteger(taskTimeoutMs) ||
      taskTimeoutMs < 100 || taskTimeoutMs > 30000)
    throw new TypeError("Invalid bounded pool options");
  if (signal !== undefined && (!signal || typeof signal.addEventListener !== "function" ||
      typeof signal.removeEventListener !== "function" || typeof signal.aborted !== "boolean"))
    throw new TypeError("Invalid abort signal");
}
function cancelled() { const error=new Error("Work cancelled");error.name="AbortError";return error; }
function summary(tasks, states, elapsedMs, lanes) {
  const verified = states.filter(x=>x.state==="VERIFIED").length;
  return Object.freeze({
    mode:lanes===0?"sequential":"worker_threads",
    lanes, tasks:tasks.length, verified, elapsedMs,
    outputs:Object.freeze(states.map(x=>Object.freeze({...x}))),
    note:"Synthetic CPU workload only. No AI-agent or OS performance claim."
  });
}
export function runSequential(input) {
  const tasks=validateTasks(input), states=[];
  const start=performance.now();
  for (const task of tasks) {
    const output=hashFold(task);
    if (output!==hashFold(task)) throw new Error("Local verification failed");
    states.push({id:task.id,state:"VERIFIED",output});
  }
  return summary(tasks,states,performance.now()-start,0);
}
export async function runThreaded(input,{lanes=2,taskTimeoutMs=5000,signal,onProgress}={}) {
  controls(lanes,taskTimeoutMs,signal);
  if (onProgress!==undefined && typeof onProgress!=="function")
    throw new TypeError("Invalid progress reporter");
  const tasks=validateTasks(input);
  if (signal?.aborted) throw cancelled();
  const start=performance.now(), workers=[], results=new Array(tasks.length);
  let next=0, finished=0, settled=false;
  let resolveMain, rejectMain;
  const done=new Promise((resolve,reject)=>{resolveMain=resolve;rejectMain=reject;});
  const emit=(id,state)=>{
    onProgress?.(Object.freeze({id,state}));
  };
  const fail=(error)=>{
    if(settled) return;
    settled=true;
    rejectMain(error);
  };
  const complete=()=>{
    if(!settled && finished===tasks.length){
      settled=true;
      resolveMain(summary(tasks,results,performance.now()-start,lanes));
    }
  };
  const slots=Math.min(lanes,tasks.length);
  const abort=()=>fail(cancelled());
  signal?.addEventListener("abort",abort,{once:true});
  try {
    for(let s=0;s<slots&&!settled;s++){
      const worker=new Worker(new URL("./thread-worker.mjs",import.meta.url),{
        resourceLimits:{maxOldGenerationSizeMb:32,maxYoungGenerationSizeMb:8},
        execArgv:[]
      });
      const slot={worker,active:null,timer:null};
      workers.push(slot);
      const clear=()=>{if(slot.timer!==null){clearTimeout(slot.timer);slot.timer=null;}};
      const dispatch=()=>{
        if(settled || slot.active!==null || next>=tasks.length) return;
        const index=next++,task=tasks[index];
        slot.active=index;
        try { emit(task.id,"RUNNING"); }
        catch(e){ fail(e); return; }
        // An AbortSignal can fire synchronously from the progress callback.
        if(settled) return;
        slot.timer=setTimeout(()=>fail(new Error("Synthetic task timed out")),taskTimeoutMs);
        worker.postMessage({type:"run",task});
      };
      worker.on("online",dispatch);
      worker.on("message",message=>{
        if(settled) return;
        const index=slot.active;
        if(index===null || !message || message.type!=="result" ||
           message.id!==tasks[index].id || !Number.isSafeInteger(message.output) ||
           message.output<0 || message.output>0xffffffff) {
          fail(new Error("Invalid worker response"));return;
        }
        clear();
        try {
          emit(message.id,"EVIDENCE_READY");
          // Recompute on coordinator; worker's statement is not trusted.
          if(message.output!==hashFold(tasks[index])) throw new Error("Worker evidence mismatch");
          results[index]={id:tasks[index].id,state:"VERIFIED",output:message.output};
          finished++;
          slot.active=null;
          emit(message.id,"VERIFIED");
          if(finished===tasks.length) complete();
          else dispatch();
        }catch(e){fail(e);}
      });
      worker.on("error",fail);
      worker.on("exit",code=>{
        clear();
        if(!settled) fail(new Error("Worker exited before verification: "+code));
      });
    }
    return await done;
  } finally {
    signal?.removeEventListener("abort",abort);
    for(const slot of workers){
      if(slot.timer!==null) clearTimeout(slot.timer);
    }
    await Promise.allSettled(workers.map(slot=>slot.worker.terminate()));
  }
}
