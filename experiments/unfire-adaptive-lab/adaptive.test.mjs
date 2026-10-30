import test from "node:test";
import assert from "node:assert/strict";
import { sampleTasks } from "../unfire-concurrency-lab/compute.mjs";
import { taskSignature, expectedDigest, decide } from "./decision.mjs";
import { calibrate, runAdaptive } from "./adaptive.mjs";

const tasks=()=>sampleTasks(6,4000);
function profileFor(input,medians={sequential:100,"1":75,"2":65,"4":64,"8":63}){
  const resultDigest=expectedDigest(input),verified=input.length;
  return {
    version:1,signature:taskSignature(input),
    samples:Object.fromEntries(Object.entries(medians).map(([mode,ms])=>
      [mode,Array.from({length:3},(_,n)=>({elapsedMs:ms+n%2,verified,resultDigest}))]))
  };
}
test("hash fingerprint is reproducible and detects change",()=>{
  assert.equal(taskSignature(tasks()),taskSignature(tasks()));
  assert.notEqual(taskSignature(tasks()),taskSignature(sampleTasks(6,4001)));
  assert.equal(expectedDigest(tasks()),expectedDigest(tasks()));
});
test("no profile chooses sequential default",()=>{
  const result=decide(tasks());
  assert.equal(result.mode,"sequential");
  assert.equal(result.reason,"missing_or_incompatible_evidence");
});
test("valid strongly faster 2-lane profile selects 2, near ties favor fewer lanes",()=>{
  const choice=decide(tasks(),profileFor(tasks()));
  assert.equal(choice.mode,"2");
  assert.equal(choice.lanes,2);
  assert.equal(choice.profileTrusted,false);
});
test("faster than 2 lanes by sufficient margin selects 4",()=>{
  const choice=decide(tasks(),profileFor(tasks(),{sequential:100,"1":78,"2":75,"4":55,"8":54}));
  assert.equal(choice.mode,"4");
});
test("insufficient relative speedup chooses sequential",()=>{
  const result=decide(tasks(),profileFor(tasks(),{sequential:100,"2":90}));
  assert.equal(result.mode,"sequential");
});
test("insufficient absolute speedup chooses sequential",()=>{
  const result=decide(tasks(),profileFor(tasks(),{sequential:10,"2":7}));
  assert.equal(result.mode,"sequential");
});
test("stale or mismatched workload profile always falls back",()=>{
  const wrong=profileFor(sampleTasks(6,4001));
  assert.equal(decide(tasks(),wrong).mode,"sequential");
  assert.equal(decide(tasks(),{...profileFor(tasks()),signature:"wrong"}).mode,"sequential");
});
test("corrupt evidence never enables concurrency",()=>{
  const corrupted=profileFor(tasks());
  corrupted.samples.sequential[1].resultDigest="corrupt";
  assert.equal(decide(tasks(),corrupted).mode,"sequential");
  const bad=profileFor(tasks());
  bad.samples["2"][0].verified=0;
  assert.equal(decide(tasks(),bad).mode,"1");
});
test("nonnumeric, negative, and missing trials fail closed",()=>{
  for(const invalid of [-1,0,Infinity,NaN,"3"]){
    const p=profileFor(tasks());
    p.samples["2"][0].elapsedMs=invalid;
    const decision=decide(tasks(),p);
    assert.notEqual(decision.mode,"2");
  }
  const p=profileFor(tasks());
  p.samples.sequential.pop();
  assert.equal(decide(tasks(),p).mode,"sequential");
});
test("unexpected profile fields cannot enable workers",()=>{
  const p=profileFor(tasks());p.credential="x";
  assert.equal(decide(tasks(),p).mode,"sequential");
  const p2=profileFor(tasks());p2.samples["16"]=p2.samples["8"];
  assert.equal(decide(tasks(),p2).mode,"sequential");
});
test("invalid thresholds rejected rather than silently loosening",()=>{
  assert.throws(()=>decide(tasks(),profileFor(tasks()),{minRelative:-1}),/selection threshold/);
  assert.throws(()=>decide(tasks(),profileFor(tasks()),{minAbsoluteMs:Infinity}),/selection threshold/);
});
test("explicit calibration on tiny fixed workload yields valid local profile",async()=>{
  const work=sampleTasks(4,1000);
  const result=await calibrate(work,{repeats:3,modes:["sequential","1","2"]});
  assert.equal(result.profile.signature,taskSignature(work));
  for(const mode of ["sequential","1","2"]){
    assert.equal(result.profile.samples[mode].length,3);
    assert.ok(result.profile.samples[mode].every(x=>x.verified===4));
  }
  const decision=decide(work,result.profile);
  assert.ok(["sequential","1","2"].includes(decision.mode));
});
test("adapted run with no profile verifies all tasks sequentially",async()=>{
  const r=await runAdaptive(tasks());
  assert.equal(r.executionMode,"sequential");
  assert.equal(r.verified,6);
  assert.equal(r.outputs.length,6);
});
test("adapted run with valid synthetic evidence can use threads",async()=>{
  const r=await runAdaptive(tasks(),{profile:profileFor(tasks())});
  assert.equal(r.executionMode,"2");
  assert.equal(r.verified,6);
  assert.ok(r.outputs.every(x=>x.state==="VERIFIED"));
});
test("already aborted signal prevents adaptation or execution",async()=>{
  const abort=new AbortController();abort.abort();
  await assert.rejects(runAdaptive(tasks(),{signal:abort.signal}),{name:"AbortError"});
  await assert.rejects(calibrate(tasks(),{signal:abort.signal}),{name:"AbortError"});
});
test("synthetic run cancellation does not fall back silently to success",async()=>{
  const abort=new AbortController();
  await assert.rejects(runAdaptive(tasks(),{
    profile:profileFor(tasks()),signal:abort.signal,
    onProgress:e=>{if(e.state==="RUNNING")abort.abort();}
  }),{name:"AbortError"});
});
test("calibration validates bounds and never accepts arbitrary modes",async()=>{
  await assert.rejects(calibrate(tasks(),{repeats:1}),/calibration plan/);
  await assert.rejects(calibrate(tasks(),{modes:["8"]}),/calibration plan/);
  await assert.rejects(calibrate(tasks(),{modes:["sequential","16"]}),/calibration plan/);
  await assert.rejects(calibrate(tasks(),{modes:["sequential","sequential"]}),/calibration plan/);
});
test("calibration outcomes are not presented as authenticated evidence",async()=>{
  const result=await calibrate(sampleTasks(2,1000),{modes:["sequential"],repeats:3});
  assert.match(result.disclaimer,/never authenticated real AI performance/);
  assert.equal(decide(sampleTasks(2,1000),result.profile).profileTrusted,false);
});
