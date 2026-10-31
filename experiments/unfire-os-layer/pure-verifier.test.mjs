import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { validatePureTask, independentlyVerify } from "./pure-verifier.mjs";
const hash = text => createHash("sha256").update(text).digest("hex");
const json = value => JSON.stringify({ok:true,value});
test("uppercase is recomputed, not blindly trusted",()=>{
 const verified=independentlyVerify({operation:"uppercase",input:"unfire os"},json("UNFIRE OS"));
 assert.equal(verified.value,"UNFIRE OS");
 assert.equal(verified.verification,"deterministic-recomputed");
 assert.equal(verified.resultDigest,hash(json("UNFIRE OS")));
});
test("word count detects incorrect result",()=>{
 assert.equal(independentlyVerify({operation:"word_count",input:"one two  three"},json(3)).value,3);
 assert.throws(()=>independentlyVerify({operation:"word_count",input:"one two  three"},json(4)),/Independent/);
});
test("SHA-256 recomputed from original input",()=>{
 assert.equal(independentlyVerify({operation:"sha256",input:"abc"},json(hash("abc"))).value,hash("abc"));
 assert.throws(()=>independentlyVerify({operation:"sha256",input:"abc"},json("0".repeat(64))),/Independent/);
});
test("reject any other operation including shell or networking",()=>{
 for(const op of ["shell","probe-file","probe-network","web.fetch","run","code"]) {
  assert.throws(()=>validatePureTask({operation:op,input:"hello"}),/synthetic/);
 }
});
test("reject non-ASCII payload and oversize input",()=>{
 for(const text of ["ñ","a\nb","💾","a".repeat(513)]) {
  assert.throws(()=>validatePureTask({operation:"uppercase",input:text}),/synthetic/);
 }
});
test("reject extra fields and wrong input type",()=>{
 assert.throws(()=>validatePureTask({operation:"uppercase",input:"yes",command:"erase"}),/synthetic/);
 assert.throws(()=>validatePureTask({operation:"uppercase",input:12}),/synthetic/);
 assert.throws(()=>validatePureTask([]),/synthetic/);
});
test("reject fabricated success fields and wrong types",()=>{
 assert.throws(()=>independentlyVerify({operation:"uppercase",input:"x"},'{"ok":true,"value":"X","shell":"yes"}'),/shape/);
 assert.throws(()=>independentlyVerify({operation:"word_count",input:"x"},json("1")),/Independent/);
});
test("reject invalid, oversized, empty or non-JSON outputs",()=>{
 const task={operation:"uppercase",input:"x"};
 for(const v of ["", "not json", '{"ok":false,"value":"X"}', "x".repeat(9000)]) {
  assert.throws(()=>independentlyVerify(task,v));
 }
});
test("empty printable input is supported",()=>{
 assert.equal(independentlyVerify({operation:"word_count",input:""},json(0)).value,0);
});
test("whitespace-only word input returns zero",()=>{
 assert.equal(independentlyVerify({operation:"word_count",input:"    "},json(0)).value,0);
});
