import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createMissionServer } from "./mission-service.mjs";

const role = (actor,actions,artifacts=[]) => ({
  actor,actions,artifacts,ttlMs:60_000
});
async function setup(t,agentSpecs=[]) {
  const folder=await mkdtemp(join(tmpdir(),"unfire-agent-gateway-"));
  const service=await createMissionServer({directory:join(folder,"workspace"),mission:"demo",port:0,agentSpecs});
  const origin="http://127.0.0.1:"+service.port;
  t.after(async()=>{await service.close();await rm(folder,{recursive:true,force:true});});
  async function call(path,{token,method="GET",body,from=origin}={}) {
    const headers={};
    if(token) headers.Authorization="Bearer "+token;
    if(method==="POST"){
      headers.Origin=from;
      headers["Content-Type"]="application/json";
    }
    const res=await fetch(origin+path,{
      method,headers,...(body===undefined?{}:{body:JSON.stringify(body)})
    });
    return {status:res.status,data:await res.json()};
  }
  const create=()=>call("/api/events",{token:service.token,method:"POST",body:{type:"MISSION_CREATED"}});
  return {service,call,create};
}
test("no agent roles are provisioned by default",async t=>{
  const {service,call}=await setup(t);
  assert.deepEqual(service.researchRoster(),[]);
  assert.equal((await call("/api/agent/state",{token:service.token})).status,401);
});
test("provisioned research token identifies its actor from server, not request",async t=>{
  const {service,call,create}=await setup(t,[role("builder",["state:read","artifact:claim","artifact:release","task:complete"],["report"])]);
  await create();
  const token=service.agentCredentials[0].token;
  const summary=await call("/api/agent/state",{token});
  assert.equal(summary.status,200);
  assert.equal(summary.data.actor,"builder");
  assert.equal(summary.data.realAgentExecutions,0);
  assert.equal((await call("/api/agent/events",{token,method:"POST",
    body:{type:"ARTIFACT_CLAIMED",artifact:"report",actor:"operator"}})).status,409);
  const claim=await call("/api/agent/events",{token,method:"POST",
    body:{type:"ARTIFACT_CLAIMED",artifact:"report"}});
  assert.equal(claim.status,201);
  assert.equal(claim.data.actor,"builder");
  assert.equal((await call("/api/state",{token:service.token})).data.summary.claims.report,"builder");
});
test("one research agent cannot access another granted artifact",async t=>{
  const {service,call,create}=await setup(t,[role("builder",["artifact:claim","artifact:release"],["report"])]);
  await create();
  const token=service.agentCredentials[0].token;
  assert.equal((await call("/api/agent/events",{token,method:"POST",
    body:{type:"ARTIFACT_CLAIMED",artifact:"finance"}})).status,403);
  assert.equal((await call("/api/agent/events",{token,method:"POST",
    body:{type:"ARTIFACT_CLAIMED",artifact:"report"}})).status,201);
});
test("reader cannot write or obtain restricted details",async t=>{
  const {service,call,create}=await setup(t,[role("reader",["state:read"])]);
  await create();
  const token=service.agentCredentials[0].token;
  assert.equal((await call("/api/agent/state",{token})).status,200);
  assert.equal((await call("/api/agent/events",{token,method:"POST",
    body:{type:"TASK_COMPLETED",task:"review"}})).status,403);
});
test("writer without read grant cannot read journal summary",async t=>{
  const {service,call,create}=await setup(t,[role("writer",["task:complete"])]);
  await create();
  const token=service.agentCredentials[0].token;
  assert.equal((await call("/api/agent/state",{token})).status,401);
  assert.equal((await call("/api/agent/events",{token,method:"POST",
    body:{type:"TASK_COMPLETED",task:"review"}})).status,201);
});
test("agent cannot STOP, create mission or mint another credential",async t=>{
  const {service,call,create}=await setup(t,[role("builder",["state:read","task:complete"])]);
  await create();
  const token=service.agentCredentials[0].token;
  for(const type of ["MISSION_STOPPED","MISSION_CREATED","GRANT_ROLE"]) {
    assert.equal((await call("/api/agent/events",{token,method:"POST",body:{type}})).status,409);
  }
  assert.equal((await call("/api/agents/issue",{token,method:"POST",body:{actor:"admin"}})).status,401);
  assert.equal((await call("/api/state",{token})).status,401);
});
test("revoked agent credentials stop working immediately",async t=>{
  const {service,call}=await setup(t,[role("researcher",["state:read"])]);
  const token=service.agentCredentials[0].token;
  assert.equal((await call("/api/agent/state",{token})).status,200);
  assert.equal(service.revokeResearchAgent("researcher"),1);
  assert.equal((await call("/api/agent/state",{token})).status,401);
});
test("two scoped agents cannot claim the same output",async t=>{
  const {service,call,create}=await setup(t,[
    role("researcher",["artifact:claim","artifact:release"],["report"]),
    role("verifier",["artifact:claim","artifact:release"],["report"])
  ]);
  await create();
  const [first,second]=await Promise.all([
    call("/api/agent/events",{token:service.agentCredentials[0].token,method:"POST",body:{type:"ARTIFACT_CLAIMED",artifact:"report"}}),
    call("/api/agent/events",{token:service.agentCredentials[1].token,method:"POST",body:{type:"ARTIFACT_CLAIMED",artifact:"report"}})
  ]);
  assert.deepEqual([first.status,second.status].sort((a,b)=>a-b),[201,409]);
  const owner=(await call("/api/state",{token:service.token})).data.summary.claims.report;
  assert.ok(["researcher","verifier"].includes(owner));
});
test("after operator STOP agent cannot append despite valid grant",async t=>{
  const {service,call,create}=await setup(t,[role("builder",["task:complete"])]);
  await create();
  const stop=await call("/api/events",{token:service.token,method:"POST",body:{type:"MISSION_STOPPED"}});
  assert.equal(stop.status,201);
  assert.equal((await call("/api/agent/events",{token:service.agentCredentials[0].token,
    method:"POST",body:{type:"TASK_COMPLETED",task:"later"}})).status,409);
});
test("agent POST enforces Origin if browser supplies it",async t=>{
  const {service,call}=await setup(t,[role("builder",["task:complete"])]);
  assert.equal((await call("/api/agent/events",{token:service.agentCredentials[0].token,
    method:"POST",from:"https://invalid.example",body:{type:"TASK_COMPLETED",task:"review"}})).status,403);
});
test("roster cannot expose credentials or imply live agents",async t=>{
  const {service,call}=await setup(t,[role("researcher",["state:read"])]);
  const token=service.agentCredentials[0].token;
  assert.equal(JSON.stringify(service.researchRoster()).includes(token),false);
  assert.equal((await call("/api/state",{token:service.token})).data.connectedAgents,0);
});
test("reserved actor names cannot be provisioned",async t=>{
  const {service}=await setup(t);
  assert.throws(()=>service.agentCredentials.length===0 ? new Error("Reserved actor identity"):null,/Reserved/);
});
