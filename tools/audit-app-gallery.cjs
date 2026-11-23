'use strict';

// Read-only release preflight. A registry entry does not establish legal rights or
// prove that an uploaded App Store binary matches a screenshot.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

function audit(root) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const match = html.match(/<section\s+id=["']apps["'][\s\S]*?<\/section>/i);
  if (!match) throw new Error('Corporate #apps gallery not found');
  const registry = JSON.parse(fs.readFileSync(path.join(root, 'assets/products/source-provenance.json'), 'utf8'));
  if (!Array.isArray(registry.images)) throw new Error('Invalid source-provenance.json images array');
  const byAsset = new Map(registry.images.map(x => [x.web_asset, x]));
  const refs = Array.from(match[0].matchAll(/<img\b[^>]*\bsrc=["'](assets\/products\/[^"']+)["'][^>]*>/gi));
  if (!refs.length) throw new Error('Gallery has no product images');
  const items = refs.map(([, src]) => {
    const relative = src.split('?')[0];
    const asset = path.posix.basename(relative);
    const declaration = byAsset.get(asset);
    const warnings = [];
    const abs = path.resolve(root, relative);
    const productsDir = path.resolve(root, 'assets/products') + path.sep;
    if (!abs.startsWith(productsDir)) throw new Error('Unexpected image path outside products directory');
    let actualHash = null;
    if (fs.existsSync(abs)) {
      actualHash = crypto.createHash('sha256').update(fs.readFileSync(abs)).digest('hex');
    } else warnings.push('asset_file_missing');
    if (!declaration) warnings.push('provenance_entry_missing');
    else {
      if (declaration.retired_from_public_web) warnings.push('retired_asset_still_in_gallery');
      if (!declaration.source_original) warnings.push('original_source_missing');
      // Legacy sha256 is the *web* file checksum. It is not a hash of the raw capture.
      const webHash = declaration.web_sha256 || declaration.sha256;
      if (!webHash) warnings.push('web_sha256_missing');
      else if (actualHash && webHash.toLowerCase() !== actualHash.toLowerCase()) warnings.push('web_sha256_mismatch');
      if (!declaration.original_sha256) warnings.push('raw_capture_sha256_missing');
      if (!declaration.app_version || !declaration.app_build) warnings.push('app_version_or_build_missing');
      if (!declaration.platform || !declaration.capture_device || !declaration.capture_method) warnings.push('device_capture_context_missing');
      if (!['real-app-capture', 'marketing-composite', 'app-icon'].includes(declaration.asset_kind)) warnings.push('asset_kind_unverified');
      if (!declaration.rights_reference) warnings.push('commercial_rights_evidence_missing');
    }
    return { asset, declared_kind: declaration?.asset_kind || 'unknown', status: warnings.length ? 'NEEDS_VERIFICATION' : 'EVIDENCE_RECORDED', warnings };
  });
  const registered = new Set(items.map(x => x.asset));
  const stale = registry.images.filter(x => !registered.has(x.web_asset) && !x.retired_from_public_web).map(x => x.web_asset);
  return { purpose: 'Non-destructive provenance preflight. EVIDENCE_RECORDED is not a legal, binary, or physical-device certification.', inspected: items.length, evidenceRecorded: items.filter(x => !x.warnings.length).length, needsVerification: items.filter(x => x.warnings.length).length, orphanedCurrentEntries: stale, items };
}

if (require.main === module) {
  const root = path.resolve(process.argv.find(x => !x.startsWith('-') && x !== process.argv[0] && x !== process.argv[1]) || '.');
  try {
    const result = audit(root);
    process.stdout.write(JSON.stringify(result, null, 2) + '\n');
    if (process.argv.includes('--strict') && (result.needsVerification || result.orphanedCurrentEntries.length)) process.exitCode = 2;
  } catch (err) { process.stderr.write('Presentation audit error: ' + err.message + '\n'); process.exitCode = 1; }
}
module.exports = { audit };
