/** Repeated lightweight benchmark: measures only a bounded synthetic CPU task. */
import { performance } from "node:perf_hooks";
import { sampleTasks } from "./compute.mjs";
import { runSequential, runThreaded } from "./pool.mjs";
const tasks=sampleTasks(24,90000);
const repeats=3;
const median=values=>{
  const sorted=[...values].sort((a,b)=>a-b);
  return sorted[Math.floor(sorted.length/2)];
};
const results=[];
for(const lanes of [0,1,2,4,8]){
  const times=[],outputs=[];
  for(let i=0;i<repeats;i++){
    const start=performance.now();
    const r=lanes===0?runSequential(tasks):
      await runThreaded(tasks,{lanes,taskTimeoutMs:10000});
    times.push(performance.now()-start);
    if(r.verified!==tasks.length)throw new Error("Unverified task in measurement");
    outputs.push(r.outputs.map(x=>[x.id,x.output]));
  }
  if(outputs.some(x=>JSON.stringify(x)!==JSON.stringify(outputs[0])))
    throw new Error("Inconsistent synthetic output across runs");
  results.push({lanes:lanes===0?"sequential":lanes,measurementsMs:times.map(x=>Number(x.toFixed(2))),medianMs:Number(median(times).toFixed(2)),verified:tasks.length});
}
const expected=JSON.stringify(outputs);
console.log(JSON.stringify({
  label:"Unfire OS research · synthetic Node worker_threads",
  workload:{jobs:tasks.length,roundsPerJob:90000,repeats},
  node:process.version,platform:process.platform,arch:process.arch,
  results, disclaimer:"Specific bounded CPU kernel with in-process verification and worker startup. No model/AI latency, product speedup, agent quality or cross-device conclusion."
},null,2));
