"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),E=require("./engine.js");
test("App Ready defines unique immutable tasks and supported platforms",()=>{
 assert.equal(E.PLATFORMS.length,3);
 assert.equal(new Set(E.TASKS.map(t=>t.id)).size,E.TASKS.length);
 assert.ok(E.TASKS.length>=20);
 for(const p of E.PLATFORMS)assert.ok(E.activeTasks(p).length>=18);
 assert.throws(()=>E.activeTasks("watchos"),/supported platform/);
});
test("each platform receives correct genuine screenshot task",()=>{
 for(const p of E.PLATFORMS){
  const ids=E.activeTasks(p).filter(t=>t.id.startsWith("screens-")).map(t=>t.id);
  assert.deepEqual(ids,["screens-"+p]);
 }
});
test("default state never claims checks are complete",()=>{
 const state=E.blankState("ios","Genuine App");
 const s=E.stats(state);
 assert.equal(s.done,0);assert.equal(s.complete,false);
 assert.equal(s.pending,s.total);
});
test("only optional checks may be marked not applicable",()=>{
 const state=E.blankState();
 assert.throws(()=>E.setAnswer(state,"release-build","na"),/Unsupported status/);
 E.setAnswer(state,"in-app-purchases","na");
 assert.equal(E.stats(state).na,1);
 assert.equal(E.stats(state).complete,false);
});
test("cannot set a check belonging to another platform or an unknown task",()=>{
 const state=E.blankState("macos");
 assert.throws(()=>E.setAnswer(state,"screens-ios","checked"),/Unsupported status/);
 assert.throws(()=>E.setAnswer(state,"__proto__","checked"),/Unsupported status/);
 assert.throws(()=>E.setAnswer(state,"real-device","done"),/Unsupported status/);
});
test("one-platform fully self-checked report is still not certification",()=>{
 const state=E.blankState("macos","A test app");
 for(const task of E.activeTasks("macos"))E.setAnswer(state,task.id,"checked");
 const s=E.stats(state);
 assert.equal(s.percent,100);assert.equal(s.complete,true);
 assert.match(E.makeReport(state).warning,/no automated Apple validation/);
});
test("roundtrip report preserves states and platform",()=>{
 const state=E.blankState("ipados","Example editor");
 E.setAnswer(state,"review-notes","checked");
 E.setAnswer(state,"review-access","na");
 const exported=E.makeReport(state,new Date("2026-11-22T12:00:00Z"));
 assert.equal(exported.schema_version,1);
 const restored=E.loadReport(JSON.stringify(exported));
 assert.equal(restored.platform,"ipados");
 assert.equal(restored.appName,"Example editor");
 assert.equal(restored.answers["review-access"],"na");
 assert.equal(restored.answers["review-notes"],"checked");
});
test("invalid and unfamiliar report content is rejected",()=>{
 assert.throws(()=>E.loadReport("{not json"),/not valid JSON/);
 assert.throws(()=>E.loadReport("{}"),/Not a supported/);
 const r=E.makeReport(E.blankState("macos"));
 r.checks["__proto__"]="checked";
 assert.throws(()=>E.loadReport('{"document_type":"unfire-app-ready-self-review","schema_version":1,"platform":"macos","checks":{"__proto__":"checked"}}'),/Unknown check/);
 const wrongPlatform=E.makeReport(E.blankState("macos"));
 wrongPlatform.checks["screens-ios"]="checked";
 assert.throws(()=>E.loadReport(JSON.stringify(wrongPlatform)),/Invalid check state/);
});
test("oversized file and app name are rejected",()=>{
 assert.throws(()=>E.loadReport("a".repeat(65537)),/too large/);
 assert.throws(()=>E.cleanName("x".repeat(81)),/80 characters/);
 assert.throws(()=>E.blankState("ios","hello\nworld"),/control characters/);
});
test("safe filenames cannot contain traversal",()=>{
 assert.equal(E.safeFilename("../../My App.json"),"unfire-app-ready-My-Appjson.json");
 assert.equal(E.safeFilename("Unfire Test"),"unfire-app-ready-Unfire-Test.json");
});
test("applicable progress excludes only optional N/A",()=>{
 const s=E.blankState();
 E.setAnswer(s,"review-access","na");
 E.setAnswer(s,"release-build","checked");
 const stats=E.stats(s);
 assert.equal(stats.applicable,stats.total-1);
 assert.equal(stats.done,1);
 assert.equal(stats.pending,stats.total-2);
});
