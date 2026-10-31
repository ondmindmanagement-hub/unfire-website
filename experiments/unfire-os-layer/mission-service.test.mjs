import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createMissionServer } from "./mission-service.mjs";

async function fixture(t) {
  const temporary=await mkdtemp(join(tmpdir(),"unfire-mission-http-"));
  const directory=join(temporary,"workspace");
  const service=await createMissionServer({directory,mission:"demo",port:0});
  t.after(async()=>{
    await service.close().catch(()=>{});
    await rm(temporary,{recursive:true,force:true});
  });
  const base="http://127.0.0.1:"+service.port;
  async function request(path,{method="GET",body,token=service.token,origin=base,contentType="application/json"}={}) {
    const headers={};
    if(token)headers.Authorization="Bearer "+token;
    if(method==="POST") {
      headers.Origin=origin;
      headers["Content-Type"]=contentType;
    }
    const response=await fetch(base+path,{method,headers,
      ...(body===undefined?{}:{body:typeof body==="string"?body:JSON.stringify(body)})});
    return {status:response.status,data:await response.json()};
  }
  return {service,directory,request,base};
}
test("reject every memory API without session token",async t=>{
  const {request}=await fixture(t);
  assert.equal((await request("/api/state",{token:null})).status,401);
  assert.equal((await request("/api/events",{method:"POST",token:null,body:{type:"MISSION_CREATED"}})).status,401);
});
test("reject wrong session key",async t=>{
  const {request}=await fixture(t);
  assert.equal((await request("/api/state",{token:"f".repeat(64)})).status,401);
});
test("reject write originating from other site",async t=>{
  const {request}=await fixture(t);
  assert.equal((await request("/api/events",{method:"POST",origin:"https://evil.test",body:{type:"MISSION_CREATED"}})).status,403);
});
test("reject non-JSON write and unknown operation",async t=>{
  const {request}=await fixture(t);
  assert.equal((await request("/api/events",{method:"POST",contentType:"text/plain",body:"{}"})).status,415);
  assert.equal((await request("/api/events",{method:"POST",body:{type:"SHELL_EXEC"}})).status,409);
});
test("reject spoofed actor and extra fields",async t=>{
  const {request}=await fixture(t);
  assert.equal((await request("/api/events",{method:"POST",body:{type:"MISSION_CREATED",actor:"admin"}})).status,409);
});
test("accept mission creation and persist operator identity",async t=>{
  const {request}=await fixture(t);
  assert.equal((await request("/api/events",{method:"POST",body:{type:"MISSION_CREATED"}})).status,201);
  const r=await request("/api/state");
  assert.equal(r.status,200);
  assert.equal(r.data.summary.mission,"demo");
  assert.equal(r.data.records[0].event.actor,"operator");
  assert.equal(r.data.connectedAgents,0);
});
test("deny second mission creation",async t=>{
  const {request}=await fixture(t);
  await request("/api/events",{method:"POST",body:{type:"MISSION_CREATED"}});
  assert.equal((await request("/api/events",{method:"POST",body:{type:"MISSION_CREATED"}})).status,409);
});
test("artifact claim and release reflected in state",async t=>{
  const {request}=await fixture(t);
  const post=body=>request("/api/events",{method:"POST",body});
  await post({type:"MISSION_CREATED"});
  assert.equal((await post({type:"ARTIFACT_CLAIMED",artifact:"report"})).status,201);
  assert.equal((await request("/api/state")).data.summary.claims.report,"operator");
  assert.equal((await post({type:"ARTIFACT_RELEASED",artifact:"report"})).status,201);
  assert.deepEqual((await request("/api/state")).data.summary.claims,{});
});
test("concurrent conflicting claims cannot both succeed",async t=>{
  const {request}=await fixture(t);
  await request("/api/events",{method:"POST",body:{type:"MISSION_CREATED"}});
  const [one,two]=await Promise.all([
    request("/api/events",{method:"POST",body:{type:"ARTIFACT_CLAIMED",artifact:"report"}}),
    request("/api/events",{method:"POST",body:{type:"ARTIFACT_CLAIMED",artifact:"report"}})]);
  assert.deepEqual([one.status,two.status].sort((a,b)=>a-b),[201,409]);
});
test("mark checkpoint, then permanent STOP blocks new tasks",async t=>{
  const {request}=await fixture(t);
  const post=body=>request("/api/events",{method:"POST",body});
  await post({type:"MISSION_CREATED"});
  assert.equal((await post({type:"TASK_COMPLETED",task:"draft"})).status,201);
  assert.equal((await post({type:"MISSION_STOPPED"})).status,201);
  assert.equal((await post({type:"TASK_COMPLETED",task:"afterstop"})).status,409);
  assert.equal((await request("/api/state")).data.summary.stopped,true);
});
test("mission record survives server restart at same workspace",async t=>{
  const {request,directory,service}=await fixture(t);
  await request("/api/events",{method:"POST",body:{type:"MISSION_CREATED"}});
  await service.close();
  const next=await createMissionServer({directory,mission:"demo",port:0});
  t.after(()=>next.close().catch(()=>{}));
  const response=await fetch("http://127.0.0.1:"+next.port+"/api/state",{headers:{Authorization:"Bearer "+next.token}});
  assert.equal(response.status,200);
  assert.equal((await response.json()).summary.mission,"demo");
});
test("oversized event requests rejected",async t=>{
  const {request}=await fixture(t);
  assert.equal((await request("/api/events",{method:"POST",body:{type:"MISSION_CREATED",padding:"a".repeat(3000)}})).status,409);
});
test("reject unknown routes and unsafe methods",async t=>{
  const {request}=await fixture(t);
  assert.equal((await request("/api/commands")).status,405);
  assert.equal((await request("/api/state",{method:"POST",body:{}})).status,405);
  assert.equal((await request("/missing")).status,404);
});
test("serve console with strict content policy and no network APIs",async t=>{
  const {base}=await fixture(t);
  const response=await fetch(base+"/mission-console.html");
  assert.equal(response.status,200);
  assert.match(response.headers.get("content-security-policy"),/connect-src 'self'/);
  assert.match(await response.text(),/Real agents/);
});
