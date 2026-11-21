"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),e=require("./engine.js");
test("DNI checksum prevents arbitrary nine-character matches",()=>{
  assert.equal(e.validDni("12345678Z"),true);
  assert.equal(e.validDni("12345678A"),false);
  assert.equal(e.validDni("X1234567L"),true);
});
test("IBAN validates checksum, length and spacing",()=>{
  assert.equal(e.validIban("ES91 2100 0418 4502 0005 1332"),true);
  assert.equal(e.validIban("ES91 2100 0418 4502 0005 1333"),false);
  assert.equal(e.validIban("ES91 2100 0418"),false);
});
test("IPv4 octets are checked",()=>{
  assert.equal(e.validIPv4("192.168.2.1"),true);
  assert.equal(e.validIPv4("999.168.2.1"),false);
});
test("redaction removes synthetic data but retains context",()=>{
  const text="Contact: hello@example.com, Tel +34 612 345 678; DNI 12345678Z; IBAN ES9121000418450200051332; IP 192.168.1.5.";
  const r=e.report(text);
  assert.equal(r.counts.email,1);
  assert.equal(r.counts.phone,1);
  assert.equal(r.counts.identity,1);
  assert.equal(r.counts.iban,1);
  assert.equal(r.counts.ip,1);
  for(const value of ["hello@example.com","+34 612 345 678","12345678Z","ES9121000418450200051332","192.168.1.5"])
    assert.equal(r.redacted.includes(value),false);
  assert.match(r.redacted,/Contact:/);
});
test("recognizes representative synthetic access token patterns",()=>{
 const txt="ghp_"+ "A".repeat(36)+"; sk-proj-"+ "B".repeat(24);
 const r=e.report(txt);
 assert.equal(r.counts.secret,2);
 assert.equal(r.redacted.includes("ghp_"),false);
 assert.equal(r.redacted.includes("sk-proj-"),false);
});
test("category selection is opt-in and overlaps do not duplicate",()=>{
 const txt="hello@example.com 612345678";
 const r=e.report(txt,["email"]);
 assert.equal(r.matches.length,1);
 assert.equal(r.counts.email,1);
 assert.equal(r.counts.phone,0);
 const two=e.report("ES91 2100 0418 4502 0005 1332");
 assert.equal(two.counts.iban,1);
 assert.equal(two.matches.length,1);
});
test("rejects oversized input and malformed redaction boundaries",()=>{
 assert.throws(()=>e.scan("a".repeat(200001)),/too long/);
 assert.throws(()=>e.redact("hi",[{type:"email",start:0,end:8}]),/Invalid redaction/);
});
test("does not flag ordinary text or invalid examples",()=>{
 const r=e.report("Memo 12345678A, 999.12.1.1, ES91 2100 0418 4502 0005 1333");
 assert.equal(r.matches.length,0);
});
