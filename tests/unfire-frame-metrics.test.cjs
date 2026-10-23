'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {percentile,summarizeFrames}=require('../scripts/unfire-frame-metrics.cjs');

test('percentile interpolates independently of UI thread',()=>{
  assert.equal(percentile([10,20,30,40,50],.95),48);
  assert.equal(percentile([10,20],.50),15);
  assert.equal(percentile([],0.95),null);
  assert.throws(()=>percentile([1],2),RangeError);
});
test('stable 60fps produces positive, bounded diagnostics',()=>{
  const s=summarizeFrames(Array(120).fill(1000/60),60);
  assert.equal(s.samples,120);
  assert.equal(s.avgFps,60);
  assert.equal(s.stalls100ms,0);
  assert.equal(s.stutters50ms,0);
  assert.equal(s.overBudgetPct,0);
});
test('compact 24fps can be evaluated against a 24fps budget',()=>{
  const s=summarizeFrames(Array(60).fill(1000/24),24);
  assert.equal(s.avgFps,24);
  assert.equal(s.overBudgetPct,0);
  assert.equal(s.stutters50ms,0);
});
test('stalled frames are reported without claiming universal threshold',()=>{
  const s=summarizeFrames([16,16,16,55,120],60);
  assert.equal(s.samples,5);
  assert.equal(s.stutters50ms,2);
  assert.equal(s.stalls100ms,1);
  assert.equal(s.overBudgetPct,40);
  assert(s.p99Ms>s.p95Ms && s.p95Ms>s.p50Ms);
});
test('bad samples cannot hide genuine stalls or divide by zero',()=>{
  const s=summarizeFrames([0,-7,NaN,Infinity,null,12,1000000],60);
  assert.equal(s.samples,1);assert.equal(s.discarded,6);
  assert.equal(s.p50Ms,12);
  assert.equal(summarizeFrames([]).avgFps,null);
  assert.throws(()=>summarizeFrames([15],0),RangeError);
});
