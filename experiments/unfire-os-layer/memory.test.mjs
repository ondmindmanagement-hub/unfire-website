import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { LocalMissionMemory, MemoryPolicy, AuthorizedMission } from "./memory.mjs";

const expires="2099-01-01T00:00:00Z";
function grant(actor,mission,capability,artifact) {
  return {actor,mission,capability,expires,...(artifact?{artifact}:{})};
}
async function setup(t) {
  const temp=await mkdtemp(join(tmpdir(),"unfire-memory-test-"));
  t.after(()=>rm(temp,{recursive:true,force:true}));
  const store=await LocalMissionMemory.open(join(temp,"workspace"));
  const policy=new MemoryPolicy([
    grant("director","demo","mission:create"),
    grant("director","demo","mission:stop"),
    grant("writer","demo","artifact:claim","report"),
    grant("writer","demo","artifact:release","report"),
    grant("writer","demo","task:complete"),
    grant("viewer","demo","task:complete")
  ]);
  return {temp,store,session:new AuthorizedMission(store,policy)};
}
const mission={type:"MISSION_CREATED",mission:"demo",actor:"director"};
test("append-only events survive reopening",async t=>{
  const {store,session,temp}=await setup(t);
  await session.record(mission);
  await session.record({type:"ARTIFACT_CLAIMED",mission:"demo",actor:"writer",artifact:"report"});
  await session.record({type:"TASK_COMPLETED",mission:"demo",actor:"writer",task:"review"});
  const reopened=await LocalMissionMemory.open(join(temp,"workspace"));
  const r=await reopened.read();
  assert.equal(r.count,3);
  assert.equal(r.summary.claims.report,"writer");
  assert.deepEqual(r.summary.completed,["review"]);
  assert.equal(r.records[2].prev,r.records[1].hash);
});
test("deny task without explicit grant",async t=>{
  const {session}=await setup(t);
  await session.record(mission);
  await assert.rejects(session.record({type:"ARTIFACT_CLAIMED",mission:"demo",actor:"viewer",artifact:"report"}),/Access denied/);
});
test("deny expired grant",()=>{
  const p=new MemoryPolicy([{actor:"director",mission:"demo",capability:"mission:create",expires:"2020-01-01T00:00:00Z"}]);
  assert.equal(p.permits(mission),false);
});
test("deny cross-mission grant",()=>{
  const p=new MemoryPolicy([grant("director","other","mission:create")]);
  assert.equal(p.permits(mission),false);
});
test("deny cross-artifact grant",async t=>{
  const {session}=await setup(t);
  await session.record(mission);
  await assert.rejects(session.record({type:"ARTIFACT_CLAIMED",mission:"demo",actor:"writer",artifact:"finance"}),/Access denied/);
});
test("one writer per claimed artifact until release",async t=>{
  const {store,session}=await setup(t);
  await session.record(mission);
  await session.record({type:"ARTIFACT_CLAIMED",mission:"demo",actor:"writer",artifact:"report"});
  await assert.rejects(store.append({type:"ARTIFACT_CLAIMED",mission:"demo",actor:"intruder",artifact:"report"}),/already claimed/);
  await session.record({type:"ARTIFACT_RELEASED",mission:"demo",actor:"writer",artifact:"report"});
  assert.deepEqual((await session.inspect()).summary.claims,{});
});
test("claim release restricted to owner",async t=>{
  const {store,session}=await setup(t);
  await session.record(mission);
  await session.record({type:"ARTIFACT_CLAIMED",mission:"demo",actor:"writer",artifact:"report"});
  await assert.rejects(store.append({type:"ARTIFACT_RELEASED",mission:"demo",actor:"other",artifact:"report"}),/Claim owner/);
});
test("STOP prevents all later writes",async t=>{
  const {session}=await setup(t);
  await session.record(mission);
  await session.record({type:"MISSION_STOPPED",mission:"demo",actor:"director"});
  await assert.rejects(session.record({type:"TASK_COMPLETED",mission:"demo",actor:"viewer",task:"poststop"}),/STOPPED/);
  assert.equal((await session.inspect()).summary.stopped,true);
});
test("cannot add second mission to workspace",async t=>{
  const {store,session}=await setup(t);
  await session.record(mission);
  await assert.rejects(store.append({type:"MISSION_CREATED",mission:"other",actor:"director"}),/already exists/);
});
test("reject artifact traversal",async t=>{
  const {store}=await setup(t);
  await assert.rejects(store.append({type:"ARTIFACT_CLAIMED",mission:"demo",actor:"writer",artifact:"../../keys"}),/Invalid artifact/);
});
test("reject extraneous or executable event fields",async t=>{
  const {store}=await setup(t);
  await assert.rejects(store.append({...mission,command:"rm -rf /"}),/Unexpected/);
});
test("detect modified event data",async t=>{
  const {store,session,temp}=await setup(t);
  await session.record(mission);
  const path=join(temp,"workspace","events.jsonl");
  const contents=await readFile(path,"utf8");
  await writeFile(path,contents.replace('"demo"','"wrong"'));
  await assert.rejects(store.read(),/integrity check failed/);
});
test("detect truncated record",async t=>{
  const {store,session,temp}=await setup(t);
  await session.record(mission);
  const path=join(temp,"workspace","events.jsonl");
  const contents=await readFile(path,"utf8");
  await writeFile(path,contents.trimEnd());
  await assert.rejects(store.read(),/Truncated/);
});
test("fail closed on preexisting lock",async t=>{
  const {store,temp}=await setup(t);
  await mkdir(join(temp,"workspace",".journal.lock"));
  await assert.rejects(store.append(mission),/busy/);
});
test("concurrent writes cannot both commit same mission",async t=>{
  const {store}=await setup(t);
  const outcomes=await Promise.allSettled([store.append(mission),store.append(mission)]);
  assert.equal(outcomes.filter(o=>o.status==="fulfilled").length,1);
  assert.equal(outcomes.filter(o=>o.status==="rejected").length,1);
  assert.equal((await store.read()).count,1);
});
test("reject invalid workspace path",async()=>{
  await assert.rejects(LocalMissionMemory.open("relative/path"),/absolute/);
});
test("reject malformed event note",async t=>{
  const {store}=await setup(t);
  await assert.rejects(store.append({...mission,note:"bad\nvalue"}),/Invalid note/);
});
test("reject invalid policy grant",()=>{
  assert.throws(()=>new MemoryPolicy([{actor:"bad?",mission:"demo",capability:"mission:create",expires}]),/Invalid/);
});
