/**
 * Unfire OS · offline synthetic workflow trace replay.
 * Async bounded I/O waits are local timers, NOT network or model calls.
 * Credit units are artificial, NOT tokens or money.
 */
import { createHash } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { performance } from "node:perf_hooks";

const ID=/^[a-z][a-z0-9_-]{0,31}$/;
const STAGES=new Set(["retrieve","draft","audit","release"]);
export const MAX_JOBS=24, MAX_LANES=8, MAX_ATTEMPTS=3;
const MAX_CREDITS=50000;
const exact=(obj,keys)=>obj!==null && typeof obj==="object" && !Array.isArray(obj)
  && Object.getPrototypeOf(obj)===Object.prototype
  && Object.keys(obj).sort().join(",")===keys.slice().sort().join(",");
const abortErr=()=>{const e=new Error("Synthetic workflow cancelled");e.name="AbortError";return e;};
export function validateWorkflow(input) {
  if(!Array.isArray(input)||input.length===0||input.length>MAX_JOBS)
    throw new TypeError("Invalid synthetic workflow size");
  const ids=new Set();
  const tasks=input.map(t=>{
    if(!exact(t,["id","stage","dependsOn","waitMs","cpuRounds","creditUnits","failAttempts"])||
      typeof t.id!=="string"||!ID.test(t.id)||ids.has(t.id)||
      !STAGES.has(t.stage)||!Array.isArray(t.dependsOn)||t.dependsOn.length>6||
      t.dependsOn.some(d=>typeof d!=="string"||!ID.test(d))||
      new Set(t.dependsOn).size!==t.dependsOn.length||
      !Number.isSafeInteger(t.waitMs)||t.waitMs<0||t.waitMs>100||
      !Number.isSafeInteger(t.cpuRounds)||t.cpuRounds<0||t.cpuRounds>120000||
      !Number.isSafeInteger(t.creditUnits)||t.creditUnits<1||t.creditUnits>500||
      !Number.isSafeInteger(t.failAttempts)||t.failAttempts<0||t.failAttempts>=MAX_ATTEMPTS)
      throw new TypeError("Invalid bounded workflow task");
    ids.add(t.id);
    return Object.freeze({...t,dependsOn:Object.freeze([...t.dependsOn])});
  });
  const byId=new Map(tasks.map(t=>[t.id,t]));
  for(const task of tasks) for(const dep of task.dependsOn) if(!byId.has(dep))
    throw new TypeError("Missing dependency");
  const visiting=new Set(),visited=new Set();
  const visit=id=>{
    if(visiting.has(id))throw new TypeError("Cyclic dependency");
    if(visited.has(id))return;
    visiting.add(id);
    for(const d of byId.get(id).dependsOn)visit(d);
    visiting.delete(id);visited.add(id);
  };
  for(const task of tasks)visit(task.id);
  return Object.freeze(tasks);
}
function fixedCPU(task) {
  let x=(task.id.length*2654435761+task.creditUnits+task.stage.length)>>>0;
  for(let i=0;i<task.cpuRounds;i++){
    x=(Math.imul(x^(x>>>15),2246822519)+i)>>>0;
    x^=x>>>13;
  }
  return x>>>0;
}
/** A deterministic synthetic stand-in for a quality-checked output, not model quality. */
export function expectedOutput(task,dependencyResults) {
  const parent=task.dependsOn.map(id=>{
    const value=dependencyResults.get(id);
    if(typeof value!=="string" || !/^[0-9a-f]{64}$/.test(value))
      throw new Error("Unverified dependency evidence");
    return [id,value];
  });
  return createHash("sha256").update(
    JSON.stringify([task.id,task.stage,task.cpuRounds,fixedCPU(task),parent])
  ).digest("hex");
}
async function attempt(task,dependencyResults,index,signal) {
  if(signal.aborted)throw abortErr();
  if(task.waitMs>0)await delay(task.waitMs,undefined,{signal});
  if(signal.aborted)throw abortErr();
  const output=expectedOutput(task,dependencyResults);
  if(index<=task.failAttempts)return {ok:false,reason:"synthetic_transient_failure"};
  return {ok:true,output};
}
export function sampleWorkflow({groups=4,waitMs=12,cpuRounds=5000,
  retry=true}={}) {
  if(!Number.isSafeInteger(groups)||groups<1||groups>6||
    !Number.isSafeInteger(waitMs)||waitMs<0||waitMs>100||
    !Number.isSafeInteger(cpuRounds)||cpuRounds<0||cpuRounds>120000||
    typeof retry!=="boolean")throw new TypeError("Invalid sample configuration");
  const tasks=[];
  for(let i=0;i<groups;i++){
    let previous=null;
    for(const stage of ["retrieve","draft","audit","release"]){
      const id="g"+i+"_"+stage;
      tasks.push(Object.freeze({
        id,stage,dependsOn:previous?[previous]:[],waitMs,cpuRounds,
        creditUnits:8,failAttempts:retry&&i===0&&stage==="draft"?1:0
      }));
      previous=id;
    }
  }
  return validateWorkflow(tasks);
}
export async function replay(input,{lanes=1,creditBudget=MAX_CREDITS,
  signal,onEvent}={}) {
  const tasks=validateWorkflow(input);
  if(!Number.isSafeInteger(lanes)||lanes<1||lanes>MAX_LANES||
    !Number.isSafeInteger(creditBudget)||creditBudget<1||
    creditBudget>MAX_CREDITS)throw new TypeError("Invalid replay limits");
  if(signal!==undefined&&(!signal||typeof signal.aborted!=="boolean"||
    typeof signal.addEventListener!=="function"||
    typeof signal.removeEventListener!=="function"))
    throw new TypeError("Invalid AbortSignal");
  if(onEvent!==undefined&&typeof onEvent!=="function")
    throw new TypeError("Invalid event handler");
  if(signal?.aborted)throw abortErr();
  const controller=new AbortController();
  const abort=()=>controller.abort();
  signal?.addEventListener("abort",abort,{once:true});
  if(signal?.aborted)controller.abort();
  const states=new Map(tasks.map(t=>[t.id,"PENDING"]));
  const results=new Map(), attempts=new Map(tasks.map(t=>[t.id,0]));
  const events=[];
  let creditsSpent=0,maxActive=0,active=0,retries=0,firstError=null;
  const started=performance.now();
  const emit=(taskId,state)=>{
    const event=Object.freeze({sequence:events.length+1,taskId,state});
    events.push(event);
    onEvent?.(event);
  };
  const nextTask=()=>{
    for(const task of tasks) if(states.get(task.id)==="PENDING" &&
      task.dependsOn.every(dep=>states.get(dep)==="VERIFIED")){
      states.set(task.id,"CLAIMED");return task;
    }
    return null;
  };
  const runLane=async()=>{
    while(!controller.signal.aborted){
      const task=nextTask();
      if(!task)return;
      active++;maxActive=Math.max(maxActive,active);
      try {
        states.set(task.id,"RUNNING");emit(task.id,"RUNNING");
        let verified=false;
        const depSnapshot=new Map(results);
        for(let n=1;n<=MAX_ATTEMPTS;n++){
          if(controller.signal.aborted)throw abortErr();
          if(creditsSpent+task.creditUnits>creditBudget){
            const e=new Error("Synthetic credit budget exceeded");e.name="BudgetExceededError";throw e;
          }
          creditsSpent+=task.creditUnits;
          attempts.set(task.id,n);
          const evidence=await attempt(task,depSnapshot,n,controller.signal);
          if(!evidence.ok){
            if(n<MAX_ATTEMPTS){retries++;emit(task.id,"RETRY");continue;}
            break;
          }
          // Recalculate independently. Equality proves toy value only.
          if(evidence.output!==expectedOutput(task,depSnapshot))
            throw new Error("Synthetic evidence mismatch");
          if(controller.signal.aborted)throw abortErr();
          results.set(task.id,evidence.output);
          states.set(task.id,"VERIFIED");
          emit(task.id,"VERIFIED");
          verified=true;break;
        }
        if(!verified)throw new Error("Synthetic attempt budget exhausted");
      }catch(e){
        if(!firstError)firstError=e;
        states.set(task.id,"FAILED");
        controller.abort();
      }finally{active--;}
    }
  };
  try{
    await Promise.all(Array.from({length:Math.min(lanes,tasks.length)},runLane));
    if(firstError)throw firstError;
    if(controller.signal.aborted)throw abortErr();
    if(results.size!==tasks.length)throw new Error("Incomplete synthetic workflow");
    return Object.freeze({
      lanes,jobs:tasks.length,verified:results.size,
      attempts:[...attempts.values()].reduce((a,b)=>a+b,0),
      retries,creditsSpent,maxActive,
      elapsedMs:performance.now()-started,
      outputs:Object.freeze(tasks.map(t=>Object.freeze({id:t.id,state:states.get(t.id),digest:results.get(t.id)}))),
      events:Object.freeze(events),
      disclaimer:"Simulated I/O wait using local timers. Credits are invented units, not tokens, invoices or AI model costs."
    });
  }finally{
    controller.abort();
    signal?.removeEventListener("abort",abort);
  }
}
