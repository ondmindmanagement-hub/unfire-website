import test from "node:test";
import assert from "node:assert/strict";
import { ALLOWED_MODEL,FIXTURES,FIXTURE_IDS,fixtureById,evaluateAnswer } from "./fixtures.mjs";
import { LOOPBACK_URL,LocalQualitySession,evaluateAll } from "./local-adapter.mjs";
const sampleResponse=(answer,extra={})=>({ok:true,json:async()=>({response:answer,done:true,eval_count:6,total_duration:123456,...extra})});
const allowed=fetchFn=>new LocalQualitySession({explicitlyApproved:true,fetchFn});
test("allowlisted fixtures contain no personal or free-form input fields",()=>{
  assert.equal(FIXTURES.length,3);
  assert.deepEqual(FIXTURE_IDS,["arithmetic","code_uppercase","json_format"]);
  assert.ok(FIXTURES.every(x=>!Object.hasOwn(x,"secret")));
});
test("fixture IDs cannot request arbitrary prompt content",()=>{
  assert.throws(()=>fixtureById("my_secret_prompt"),/Only synthetic/);
  assert.throws(()=>fixtureById({prompt:"hello"}),/Invalid fixture/);
});
test("arithmetic evaluator passes only strict output",()=>{
  assert.equal(evaluateAnswer(FIXTURES[0],"42\n").passed,true);
  assert.equal(evaluateAnswer(FIXTURES[0],"41").passed,false);
  assert.equal(evaluateAnswer(FIXTURES[0],"The answer is 42").passed,false);
});
test("code evaluator demands exact uppercase output",()=>{
  assert.equal(evaluateAnswer(FIXTURES[1],"AX-7B").passed,true);
  assert.equal(evaluateAnswer(FIXTURES[1],"ax-7b").passed,false);
});
test("JSON evaluator accepts only valid typed keys",()=>{
  assert.equal(evaluateAnswer(FIXTURES[2],'{"count":3,"ok":true}').passed,true);
  for(const output of ['{"ok":"true","count":3}','{"ok":true,"count":3,"extra":1}',"not JSON",'{}'])
    assert.equal(evaluateAnswer(FIXTURES[2],output).passed,false);
});
test("unapproved fixture or oversized model output rejected",()=>{
  assert.throws(()=>evaluateAnswer({kind:"exact",expected:"42"},"42"),/Invalid/);
  assert.throws(()=>evaluateAnswer(FIXTURES[0],"x".repeat(2049)),/Invalid/);
});
test("default rejects model requests before fetch",()=>{
  assert.throws(()=>new LocalQualitySession(),/denied by default/);
});
test("cloud, external IP and unexpected port refused",()=>{
  for(const endpoint of ["https://api.openai.com/v1","http://localhost:11434/api/generate","http://127.0.0.1:11500/api/generate","http://127.0.0.1:11499/evil"]){
    assert.throws(()=>new LocalQualitySession({explicitlyApproved:true,endpoint}),/denied by default/);
  }
});
test("unapproved model and oversized timeout denied",()=>{
  assert.throws(()=>new LocalQualitySession({explicitlyApproved:true,model:"qwen2.5:7b"}),/denied by default/);
  assert.throws(()=>new LocalQualitySession({explicitlyApproved:true,timeoutMs:99999}),/denied by default/);
});
test("local request is deterministic and bounded",async()=>{
  let calls=0;
  const session=allowed(async (url,options)=>{
    calls++;
    assert.equal(url,LOOPBACK_URL);
    assert.equal(options.method,"POST");
    assert.equal(options.redirect,"error");
    const body=JSON.parse(options.body);
    assert.equal(body.model,ALLOWED_MODEL);
    assert.equal(body.stream,false);
    assert.equal(body.keep_alive,0);
    assert.equal(body.options.num_predict,48);
    assert.equal(body.options.temperature,0);
    assert.deepEqual(Object.keys(body).sort(),["keep_alive","model","options","prompt","stream"]);
    return sampleResponse("42");
  });
  const r=await session.run("arithmetic");
  assert.equal(calls,1);assert.equal(r.passed,true);
  assert.equal(r.providerCostUsd,0);assert.equal(r.origin,"local_only");
});
test("exactly three attempts allowed and fourth refused",async()=>{
  let calls=0;
  const session=allowed(async ()=>{calls++;return sampleResponse("42")});
  for(let i=0;i<3;i++)await session.run("arithmetic");
  await assert.rejects(session.run("arithmetic"),/budget exhausted/);
  assert.equal(session.used,3);assert.equal(calls,3);
});
test("failed calls consume budget and never auto retry",async()=>{
  let calls=0;
  const session=allowed(async ()=>{calls++;throw new Error("local model offline")});
  await assert.rejects(session.run("arithmetic"),/local model offline/);
  assert.equal(calls,1);assert.equal(session.used,1);
});
test("stop prohibits subsequent requests",async()=>{
  const session=allowed(async()=>sampleResponse("42"));
  session.stop();
  await assert.rejects(session.run("arithmetic"),/Stopped/);
  assert.equal(session.used,0);
});
test("invalid response cannot become verified",async()=>{
  const session=allowed(async()=>sampleResponse("42",{done:false}));
  await assert.rejects(session.run("arithmetic"),/Unexpected local model response/);
});
test("invalid token count fails closed",async()=>{
  const session=allowed(async()=>sampleResponse("42",{eval_count:-5}));
  await assert.rejects(session.run("arithmetic"),/Unexpected/);
});
test("non-OK response rejected with no cloud fallback",async()=>{
  const session=allowed(async()=>({ok:false,json:async()=>({response:"42"})}));
  await assert.rejects(session.run("arithmetic"),/no retries or external fallback/);
});
test("all three fixtures work via mocked offline transport",async()=>{
  let calls=0;const answers=["42","AX-7B",'{"ok":true,"count":3}'];
  const session=allowed(async()=>sampleResponse(answers[calls++]));
  const report=await evaluateAll(session);
  assert.equal(report.passed,3);assert.equal(report.total,3);
  assert.equal(report.externalCalls,0);assert.equal(report.providerCostUsd,0);
  assert.equal(report.attempted,3);
  assert.equal(report.qualityGate,"PASS");
  assert.equal(report.externalActionAllowed,false);
});
test("quality failures counted, not disguised as success",async()=>{
  const session=allowed(async()=>sampleResponse("wrong"));
  const r=await evaluateAll(session);
  assert.equal(r.passed,0);assert.equal(r.attempted,3);
  assert.equal(r.qualityGate,"BLOCKED");
  assert.equal(r.externalActionAllowed,false);
});
test("invalid session cannot impersonate local model",async()=>{
  await assert.rejects(evaluateAll({model:ALLOWED_MODEL}),/Invalid local evaluation session/);
});
