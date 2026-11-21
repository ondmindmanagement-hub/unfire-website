import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAssetLinks } from './assetlinks-preview.mjs';

const synthetic = Array.from({length:32},(_,i)=>i.toString(16).padStart(2,'0')).join(':');
test('valid external certificate fingerprint produces expected Digital Asset Links shape',()=>{
 const result = buildAssetLinks({packageName:'technology.unfire.y2krobots',fingerprint:synthetic});
 assert.equal(result.length,1);
 assert.deepEqual(result[0].relation,['delegate_permission/common.handle_all_urls']);
 assert.equal(result[0].target.namespace,'android_app');
 assert.equal(result[0].target.package_name,'technology.unfire.y2krobots');
 assert.equal(result[0].target.sha256_cert_fingerprints[0],synthetic.toUpperCase());
});
test('fail closed for absent, malformed and placeholder fingerprints',()=>{
 for (const fingerprint of ['', 'xx', '00'.repeat(32),Array(32).fill('00').join(':')])
  assert.throws(()=>buildAssetLinks({packageName:'technology.unfire.y2krobots',fingerprint}),Error);
});
test('reject invalid package IDs and allow only explicit confirmed app IDs',()=>{
 for(const packageName of ['','placeholder','com.example','Unfire Robots','com.company/evil','a..b','a/b.c'])
  assert.throws(()=>buildAssetLinks({packageName,fingerprint:synthetic}),Error);
});
