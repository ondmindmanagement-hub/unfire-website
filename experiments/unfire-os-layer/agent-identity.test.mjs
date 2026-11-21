import test from "node:test";
import assert from "node:assert/strict";
import { AgentCredentialRegistry } from "./agent-identity.mjs";

const base = () => new AgentCredentialRegistry("demo");
const provision = registry => registry.issue({
  actor:"builder",actions:["state:read","artifact:claim","artifact:release","task:complete"],
  artifacts:["report"],ttlMs:30_000
},100_000);

test("no credentials by default", () => assert.deepEqual(base().roster(), []));
test("valid token maps to provisioned actor and mission", () => {
  const reg=base(), {token}=provision(reg);
  assert.deepEqual(reg.authorize("Bearer "+token,"state:read",null,100_001),
    {actor:"builder",mission:"demo"});
});
test("reject fake or missing token", () => {
  const reg=base(); provision(reg);
  assert.equal(reg.authorize(undefined,"state:read"),null);
  assert.equal(reg.authorize("Bearer "+"a".repeat(64),"state:read"),null);
  assert.equal(reg.authorize("Basic "+"a".repeat(64),"state:read"),null);
});
test("expiry rejects at the exact threshold", () => {
  const reg=base(), {token,expiresAt}=provision(reg);
  assert.equal(reg.authorize("Bearer "+token,"state:read",null,expiresAt-1)?.actor,"builder");
  assert.equal(reg.authorize("Bearer "+token,"state:read",null,expiresAt),null);
});
test("no arbitrary actions beyond exact allowlist", () => {
  const reg=base(), {token}=provision(reg);
  for(const action of ["shell:execute","mission:stop","mission:create","user:manage"]) {
    assert.equal(reg.authorize("Bearer "+token,action,null,100_001),null);
  }
});
test("artifact writes limited to granted names", () => {
  const reg=base(), {token}=provision(reg);
  assert.equal(reg.authorize("Bearer "+token,"artifact:claim","report",100_001)?.actor,"builder");
  assert.equal(reg.authorize("Bearer "+token,"artifact:release","other",100_001),null);
  assert.equal(reg.authorize("Bearer "+token,"artifact:claim",undefined,100_001),null);
});
test("revocation invalidates token immediately", () => {
  const reg=base(), {token}=provision(reg);
  assert.equal(reg.revoke(token),true);
  assert.equal(reg.authorize("Bearer "+token,"state:read",null,100_001),null);
  assert.equal(reg.revoke(token),false);
});
test("revoke actor without exposing bearer token", () => {
  const reg=base(), {token}=provision(reg);
  assert.equal(reg.roster(100_001)[0].token,undefined);
  assert.equal(reg.revokeActor("builder"),1);
  assert.equal(reg.authorize("Bearer "+token,"state:read",null,100_001),null);
});
test("reject duplicate actor and bound agent count", () => {
  const reg=base(); provision(reg);
  assert.throws(()=>provision(reg),/duplicate/);
  for(let i=0;i<7;i++)reg.issue({actor:"agent"+i,actions:["state:read"],artifacts:[],ttlMs:1000},100_000);
  assert.throws(()=>reg.issue({actor:"agent8",actions:["state:read"],artifacts:[],ttlMs:1000},100_000),/limit/);
});
test("deny missing explicit write artifact scopes", () => {
  const reg=base();
  assert.throws(()=>reg.issue({actor:"x",actions:["artifact:claim"],artifacts:[],ttlMs:1000}),/artifact scopes/);
});
test("no duplicated actions or artifact scopes", () => {
  const reg=base();
  assert.throws(()=>reg.issue({actor:"x",actions:["state:read","state:read"],artifacts:[],ttlMs:1000}),/allowlist/);
  assert.throws(()=>reg.issue({actor:"x",actions:["state:read"],artifacts:["report","report"],ttlMs:1000}),/allowlist/);
});
test("reject traversal or unexpected bootstrap fields", () => {
  const reg=base();
  assert.throws(()=>reg.issue({actor:"../../root",actions:["state:read"],artifacts:[],ttlMs:1000}),/agent ID/);
  assert.throws(()=>reg.issue({actor:"x",actions:["state:read"],artifacts:[],ttlMs:1000,admin:true}),/specification/);
});
test("reject long-lived or zero-duration credentials", () => {
  const reg=base();
  assert.throws(()=>reg.issue({actor:"x",actions:["state:read"],artifacts:[],ttlMs:0}),/lifetime/);
  assert.throws(()=>reg.issue({actor:"x",actions:["state:read"],artifacts:[],ttlMs:86_400_000}),/lifetime/);
});
test("roster includes capabilities but excludes secret", () => {
  const reg=base();provision(reg);
  const entries=reg.roster(100_001);
  assert.deepEqual(entries[0].actions,["state:read","artifact:claim","artifact:release","task:complete"]);
  assert.equal(JSON.stringify(entries).includes("Bearer "),false);
});
