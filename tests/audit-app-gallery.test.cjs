'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { audit } = require('../tools/audit-app-gallery.cjs');
function fixture(entryOptions = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'unfire-gallery-audit-'));
  fs.mkdirSync(path.join(root, 'assets/products'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<section id="apps"><div><img src="assets/products/sample.webp" alt="Real capture"></div></section>');
  const bytes = Buffer.from('genuine fixture bytes');
  fs.writeFileSync(path.join(root, 'assets/products/sample.webp'), bytes);
  const hash = crypto.createHash('sha256').update(bytes).digest('hex');
  const entry = {web_asset:'sample.webp',source_original:'private-captures/REAL.png',web_sha256:hash,original_sha256:'1'.repeat(64),app_version:'1.0',app_build:'7',platform:'iOS',capture_device:'iPhone simulator',capture_method:'simctl screenshot',asset_kind:'real-app-capture',rights_reference:'owner-rights-approval',...entryOptions};
  fs.writeFileSync(path.join(root, 'assets/products/source-provenance.json'), JSON.stringify({images:[entry]}));
  return root;
}
test('records evidence fields without asserting legal clearance', () => {const root=fixture();try {const r=audit(root);assert.equal(r.inspected,1);assert.equal(r.evidenceRecorded,1);assert.equal(r.needsVerification,0);assert.match(r.purpose,/not a legal/);}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('fails closed when visual origin and rights are undocumented', () => {const root=fixture({original_sha256:null,rights_reference:null,asset_kind:null});try{const r=audit(root);assert.equal(r.needsVerification,1);assert(r.items[0].warnings.includes('raw_capture_sha256_missing'));assert(r.items[0].warnings.includes('commercial_rights_evidence_missing'));assert(r.items[0].warnings.includes('asset_kind_unverified'));}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('detects asset mutation after a declared SHA', () => {const root=fixture();try{fs.writeFileSync(path.join(root,'assets/products/sample.webp'),'altered');const r=audit(root);assert(r.items[0].warnings.includes('web_sha256_mismatch'));}finally{fs.rmSync(root,{recursive:true,force:true});}});
test('does not count outdated declared asset as active gallery coverage',()=>{const root=fixture();try{const p=path.join(root,'assets/products/source-provenance.json');const j=JSON.parse(fs.readFileSync(p));j.images[0].retired_from_public_web='2026-10-28';fs.writeFileSync(p,JSON.stringify(j));assert(audit(root).items[0].warnings.includes('retired_asset_still_in_gallery'));}finally{fs.rmSync(root,{recursive:true,force:true});}});
