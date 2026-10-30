/**
 * Explicit microbenchmark with 3 different synthetic CPU task sizes.
 * Worker setup, message passing and verification are included.
 * This benchmark is exploratory. It never contacts AI APIs or system accounts.
 */
import { sampleTasks } from "../unfire-concurrency-lab/compute.mjs";
import { calibrate, runAdaptive } from "./adaptive.mjs";
import { decide } from "./decision.mjs";

const scenarios=[
  {label:"tiny",jobs:24,rounds:4000},
  {label:"medium",jobs:24,rounds:60000},
  {label:"bounded_large",jobs:24,rounds:150000}
];
const values=[];
for(const config of scenarios){
  const tasks=sampleTasks(config.jobs,config.rounds);
  const observed=await calibrate(tasks,{repeats:3,
    modes:["sequential","1","2","4","8"],taskTimeoutMs:10000});
  const decision=decide(tasks,observed.profile);
  const run=await runAdaptive(tasks,{profile:observed.profile,taskTimeoutMs:10000});
  if(run.verified!==tasks.length || run.executionMode!==decision.mode)
    throw new Error("Adaptive research verification failed");
  values.push({
    workload:config,calibrationMs:Number(observed.calibrationMs.toFixed(2)),
    medianMs:Object.fromEntries(Object.entries(observed.profile.samples).map(
      ([mode,samples])=>[mode,Number([...samples].map(s=>s.elapsedMs)
       .sort((a,b)=>a-b)[Math.floor(samples.length/2)].toFixed(2))])),
    decision:decision.mode,reason:decision.reason,
    delivered:run.verified
  });
}
console.log(JSON.stringify({
  study:"Unfire adaptive scheduler research",
  node:process.version,platform:process.platform,arch:process.arch,
  values,
  disclaimer:"Three exploratory repeats per synthetic CPU workload, with cold thread startup and local recomputation. Not real AI/model agents, provider latency, thermal, token, production cost or long-run performance."
},null,2));
