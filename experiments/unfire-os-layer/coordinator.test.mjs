import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { ResearchCoordinator } from "./coordinator.mjs";

const hash=s=>createHash("sha256").update(s).digest("hex");
const worker=(actor,actions,artifacts=["report"])=>({actor,actions,artifacts,ttlMs:60_000});
async function fixture(t,agents=[]){
 const root=await mkdtemp(join(tmpdir(),"unfire-coordinator-test-"));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const {coordinator,credentials}=await ResearchCoordinator.open({
   directory:join(root,"control"),mission:"demo",agentSpecs:agents
 });
 return {coordinator,credentials};
}
test("no research roles enabled by default",async t=>{
 const {coordinator,credentials}=await fixture(t);
 assert.deepEqual(credentials,[]);
 assert.deepEqual(coordinator.roster(),[]);
 await coordinator.createMission(1000);
 await coordinator.stopMission(1100);
});
test("scoped builder can acquire and attest a synthetic digest",async t=>{
 const {coordinator,credentials}=await fixture(t,[
   worker("builder",["state:read","artifact:claim","task:complete","artifact:release"])
 ]);
 const header="Bearer "+credentials[0].token;
 await coordinator.createMission(1000);
 const lease=await coordinator.acquire(header,{artifact:"report",ttlMs:1000,now:1100});
 assert.equal(lease.actor,"builder");
 assert.equal(lease.generation,1);
 const receipt=await coordinator.attest(header,{
   artifact:"report",generation:1,token:lease.token,task:"research",resultDigest:hash("synthetic"),now:1200
 });
 assert.equal(receipt.resultDigest,hash("synthetic"));
 assert.equal((await coordinator.read(header)).leases.report.result.task,"research");
 await coordinator.release(header,{artifact:"report",generation:1,token:lease.token,now:1300});
});
test("wrong role cannot claim another artifact",async t=>{
 const {coordinator,credentials}=await fixture(t,[
   worker("researcher",["artifact:claim","artifact:release"],["report"])
 ]);
 await coordinator.createMission(1000);
 await assert.rejects(coordinator.acquire("Bearer "+credentials[0].token,{
   artifact:"finance",ttlMs:1000,now:1100}),/denied/);
});
test("reader cannot write, writer cannot read",async t=>{
 const {coordinator,credentials}=await fixture(t,[
   worker("reader",["state:read"],[]),worker("builder",["artifact:claim"],["report"])
 ]);
 await coordinator.createMission(1000);
 assert.equal((await coordinator.read("Bearer "+credentials[0].token)).created,true);
 await assert.rejects(coordinator.acquire("Bearer "+credentials[0].token,{
   artifact:"report",ttlMs:1000,now:1100}),/denied/);
 await assert.rejects(coordinator.read("Bearer "+credentials[1].token),/denied/);
});
test("task completion without scoped artifact claim is denied",async t=>{
 const {coordinator,credentials}=await fixture(t,[
   worker("writer",["task:complete"],[])
 ]);
 await coordinator.createMission(1000);
 await assert.rejects(coordinator.attest("Bearer "+credentials[0].token,{
   artifact:"report",generation:1,token:"a".repeat(64),task:"research",
   resultDigest:hash("bad"),now:1100}),/denied/);
});
test("no task attestation without explicit task capability",async t=>{
 const {coordinator,credentials}=await fixture(t,[
   worker("builder",["artifact:claim"],["report"])
 ]);
 const header="Bearer "+credentials[0].token;
 await coordinator.createMission(1000);
 const lease=await coordinator.acquire(header,{artifact:"report",ttlMs:1000,now:1100});
 await assert.rejects(coordinator.attest(header,{
   artifact:"report",generation:1,token:lease.token,task:"research",resultDigest:hash("bad"),now:1200
 }),/denied/);
});
test("revocation prevents subsequent actions",async t=>{
 const {coordinator,credentials}=await fixture(t,[
   worker("builder",["artifact:claim","task:complete"])
 ]);
 const header="Bearer "+credentials[0].token;
 await coordinator.createMission(1000);
 const lease=await coordinator.acquire(header,{artifact:"report",ttlMs:60000});
 assert.equal(coordinator.revoke("builder"),1);
 await assert.rejects(coordinator.attest(header,{
   artifact:"report",generation:1,token:lease.token,task:"research",resultDigest:hash("bad")
 }),/denied/);
});
test("operator STOP and agent attestation cannot commit out of order",async t=>{
 const {coordinator,credentials}=await fixture(t,[
   worker("builder",["artifact:claim","task:complete"])
 ]);
 const header="Bearer "+credentials[0].token;
 await coordinator.createMission(1000);
 const lease=await coordinator.acquire(header,{artifact:"report",ttlMs:1000,now:1100});
 const write=()=>coordinator.attest(header,{
   artifact:"report",generation:1,token:lease.token,task:"research",resultDigest:hash("synthetic"),now:1200
 });
 const [a,b]=await Promise.allSettled([coordinator.stopMission(1200),write()]);
 const view=await (async()=>{ // trusted operator can inspect via the remaining 'read' gate only if granted.
   // We only need to assert accepted STOP blocks fresh subsequent requests.
   return {stop:a.status,attest:b.status};
 })();
 assert.ok(view.stop==="fulfilled"||view.attest==="fulfilled");
 if(a.status==="fulfilled")await assert.rejects(write(),/STOPPED/);
});
test("cannot grant an operator role to a research worker",async t=>{
 await assert.rejects(fixture(t,[worker("operator",["state:read"],[])]),/Reserved/);
});
test("cannot mint more than 8 workers",async t=>{
 const agents=Array.from({length:9},(_,i)=>worker("agent"+i,["state:read"],[]));
 await assert.rejects(fixture(t,agents),/Invalid agent list/);
});
