/**
 * Offline synthetic workflow shape benchmark.
 * Each scenario reuses exactly the same DAG, seeds and correctness checks.
 */
import { replay,sampleWorkflow } from "./replay.mjs";
const cases=[
  {name:"waiting_dominated",config:{groups:4,waitMs:18,cpuRounds:1000,retry:true}},
  {name:"mixed",config:{groups:4,waitMs:8,cpuRounds:25000,retry:true}},
  {name:"cpu_dominated",config:{groups:4,waitMs:0,cpuRounds:90000,retry:true}}
];
const repeats=3;
const median=a=>[...a].sort((x,y)=>x-y)[Math.floor(a.length/2)];
const output=[];
for(const scenario of cases){
  const tasks=sampleWorkflow(scenario.config),byLane=[],sig=JSON.stringify(tasks);
  let reference=null;
  for(const lanes of [1,2,4,8]){
    const readings=[],quality=[],costs=[],maxActive=[];
    for(let trial=0;trial<repeats;trial++){
      if(JSON.stringify(tasks)!==sig)throw new Error("Input changed during benchmark");
      const run=await replay(tasks,{lanes,creditBudget:50000});
      if(run.verified!==tasks.length)throw new Error("Unverified result");
      const outputs=JSON.stringify(run.outputs);
      if(reference!==null&&reference!==outputs)throw new Error("Output mismatch across lanes");
      reference=outputs;
      readings.push(run.elapsedMs);quality.push(run.verified/tasks.length);
      costs.push(run.creditsSpent);maxActive.push(run.maxActive);
    }
    if(new Set(costs).size!==1)throw new Error("Inconsistent synthetic credit count");
    byLane.push({
      lanes,
      measurementsMs:readings.map(x=>Number(x.toFixed(2))),
      medianMs:Number(median(readings).toFixed(2)),
      verifiedPerRun:tasks.length,
      retriesPerRun:tasks.reduce((n,t)=>n+t.failAttempts,0),
      syntheticCreditUnitsPerRun:costs[0],
      maxObservedActive:Math.max(...maxActive)
    });
  }
  const sequential=byLane[0].medianMs;
  output.push({scenario:scenario.name,waitMsPerTask:scenario.config.waitMs,
    cpuRoundsPerTask:scenario.config.cpuRounds,jobs:tasks.length,
    results:byLane,
    fastestObserved:byLane.reduce((best,x)=>x.medianMs<best.medianMs?x:best).lanes,
    disclaimer:"Sequential and async lanes only; local timers imitate waiting, not network or model calls. All synthetic credits are invented, not token pricing."
  });
}
console.log(JSON.stringify({study:"Unfire OS synthetic workflow replay",
  node:process.version,platform:process.platform,arch:process.arch,
  repeats,output,
  limitations:"Exploratory 3-repeat run, timer jitter, no actual AI agents, network, model outputs, external cost or CPU parallelism. Workload shapes only."},null,2));
