import test from "node:test";
import assert from "node:assert/strict";
import {mkdtemp, rm, readFile, writeFile, mkdir} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {createHash} from "node:crypto";
import {FencedResultJournal} from "./fenced-results.mjs";
const digest=s=>createHash("sha256").update(s).digest("hex");
async function fixture(t){
  const root=await mkdtemp(join(tmpdir(),"unfire-fences-test-"));
  const directory=join(root,"workspace");
  t.after(()=>rm(root,{recursive:true,force:true}));
  const journal=await FencedResultJournal.open(directory,"demo");
  return {journal,directory};
}
test("persistent lease generation survives reopening",async t=>{
  const {journal,directory}=await fixture(t);
  const first=await journal.acquire({actor:"researcher",artifact:"report",now:1000,ttlMs:1000});
  assert.equal(first.generation,1);assert.equal(first.token.length,64);
  await journal.release({actor:"researcher",artifact:"report",
    generation:first.generation,token:first.token,now:1500});
  const reopened=await FencedResultJournal.open(directory,"demo");
  const second=await reopened.acquire({actor:"editor",artifact:"report",now:1501,ttlMs:1000});
  assert.equal(second.generation,2);
  assert.equal((await reopened.inspect()).leases.report.actor,"editor");
});
test("active lease refuses second agent",async t=>{
  const {journal}=await fixture(t);
  await journal.acquire({actor:"researcher",artifact:"report",now:1000,ttlMs:1000});
  await assert.rejects(journal.acquire({actor:"editor",artifact:"report",now:1200,ttlMs:1000}),/already active/);
});
test("expired lease may be replaced only with higher fencing generation",async t=>{
  const {journal}=await fixture(t);
  const first=await journal.acquire({actor:"researcher",artifact:"report",now:1000,ttlMs:1000});
  const second=await journal.acquire({actor:"editor",artifact:"report",now:2000,ttlMs:1000});
  assert.equal(second.generation,2);
  await assert.rejects(journal.submit({actor:"researcher",artifact:"report",
    generation:first.generation,token:first.token,task:"source",digest:digest("old"),now:2200}),/rejected/);
  const good=await journal.submit({actor:"editor",artifact:"report",
    generation:second.generation,token:second.token,task:"source",digest:digest("new"),now:2201});
  assert.equal(good.generation,2);
});
test("old owner cannot release newer lease",async t=>{
  const {journal}=await fixture(t);
  const first=await journal.acquire({actor:"researcher",artifact:"report",now:1000,ttlMs:1000});
  const second=await journal.acquire({actor:"editor",artifact:"report",now:2000,ttlMs:1000});
  await assert.rejects(journal.release({actor:"researcher",artifact:"report",generation:1,
    token:first.token,now:2100}),/rejected/);
  assert.equal((await journal.inspect()).leases.report.generation,second.generation);
});
test("wrong token or actor cannot submit",async t=>{
  const {journal}=await fixture(t);
  const lease=await journal.acquire({actor:"writer",artifact:"report",now:1000,ttlMs:2000});
  const args={actor:"writer",artifact:"report",generation:1,token:lease.token,task:"test",digest:digest("ok"),now:1500};
  await assert.rejects(journal.submit({...args,token:"f".repeat(64)}),/rejected/);
  await assert.rejects(journal.submit({...args,actor:"intruder"}),/rejected/);
});
test("no result submission at exact expiration",async t=>{
  const {journal}=await fixture(t);
  const lease=await journal.acquire({actor:"writer",artifact:"report",now:1000,ttlMs:1000});
  await assert.rejects(journal.submit({actor:"writer",artifact:"report",generation:1,
    token:lease.token,task:"test",digest:digest("ok"),now:2000}),/rejected/);
});
test("result digest stored without raw contents or bearer token",async t=>{
  const {journal,directory}=await fixture(t);
  const lease=await journal.acquire({actor:"writer",artifact:"report",now:1000,ttlMs:2000});
  const body="synthetic harmless result";
  await journal.submit({actor:"writer",artifact:"report",generation:1,
    token:lease.token,task:"test",digest:digest(body),now:1500});
  const inspection=await journal.inspect();
  assert.equal(inspection.leases.report.result.digest,digest(body));
  assert.equal(inspection.leases.report.result.task,"test");
  const raw=await readFile(join(directory,"fenced-events.jsonl"),"utf8");
  assert.equal(raw.includes(body),false);
  assert.equal(raw.includes(lease.token),false);
});
test("same lease cannot submit a second result",async t=>{
  const {journal}=await fixture(t);
  const lease=await journal.acquire({actor:"writer",artifact:"report",now:1000,ttlMs:2000});
  const args={actor:"writer",artifact:"report",generation:1,
    token:lease.token,task:"test",digest:digest("ok"),now:1500};
  await journal.submit(args);
  await assert.rejects(journal.submit({...args,now:1600}),/already submitted/);
});
test("parallel acquisitions on same artifact have one winner",async t=>{
  const {journal}=await fixture(t);
  const outcomes=await Promise.allSettled([
    journal.acquire({actor:"writer",artifact:"report",ttlMs:1000,now:1000}),
    journal.acquire({actor:"editor",artifact:"report",ttlMs:1000,now:1000})]);
  assert.equal(outcomes.filter(x=>x.status==="fulfilled").length,1);
  assert.equal(outcomes.filter(x=>x.status==="rejected").length,1);
  assert.equal((await journal.inspect()).count,1);
});
test("parallel independent artifacts safely serialize",async t=>{
  const {journal}=await fixture(t);
  const outcomes=await Promise.allSettled([
    journal.acquire({actor:"writer",artifact:"report",ttlMs:1000,now:1000}),
    journal.acquire({actor:"editor",artifact:"notes",ttlMs:1000,now:1000})]);
  // Fail-closed 'busy' is acceptable during a racing lock; no state corruption.
  assert.ok(outcomes.some(x=>x.status==="fulfilled"));
  assert.ok((await journal.inspect()).count>=1);
});
test("reject invalid TTL and identifiers",async t=>{
  const {journal}=await fixture(t);
  await assert.rejects(journal.acquire({actor:"../../admin",artifact:"report",ttlMs:1000,now:1000}),/Invalid actor/);
  await assert.rejects(journal.acquire({actor:"writer",artifact:"report",ttlMs:999,now:1000}),/duration/);
  await assert.rejects(journal.acquire({actor:"writer",artifact:"report",ttlMs:500000,now:1000}),/duration/);
});
test("reject invalid result digest and generation",async t=>{
  const {journal}=await fixture(t);
  const lease=await journal.acquire({actor:"writer",artifact:"report",now:1000,ttlMs:2000});
  await assert.rejects(journal.submit({actor:"writer",artifact:"report",generation:0,
    token:lease.token,task:"test",digest:digest("x"),now:1200}),/generation/);
  await assert.rejects(journal.submit({actor:"writer",artifact:"report",generation:1,
    token:lease.token,task:"test",digest:"fake",now:1200}),/digest/);
});
test("detect edited journal and truncated record",async t=>{
  const {journal,directory}=await fixture(t);
  await journal.acquire({actor:"writer",artifact:"report",now:1000,ttlMs:2000});
  const path=join(directory,"fenced-events.jsonl");
  const raw=await readFile(path,"utf8");
  await writeFile(path,raw.replace('"report"','"notes"'));
  await assert.rejects(journal.inspect(),/integrity mismatch/);
  await writeFile(path,raw.trimEnd());
  await assert.rejects(journal.inspect(),/Truncated/);
});
test("fail closed when lock cannot be acquired",async t=>{
  const {journal,directory}=await fixture(t);
  await mkdir(join(directory,".fenced-events.lock"));
  await assert.rejects(journal.acquire({actor:"writer",artifact:"report",now:1000,ttlMs:1000}),/busy/);
});
test("disallow reopening a different mission journal",async t=>{
  const {journal,directory}=await fixture(t);
  await journal.acquire({actor:"writer",artifact:"report",now:1000,ttlMs:1000});
  await assert.rejects(FencedResultJournal.open(directory,"other"),/Different mission/);
});
test("reject stale global timestamps on replay",async t=>{
  const {journal}=await fixture(t);
  await journal.acquire({actor:"writer",artifact:"report",now:2000,ttlMs:1000});
  await assert.rejects(journal.acquire({actor:"editor",artifact:"notes",now:1500,ttlMs:1000}),/Nonmonotonic/);
});
test("no file or network access on behalf of clients",async t=>{
  const {journal}=await fixture(t);
  assert.equal(typeof journal.execute,"undefined");
  assert.equal(typeof journal.fetch,"undefined");
  assert.equal(typeof journal.writeArtifact,"undefined");
});
