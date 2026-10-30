import test from "node:test";
import assert from "node:assert/strict";
import { sampleTasks, validateTasks, hashFold } from "./compute.mjs";
import { runSequential, runThreaded } from "./pool.mjs";

const tiny=()=>sampleTasks(7,10000);
test("bounded synthetic workload is deterministic",()=>{
  const tasks=tiny();
  assert.deepEqual(tasks,sampleTasks(7,10000));
  assert.equal(hashFold(tasks[0]),hashFold(tasks[0]));
});
test("sequential reference completes and locally verifies",()=>{
  const result=runSequential(tiny());
  assert.equal(result.verified,7);
  assert.ok(result.outputs.every(x=>x.state==="VERIFIED"));
});
test("one actual worker thread matches sequential verified outputs",async()=>{
  const tasks=tiny(),expected=runSequential(tasks);
  const actual=await runThreaded(tasks,{lanes:1});
  assert.equal(actual.mode,"worker_threads");
  assert.equal(actual.verified,7);
  assert.deepEqual(actual.outputs,expected.outputs);
});
test("2, 4 and 8 worker lanes verify the same results",async()=>{
  const tasks=sampleTasks(12,16000),expected=runSequential(tasks).outputs;
  for (const lanes of [2,4,8]){
    const actual=await runThreaded(tasks,{lanes});
    assert.deepEqual(actual.outputs,expected);
    assert.equal(actual.verified,12);
  }
});
test("verified status cannot precede evidence and running",async()=>{
  const states=[];
  await runThreaded(sampleTasks(3,1500),{lanes:2,onProgress:e=>states.push(e)});
  for(const task of sampleTasks(3,1500)){
    assert.deepEqual(states.filter(x=>x.id===task.id).map(x=>x.state),
      ["RUNNING","EVIDENCE_READY","VERIFIED"]);
  }
});
test("only one allowlisted operation and exact input shape accepted",()=>{
  assert.throws(()=>validateTasks([{id:"demo",operation:"shell.exec",rounds:3,salt:1}]),/Invalid/);
  assert.throws(()=>validateTasks([{id:"demo",operation:"synthetic.hashFold",rounds:3,salt:1,secret:"x"}]),/Invalid/);
});
test("duplicate task IDs rejected",()=>{
  const task={id:"demo",operation:"synthetic.hashFold",rounds:30,salt:1};
  assert.throws(()=>validateTasks([task,task]),/duplicate/);
});
test("worker task budget and round budget remain bounded",()=>{
  assert.throws(()=>sampleTasks(33,10),/Invalid/);
  assert.throws(()=>sampleTasks(1,150001),/Invalid/);
  assert.throws(()=>sampleTasks(0,10),/Invalid/);
});
test("invalid lanes, timeouts and callback options rejected",async()=>{
  await assert.rejects(runThreaded(tiny(),{lanes:9}),/pool options/);
  await assert.rejects(runThreaded(tiny(),{taskTimeoutMs:10}),/pool options/);
  await assert.rejects(runThreaded(tiny(),{onProgress:"unsafe"}),/reporter/);
});
test("already-aborted request never launches a worker",async()=>{
  const abort=new AbortController();abort.abort();
  await assert.rejects(runThreaded(tiny(),{signal:abort.signal}),{name:"AbortError"});
});
test("mid-run STOP cancels, cleans up and refuses a verified success report",async()=>{
  const abort=new AbortController();
  let events=0;
  await assert.rejects(runThreaded(sampleTasks(12,15000),{
    lanes:4,signal:abort.signal,
    onProgress:e=>{events++;if(e.state==="RUNNING")abort.abort();}
  }),{name:"AbortError"});
  assert.ok(events>=1);
});
test("callback errors fail closed",async()=>{
  await assert.rejects(runThreaded(tiny(),{
    onProgress:()=>{throw new Error("reporter failed");}
  }),/reporter failed/);
});
test("fresh run after cancellation completes with all outputs verified",async()=>{
  const r=await runThreaded(sampleTasks(4,6000),{lanes:2});
  assert.equal(r.verified,4);
});
