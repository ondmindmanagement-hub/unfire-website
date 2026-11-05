import test from 'node:test';
import assert from 'node:assert/strict';
import {summarizeContinuumIndex} from './continuum-snapshot.mjs';

const names=[
  'agent-coordination','approvals','continuity','development',
  'device-compatibility','live-activity','mail-and-partners','portfolio',
  'quality','releases','resources','risk-center','workspaces'
];
const nowMs=Date.parse('2026-11-03T11:22:00Z');
const fixture=()=>({
  schema:'unfire-operations-center-0.1',
  updated_at:'2026-11-03T11:21:25+00:00',
  categories:Object.fromEntries(names.map(x=>[x,{details:'sensitive and irrelevant'}])),
  source_domains:{development:{private:'mock'}} ,
  category_count:13,
  tasks:[{id:'secret_id',title:'private job',project:'fictional client',status:'running'}],
  service_inventory:{available:true,persistent_running:6,persistent_expected:6,services:[{path:'/Users/private'}]},
  summary:{sensitive:'fictional@example.invalid'},
  warning:'secret token that must not leak'
});
const summarize = update=>{
  const data=fixture();
  update?.(data);
  return summarizeContinuumIndex(data,{nowMs});
};
test('fresh canonical index produces only low-information counts',()=>{
  const r=summarize();
  assert.equal(r.status,'FRESH_LOCAL_AGGREGATE');
  assert.deepEqual(r.counts,{categories:13,taskRecords:1,servicesRunning:6,servicesExpected:6});
  assert.equal(r.externalActionAllowed,false);
  assert.equal(r.tenantBoundaryVerified,false);
});
test('no sensitive task, path, email, warning or source-domain strings leak',()=>{
  const serialized=JSON.stringify(summarize());
  for(const value of ['secret_id','private job','fictional client','/Users/private','fictional@example.invalid','secret token'])
    assert.equal(serialized.includes(value),false);
});
test('only documented output keys are returned',()=>{
  assert.deepEqual(Object.keys(summarize()).sort(),
    ['schema','status','sourceFresh','tenantBoundaryVerified','externalActionAllowed','counts'].sort());
});
test('does not mutate original index',()=>{
  const d=fixture();const original=JSON.stringify(d);
  summarizeContinuumIndex(d,{nowMs});
  assert.equal(JSON.stringify(d),original);
});
test('stale index cannot present freshness',()=>{
  const r=summarize(d=>d.updated_at='2026-11-03T11:10:00Z');
  assert.equal(r.status,'STALE_LOCAL_AGGREGATE');
  assert.equal(r.sourceFresh,false);
});
test('unexpected schema version denied',()=>{
  assert.equal(summarize(d=>d.schema='new.version').status,'INVALID_SOURCE');
});
test('missing category denied as schema drift',()=>{
  assert.equal(summarize(d=>{delete d.categories['workspaces'];d.category_count=12}).status,'SCHEMA_DRIFT');
});
test('unknown replacement category denied',()=>{
  assert.equal(summarize(d=>{delete d.categories['workspaces'];d.categories['new_category']={}}).status,'SCHEMA_DRIFT');
});
test('future timestamp more than tolerance denied',()=>{
  assert.equal(summarize(d=>d.updated_at='2026-11-03T11:25:00+00:00').status,'INVALID_TIMESTAMP');
});
test('malformed timestamp denied',()=>{
  assert.equal(summarize(d=>d.updated_at='not-date').status,'INVALID_SOURCE');
});
test('bad service count denied',()=>{
  assert.equal(summarize(d=>d.service_inventory.persistent_running=-1).status,'INVALID_SOURCE');
});
test('missing task list denied',()=>{
  assert.equal(summarize(d=>delete d.tasks).status,'INVALID_SOURCE');
});
test('unspecified clock fails closed',()=>{
  assert.equal(summarizeContinuumIndex(fixture()).status,'INVALID_SOURCE');
});
test('untrusted invalid root shapes do not throw',()=>{
  for(const d of [null,undefined,1,'x',[],new Date(),Object.create(null)]){
    const r=summarizeContinuumIndex(d,{nowMs});
    assert.equal(r.externalActionAllowed,false);
    assert.equal(r.counts,null);
  }
});
test('throwing proxy fails closed rather than crashing',()=>{
  const proxy=new Proxy({}, {getPrototypeOf(){throw new Error('bad proxy')}});
  assert.equal(summarizeContinuumIndex(proxy,{nowMs}).status,'INVALID_SOURCE');
});
test('zero-length category summary cannot look connected',()=>{
  assert.equal(summarize(d=>{d.categories={};d.category_count=0}).status,'SCHEMA_DRIFT');
});
