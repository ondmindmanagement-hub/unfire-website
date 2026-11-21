// Synthetic-only developer assertions. Run: node autonomy/demo/test.js
// No external packages, customer data, APIs, model inference, or side effects.
'use strict';
const assert=require('node:assert/strict');
const {cases,evaluate}=require('./evaluator.js');
const expected=[
  ['Critical','REVIEW REQUIRED'],
  ['High','BLOCKED'],
  ['High','REVIEW REQUIRED'],
  ['Low','DRAFT ONLY'],
  ['Normal','BLOCKED'],
  ['Medium','REVIEW REQUIRED'],
  ['Normal','REVIEW REQUIRED'],
  ['Critical','DRAFT ONLY']
];
assert.equal(cases.length,expected.length);
for(let i=0;i<cases.length;i++){
  const r=evaluate(cases[i]);
  assert.equal(r.priority,expected[i][0],cases[i].id+' priority');
  assert.equal(r.decision,expected[i][1],cases[i].id+' decision');
  assert.equal(r.executed,false,cases[i].id+' no execution');
  assert.equal(r.externalCalls,0,cases[i].id+' no API calls');
}
assert.equal(evaluate({id:'UNKNOWN',description:'routine',requestedAction:'undefined_action'}).decision,'BLOCKED');
console.log('PASS: 8 synthetic examples + 1 unknown-action denial; no external calls or execution.');
