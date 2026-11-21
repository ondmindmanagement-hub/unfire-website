"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),e=require("./engine.js");
test("clean normalizes BOM and line endings",()=>{
 assert.equal(e.clean("\uFEFFA\r\nB\rC"),"A\nB\nC");
});
test("clean preserves Markdown soft breaks unless explicitly enabled",()=>{
 const text="Line  \n\n\n\nNext\n";
 assert.equal(e.clean(text),text);
 assert.equal(e.clean(text,{trailing:true,blankLines:true}),"Line\n\n\nNext\n");
});
test("valid JSON can be formatted, invalid rejected",()=>{
 assert.equal(e.formatJson('{"a":[1,true]}'),'{\n  "a": [\n    1,\n    true\n  ]\n}');
 assert.throws(()=>e.formatJson("{bad json"),/Invalid JSON/);
});
test("chunks respect maximum length and reconstruct original text",()=>{
 const original=("one two three four five six seven eight nine ten\n").repeat(100);
 const parts=e.chunk(original,310,30);
 assert.ok(parts.length>1);
 parts.forEach((p,i)=>{
  assert.ok(p.text.length<=310);
  assert.equal(p.text,original.slice(p.start,p.end));
  assert.equal(p.number,i+1);
  if(i)assert.ok(p.start<=parts[i-1].end);
 });
 assert.equal(parts[parts.length-1].end,original.length);
});
test("no text loss without overlap when chunking at paragraph boundary",()=>{
 const original="a".repeat(600)+"\n"+"b".repeat(400);
 const parts=e.chunk(original,300,0);
 assert.equal(parts.map(x=>x.text).join(""),original);
});
test("invalid sizes are rejected",()=>{
 for(const [size,overlap] of [[250,0],[400,400],[600,-1],[600,1001],[12001,0]]){
  assert.throws(()=>e.chunk("hello",size,overlap));
 }
});
test("empty input and too-long input handled",()=>{
 assert.deepEqual(e.chunk(""),[]);
 assert.throws(()=>e.clean("a".repeat(200001)),/Maximum input/);
 assert.throws(()=>e.formatJson("a".repeat(200001)),/Maximum input/);
});
test("output file names do not contain traversal",()=>{
 assert.equal(e.filename("../../My File.csv","txt"),"My-File-prepared.txt");
 assert.equal(e.filename("file.json","json"),"file-prepared.json");
});
