import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, cp, appendFile, realpath } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { ResearchSecureBroker } from "./secure-broker.mjs";
import { ResearchCoordinator } from "./coordinator.mjs";

const workerApp=process.env.UNFIRE_SIGNED_TEST_APP;
if(process.platform!=="darwin" || !workerApp) {
  throw new Error("Run this suite on a disposable macOS CI runner with UNFIRE_SIGNED_TEST_APP");
}
const h=s=>createHash("sha256").update(s).digest("hex");
async function withWorkspace(t) {
 const d=await mkdtemp(join(tmpdir(),"unfire-broker-test-"));
 t.after(()=>rm(d,{recursive:true,force:true}));
 return d;
}
async function withCoordinator(t) {
 const d=await withWorkspace(t);
 const {coordinator,credentials}=await ResearchCoordinator.open({
  directory:join(d,"state"),mission:"demo",
  agentSpecs:[{actor:"builder",
   actions:["state:read","artifact:claim","artifact:release","task:complete"],
   artifacts:["report"],ttlMs:60_000}]
 });
 const credential="Bearer "+credentials[0].token;
 return {coordinator,credential};
}
test("signed sandboxed worker passes independent verification",async()=>{
 const broker=await ResearchSecureBroker.open({workerApp});
 const out=await broker.execute({operation:"uppercase",input:"unfire os"});
 assert.equal(out.value,"UNFIRE OS");
 assert.equal(out.resultDigest,h('{"ok":true,"value":"UNFIRE OS"}'));
 assert.equal(out.verification,"deterministic-recomputed");
});
test("word count and hashing verified independently",async()=>{
 const broker=await ResearchSecureBroker.open({workerApp});
 assert.equal((await broker.execute({operation:"word_count",input:"one two  three"})).value,3);
 assert.equal((await broker.execute({operation:"sha256",input:"abc"})).value,h("abc"));
});
test("arbitrary command, file and network probe are not broker operations",async()=>{
 const broker=await ResearchSecureBroker.open({workerApp});
 for (const operation of ["shell","probe-file","probe-network","cmd","eval","open"]) {
  await assert.rejects(broker.execute({operation,input:"anything"}),/synthetic/);
 }
});
test("reject non-ASCII and oversized tasks before spawning",async()=>{
 const broker=await ResearchSecureBroker.open({workerApp});
 for(const input of ["a\nb","secret💾","a".repeat(600)]) {
  await assert.rejects(broker.execute({operation:"uppercase",input}),/synthetic/);
 }
});
test("reject invalid time budget and aborted task",async()=>{
 const broker=await ResearchSecureBroker.open({workerApp});
 await assert.rejects(broker.execute({operation:"uppercase",input:"test"},{timeoutMs:99}),/timeout/);
 await assert.rejects(broker.execute({operation:"uppercase",input:"test"},{timeoutMs:5100}),/timeout/);
 const controller=new AbortController();controller.abort();
 await assert.rejects(broker.execute({operation:"uppercase",input:"test"},{signal:controller.signal}),/aborted/);
});
test("do not accept arbitrary unsigned executable path",async()=>{
 await assert.rejects(ResearchSecureBroker.open({workerApp:"/bin/echo"}),/signed research/);
});
test("executable replacement detected after broker opened",async t=>{
 const root=await withWorkspace(t);
 const cloned=join(root,"UnfireResearchWorker.app");
 await cp(workerApp,cloned,{recursive:true});
 const canonical=await realpath(cloned);
 const broker=await ResearchSecureBroker.open({workerApp:canonical});
 await appendFile(join(canonical,"Contents","MacOS","UnfireResearchWorker"),Buffer.from([0]));
 await assert.rejects(broker.execute({operation:"uppercase",input:"x"}),/changed after verification/);
});
test("operator mission and scoped role must exist before launching task",async t=>{
 const broker=await ResearchSecureBroker.open({workerApp});
 const {coordinator,credential}=await withCoordinator(t);
 await assert.rejects(broker.executeAndAttest({coordinator,credential,
  artifact:"report",taskId:"demo",operation:"uppercase",input:"hello"}),/Mission must be created/);
});
test("broker independently verifies and attests only the selected output",async t=>{
 const broker=await ResearchSecureBroker.open({workerApp});
 const {coordinator,credential}=await withCoordinator(t);
 await coordinator.createMission();
 const r=await broker.executeAndAttest({coordinator,credential,
  artifact:"report",taskId:"verify",operation:"uppercase",input:"unfire"});
 assert.equal(r.value,"UNFIRE");
 assert.equal(r.verifiedBy,"deterministic-recomputed");
 assert.equal(r.attested,true);
 assert.equal(r.released,true);
 const journal=await coordinator.read(credential);
 assert.equal(journal.leases.report.status,"released");
 assert.equal(journal.leases.report.result.digest,h('{"ok":true,"value":"UNFIRE"}'));
 assert.equal(journal.leases.report.result.task,"verify");
});
test("STOP prevents new task lease and result attestation",async t=>{
 const broker=await ResearchSecureBroker.open({workerApp});
 const {coordinator,credential}=await withCoordinator(t);
 await coordinator.createMission();
 await coordinator.stopMission();
 await assert.rejects(broker.executeAndAttest({coordinator,credential,
  artifact:"report",taskId:"verify",operation:"uppercase",input:"test"}),/STOPPED/);
});
test("invalid task identifiers and operations never acquire lease",async t=>{
 const broker=await ResearchSecureBroker.open({workerApp});
 const {coordinator,credential}=await withCoordinator(t);
 await coordinator.createMission();
 await assert.rejects(broker.executeAndAttest({coordinator,credential,
  artifact:"report",taskId:"../../root",operation:"uppercase",input:"x"}),/identifier/);
 await assert.rejects(broker.executeAndAttest({coordinator,credential,
  artifact:"report",taskId:"verify",operation:"shell",input:"x"}),/synthetic/);
 assert.deepEqual((await coordinator.read(credential)).leases,{});
});
test("scoped role cannot run task for unauthorized output",async t=>{
 const broker=await ResearchSecureBroker.open({workerApp});
 const {coordinator,credential}=await withCoordinator(t);
 await coordinator.createMission();
 await assert.rejects(broker.executeAndAttest({coordinator,credential,
  artifact:"financials",taskId:"verify",operation:"uppercase",input:"x"}),/denied/);
});
test("no worker secrets or uncontrolled arguments appear in result",async()=>{
 const broker=await ResearchSecureBroker.open({workerApp});
 const result=await broker.execute({operation:"sha256",input:"abc"});
 assert.deepEqual(Object.keys(result).sort(),["operation","resultDigest","value","verification"]);
});
