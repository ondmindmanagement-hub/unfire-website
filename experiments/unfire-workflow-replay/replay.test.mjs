import test from "node:test";
import assert from "node:assert/strict";
import { replay,sampleWorkflow,validateWorkflow,expectedOutput } from "./replay.mjs";

const sample=()=>sampleWorkflow({groups:4,waitMs:2,cpuRounds:1200});
test("sample creates 16 strictly typed synthetic DAG tasks",()=>{
  const jobs=sample();
  assert.equal(jobs.length,16);
  assert.ok(jobs.every(x=>x.stage&&x.creditUnits===8));
});
test("sequential trace verifies exactly once with explicit retry cost",async()=>{
  const r=await replay(sample(),{lanes:1});
  assert.equal(r.jobs,16);assert.equal(r.verified,16);
  assert.equal(r.retries,1);assert.equal(r.attempts,17);
  assert.equal(r.creditsSpent,136);
  assert.equal(r.maxActive,1);
  assert.ok(r.outputs.every(x=>x.state==="VERIFIED" && /^[0-9a-f]{64}$/.test(x.digest)));
});
test("bounded 2/4/8 async lanes produce the exact same verifiable outputs",async()=>{
  const tasks=sample(),base=await replay(tasks,{lanes:1});
  for(const lanes of [2,4,8]){
    const result=await replay(tasks,{lanes});
    assert.deepEqual(result.outputs,base.outputs);
    assert.equal(result.retries,base.retries);
    assert.equal(result.creditsSpent,base.creditsSpent);
    assert.ok(result.maxActive<=lanes);
  }
});
test("dependency chain only starts after predecessor verification",async()=>{
  const r=await replay(sample(),{lanes:4});
  for(const task of sample()){
    const start=r.events.find(x=>x.taskId===task.id&&x.state==="RUNNING");
    assert.ok(start);
    for(const parent of task.dependsOn){
      const verified=r.events.find(x=>x.taskId===parent&&x.state==="VERIFIED");
      assert.ok(verified);
      assert.ok(verified.sequence<start.sequence);
    }
  }
});
test("8 lanes cannot create more active tasks than currently ready",async()=>{
  const r=await replay(sampleWorkflow({groups:2,waitMs:5,cpuRounds:0,retry:false}),{lanes:8});
  assert.ok(r.maxActive<=2);
});
test("retry is explicitly logged and consumes synthetic credits",async()=>{
  const r=await replay(sample(),{lanes:2});
  const trace=r.events.filter(e=>e.taskId==="g0_draft").map(e=>e.state);
  assert.deepEqual(trace,["RUNNING","RETRY","VERIFIED"]);
  assert.equal(r.creditsSpent,136);
});
test("credit budget below mandatory attempts rejects rather than reporting success",async()=>{
  await assert.rejects(replay(sample(),{lanes:4,creditBudget:80}),{name:"BudgetExceededError"});
});
test("budget exactly sufficient succeeds for all tasks",async()=>{
  const r=await replay(sample(),{lanes:4,creditBudget:136});
  assert.equal(r.verified,16);
  assert.equal(r.creditsSpent,136);
});
test("pre-aborted requests do not schedule tasks",async()=>{
  const c=new AbortController();c.abort();
  await assert.rejects(replay(sample(),{signal:c.signal}),{name:"AbortError"});
});
test("abort during progress callback stops and returns no success",async()=>{
  const c=new AbortController();
  const events=[];
  await assert.rejects(replay(sampleWorkflow({waitMs:30}),{
    lanes:4,signal:c.signal,onEvent:e=>{
      events.push(e);
      if(e.state==="RUNNING"){c.abort();}
    }
  }),{name:"AbortError"});
  assert.ok(events.length>=1);
});
test("invalid callback stops rather than hiding error or granting verified result",async()=>{
  await assert.rejects(replay(sample(),{onEvent:()=>{throw new Error("reporter unavailable");}}),/reporter unavailable/);
});
test("invalid task injection and duplicate IDs are rejected",()=>{
  const list=[...sample()];
  list[0]={...list[0],shell:"rm"};
  assert.throws(()=>validateWorkflow(list),/Invalid/);
  const copy=[...sample()];copy[1]={...copy[1],id:copy[0].id};
  assert.throws(()=>validateWorkflow(copy),/Invalid/);
});
test("cycles and absent dependencies are rejected",()=>{
  const cycle=[...sample()];
  cycle[0]={...cycle[0],dependsOn:["g0_release"]};
  assert.throws(()=>validateWorkflow(cycle),/Cyclic/);
  const missing=[...sample()];
  missing[0]={...missing[0],dependsOn:["missing"]};
  assert.throws(()=>validateWorkflow(missing),/Missing dependency/);
});
test("unexpected operation names cannot be introduced",()=>{
  const list=[...sample()];
  list[0]={...list[0],stage:"pay"};
  assert.throws(()=>validateWorkflow(list),/Invalid/);
});
test("independent verifier rejects missing predecessor evidence",()=>{
  const t=sample().find(x=>x.stage==="audit");
  assert.throws(()=>expectedOutput(t,new Map()),/Unverified dependency evidence/);
});
test("workflow bounds prevent unbounded waits and CPU cost",()=>{
  assert.throws(()=>sampleWorkflow({waitMs:101}),/Invalid/);
  assert.throws(()=>sampleWorkflow({cpuRounds:120001}),/Invalid/);
  assert.throws(()=>sampleWorkflow({groups:7}),/Invalid/);
  assert.throws(()=>sampleWorkflow({groups:-1}),/Invalid/);
});
test("replay rejects unsafe lane counts, costs and options",async()=>{
  await assert.rejects(replay(sample(),{lanes:9}),/limits/);
  await assert.rejects(replay(sample(),{lanes:0}),/limits/);
  await assert.rejects(replay(sample(),{creditBudget:0}),/limits/);
  await assert.rejects(replay(sample(),{onEvent:"bad"}),/event handler/);
});
test("no private payloads or real prices in summary",async()=>{
  const r=await replay(sampleWorkflow({groups:1,waitMs:1}),{lanes:1});
  assert.match(r.disclaimer,/not tokens, invoices or AI model costs/);
  assert.equal(r.outputs.length,4);
  assert.ok(r.events.every(x=>Object.keys(x).sort().join(",")==="sequence,state,taskId"));
});
