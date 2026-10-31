import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { UnifiedControlPlane } from "./control-plane.mjs";

const digest=s=>createHash("sha256").update(s).digest("hex");
async function fixture(t){
 const root=await mkdtemp(join(tmpdir(),"unfire-control-test-"));
 t.after(()=>rm(root,{recursive:true,force:true}));
 const directory=join(root,"private");
 return {root,directory,plane:await UnifiedControlPlane.open(directory,"demo")};
}
test("empty workspace has no mission, agents or lease",async t=>{
 const {plane}=await fixture(t);
 assert.deepEqual(await plane.inspect(),{mission:"demo",created:false,stopped:false,
   count:0,headHash:null,leases:{}});
});
test("must create mission before acquiring",async t=>{
 const {plane}=await fixture(t);
 await assert.rejects(plane.acquire({actor:"builder",artifact:"report",now:1000,ttlMs:1000}),/Mission must be created/);
});
test("single STOP persists across restart",async t=>{
 const {plane,directory}=await fixture(t);
 await plane.createMission(1000);
 await plane.stopMission(1100);
 const reopened=await UnifiedControlPlane.open(directory,"demo");
 assert.equal((await reopened.inspect()).stopped,true);
 await assert.rejects(reopened.acquire({actor:"builder",artifact:"report",now:1200,ttlMs:1000}),/STOPPED/);
 await assert.rejects(reopened.stopMission(1300),/STOPPED/);
});
test("strict generation increments after released lease",async t=>{
 const {plane}=await fixture(t);await plane.createMission(1000);
 const a=await plane.acquire({actor:"builder",artifact:"report",now:1100,ttlMs:1000});
 assert.equal(a.generation,1);
 await plane.release({actor:"builder",artifact:"report",generation:a.generation,token:a.token,now:1200});
 const b=await plane.acquire({actor:"verifier",artifact:"report",now:1300,ttlMs:1000});
 assert.equal(b.generation,2);
 assert.equal((await plane.inspect()).leases.report.actor,"verifier");
});
test("cannot claim a currently leased artifact",async t=>{
 const {plane}=await fixture(t);await plane.createMission(1000);
 await plane.acquire({actor:"builder",artifact:"report",now:1100,ttlMs:2000});
 await assert.rejects(plane.acquire({actor:"verifier",artifact:"report",now:1200,ttlMs:1000}),/already leased/);
});
test("expired lease replacement rejects stale attestation",async t=>{
 const {plane}=await fixture(t);await plane.createMission(1000);
 const first=await plane.acquire({actor:"builder",artifact:"report",now:1100,ttlMs:1000});
 const second=await plane.acquire({actor:"verifier",artifact:"report",now:2100,ttlMs:1000});
 assert.equal(second.generation,2);
 await assert.rejects(plane.attest({actor:"builder",artifact:"report",generation:1,token:first.token,
  task:"verify",resultDigest:digest("stale"),now:2200}),/rejected/);
 const r=await plane.attest({actor:"verifier",artifact:"report",generation:2,token:second.token,
  task:"verify",resultDigest:digest("new"),now:2300});
 assert.equal(r.resultDigest,digest("new"));
});
test("cannot attest with invalid lease token or actor",async t=>{
 const {plane}=await fixture(t);await plane.createMission(1000);
 const a=await plane.acquire({actor:"builder",artifact:"report",now:1100,ttlMs:1000});
 const props={actor:"builder",artifact:"report",generation:1,token:a.token,task:"verify",
  resultDigest:digest("ok"),now:1200};
 await assert.rejects(plane.attest({...props,token:"f".repeat(64)}),/rejected/);
 await assert.rejects(plane.attest({...props,actor:"intruder"}),/rejected/);
});
test("operator STOP and attestation serialize without post-STOP commit",async t=>{
 const {plane}=await fixture(t);await plane.createMission(1000);
 const lease=await plane.acquire({actor:"builder",artifact:"report",now:1100,ttlMs:1000});
 const req=()=>plane.attest({actor:"builder",artifact:"report",generation:1,token:lease.token,
  task:"verify",resultDigest:digest("x"),now:1200});
 const [stop,attest]=await Promise.allSettled([plane.stopMission(1200),req()]);
 const view=await plane.inspect();
 // A racing lock can reject either request: it must never accept an attestation AFTER an accepted STOP.
 assert.ok([stop,attest].some(x=>x.status==="fulfilled"));
 if(stop.status==="fulfilled"){
   assert.equal(view.stopped,true);
   // A subsequent attestation must be rejected after accepted STOP.
   await assert.rejects(req(),/STOPPED/);
 }
 assert.ok(view.count>=2&&view.count<=3);
});
test("STOP after attestation prevents later release and fresh claims",async t=>{
 const {plane}=await fixture(t);await plane.createMission(1000);
 const lease=await plane.acquire({actor:"builder",artifact:"report",now:1100,ttlMs:1000});
 await plane.attest({actor:"builder",artifact:"report",generation:1,token:lease.token,
  task:"verify",resultDigest:digest("x"),now:1200});
 await plane.stopMission(1300);
 await assert.rejects(plane.release({actor:"builder",artifact:"report",generation:1,
  token:lease.token,now:1400}),/STOPPED/);
 await assert.rejects(plane.acquire({actor:"verifier",artifact:"notes",now:1500,ttlMs:1000}),/STOPPED/);
});
test("hash-linked journal detects tampering",async t=>{
 const {plane,directory}=await fixture(t);await plane.createMission(1000);
 const f=join(directory,"control-events.jsonl");
 const data=await readFile(f,"utf8");
 await writeFile(f,data.replace('"operator"','"intruder"'));
 await assert.rejects(plane.inspect(),/integrity mismatch/);
});
test("truncated journal rejected",async t=>{
 const {plane,directory}=await fixture(t);await plane.createMission(1000);
 const f=join(directory,"control-events.jsonl");
 const data=await readFile(f,"utf8");
 await writeFile(f,data.trimEnd());
 await assert.rejects(plane.inspect(),/Truncated/);
});
test("fail closed on pre-existing lock",async t=>{
 const {plane,directory}=await fixture(t);await mkdir(join(directory,".control-events.lock"));
 await assert.rejects(plane.createMission(1000),/busy/);
});
test("strictly private filesystem and mission-specific journal",async t=>{
 const {plane,directory}=await fixture(t);await plane.createMission(1000);
 await assert.rejects(UnifiedControlPlane.open(directory,"other"),/Different mission/);
 const text=await readFile(join(directory,"control-events.jsonl"),"utf8");
 assert.equal(text.includes("Bearer "),false);
});
test("reject duplicate creation and backwards timestamps",async t=>{
 const {plane}=await fixture(t);await plane.createMission(1000);
 await assert.rejects(plane.createMission(1100),/already created/);
 await assert.rejects(plane.stopMission(900),/Nonmonotonic/);
});
test("attestation stores digest, not underlying output",async t=>{
 const {plane,directory}=await fixture(t);await plane.createMission(1000);
 const lease=await plane.acquire({actor:"builder",artifact:"report",now:1100,ttlMs:1000});
 const content="synthetic output";
 await plane.attest({actor:"builder",artifact:"report",generation:1,token:lease.token,
  task:"verify",resultDigest:digest(content),now:1200});
 const view=await plane.inspect();
 assert.equal(view.leases.report.result.digest,digest(content));
 const raw=await readFile(join(directory,"control-events.jsonl"),"utf8");
 assert.equal(raw.includes(content),false);
 assert.equal(raw.includes(lease.token),false);
});
test("duplicate attestation rejected",async t=>{
 const {plane}=await fixture(t);await plane.createMission(1000);
 const a=await plane.acquire({actor:"builder",artifact:"report",now:1100,ttlMs:1000});
 const data={actor:"builder",artifact:"report",generation:1,token:a.token,task:"verify",
  resultDigest:digest("x"),now:1200};
 await plane.attest(data);
 await assert.rejects(plane.attest({...data,now:1300}),/already attested/);
});
test("unclaimed release and invalid lease durations rejected",async t=>{
 const {plane}=await fixture(t);await plane.createMission(1000);
 await assert.rejects(plane.release({actor:"builder",artifact:"report",generation:1,
   token:"a".repeat(64),now:1100}),/rejected/);
 await assert.rejects(plane.acquire({actor:"builder",artifact:"report",ttlMs:999,now:1100}),/duration/);
 await assert.rejects(plane.acquire({actor:"builder",artifact:"report",ttlMs:500000,now:1100}),/duration/);
});
test("two parallel mission creations cannot both succeed",async t=>{
 const {plane}=await fixture(t);
 const out=await Promise.allSettled([plane.createMission(1000),plane.createMission(1000)]);
 assert.equal(out.filter(x=>x.status==="fulfilled").length,1);
 assert.equal(out.filter(x=>x.status==="rejected").length,1);
});
test("claimed digest does not mean verified content",async t=>{
 const {plane}=await fixture(t);await plane.createMission(1000);
 const a=await plane.acquire({actor:"builder",artifact:"report",now:1100,ttlMs:1000});
 await plane.attest({actor:"builder",artifact:"report",generation:1,token:a.token,
  task:"verify",resultDigest:"0".repeat(64),now:1200});
 assert.equal((await plane.inspect()).leases.report.result.digest,"0".repeat(64));
});
