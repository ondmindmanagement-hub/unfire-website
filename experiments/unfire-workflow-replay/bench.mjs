/**
 * Balanced, warm-up-aware offline workflow replay benchmark.
 * Waiting is a local timer, not a network or AI request.
 * All synthetic credit units are illustrative, not monetary costs.
 */
import { replay,sampleWorkflow } from "./replay.mjs";
const cases=[
  {name:"waiting_dominated",config:{groups:4,waitMs:18,cpuRounds:1000,retry:true}},
  {name:"mixed",config:{groups:4,waitMs:8,cpuRounds:25000,retry:true}},
  {name:"cpu_dominated",config:{groups:4,waitMs:0,cpuRounds:90000,retry:true}}
];
const modes=[1,2,4,8];
const orders=[[1,2,4,8],[2,8,1,4],[4,1,8,2],[8,4,2,1]];
const median=a=>{
  const sorted=[...a].sort((x,y)=>x-y),mid=sorted.length/2;
  return (sorted[mid-1]+sorted[mid])/2;
};
const round=n=>Number(n.toFixed(2));
const output=[];
for(const scenario of cases){
  const tasks=sampleWorkflow(scenario.config),sign=JSON.stringify(tasks);
  const measurements=new Map(modes.map(lanes=>[lanes,[]]));
  const creditMap=new Map(), activeMap=new Map();
  let reference=null;
  const validateRun=(run,lanes)=>{
    if(JSON.stringify(tasks)!==sign||run.verified!==tasks.length)
      throw new Error("Synthetic benchmark workload changed or failed verification");
    const outputs=JSON.stringify(run.outputs);
    if(reference!==null&&reference!==outputs)throw new Error("Different verified outputs");
    reference=outputs;
    if(creditMap.has(lanes)&&creditMap.get(lanes)!==run.creditsSpent)
      throw new Error("Different synthetic credits across trials");
    creditMap.set(lanes,run.creditsSpent);
    activeMap.set(lanes,Math.max(run.maxActive,activeMap.get(lanes)??0));
  };
  // Warm each configuration before timings to reduce Node/JIT ordering bias.
  for(const lanes of modes)validateRun(await replay(tasks,{lanes}),lanes);
  for(const order of orders){
    for(const lanes of order){
      const run=await replay(tasks,{lanes});
      validateRun(run,lanes);
      measurements.get(lanes).push(run.elapsedMs);
    }
  }
  const referenceCredits=creditMap.get(1);
  if([...creditMap.values()].some(x=>x!==referenceCredits))
    throw new Error("Synthetic costs differ across concurrency lanes");
  const byLane=modes.map(lanes=>({
    lanes,
    measurementsMs:measurements.get(lanes).map(round),
    medianMs:round(median(measurements.get(lanes))),
    verifiedPerRun:tasks.length,
    retriesPerRun:tasks.reduce((n,t)=>n+t.failAttempts,0),
    syntheticCreditUnitsPerRun:creditMap.get(lanes),
    maxObservedActive:activeMap.get(lanes)
  }));
  const fastest=byLane.reduce((best,item)=>item.medianMs<best.medianMs?item:best);
  output.push({
    scenario:scenario.name,waitMsPerTask:scenario.config.waitMs,
    cpuRoundsPerTask:scenario.config.cpuRounds,jobs:tasks.length,
    results:byLane,fastestObserved:fastest.lanes,
    caveat:scenario.config.waitMs===0
      ?"All CPU work executes on one JavaScript event loop. Any timing difference is overhead/JIT/timing noise, NOT CPU parallelism."
      :"Local timers permit overlapped waiting, not real model/HTTP I/O or independently running agents."
  });
}
console.log(JSON.stringify({
  study:"Unfire OS synthetic workflow replay, warmed and balanced",
  node:process.version,platform:process.platform,arch:process.arch,
  warmupPerLane:1,repeatsPerLane:orders.length,balancedOrders:orders,
  output,
  limitations:"Exploratory timer-based DAG replay, no actual AI agents, model results, network, tokens, dollar cost, CPU parallelism or production throughput. Real user workload testing remains required."
},null,2));
