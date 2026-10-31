import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const dir = path.dirname(fileURLToPath(import.meta.url));
const data = (file) => readFileSync(path.join(dir, file), 'utf8');
const manifest = JSON.parse(data('windows-pwa-manifest.candidate.json'));
const store = JSON.parse(data('store-listing.en.json'));
const worker = data('service-worker.candidate.js');

test('canonical Y2K ROBOTS identity and stable /audio/ app ID', () => {
  assert.equal(manifest.name, 'Y2K ROBOTS');
  assert.equal(manifest.short_name, 'Y2K ROBOTS');
  assert.equal(manifest.lang, 'en');
  assert.equal(manifest.id, '/audio/');
  assert.equal(manifest.start_url, '/audio/');
  assert.equal(manifest.scope, '/audio/');
  assert.equal(manifest.display, 'standalone');
});

test('both approved-resolution PNG icon references are declared', () => {
  assert.deepEqual(manifest.icons.map(x => x.sizes), ['192x192', '512x512']);
  assert.ok(manifest.icons.every(x => x.type === 'image/png'));
  assert.ok(manifest.icons.every(x => /^\/audio\/img\/y2k-robots-icon-(192|512)\.png$/.test(x.src)));
});

test('storefront content remains truthful and unreleased', () => {
  assert.equal(store.product_name, 'Y2K ROBOTS');
  assert.equal(store.publisher_brand, 'Unfire');
  assert.equal(store.status, 'draft_not_for_publication');
  assert.equal(store.base_game_pricing, 'free');
  assert.equal(store.verified_platform_testing, false);
  assert.equal(store.badges_or_claims_approved, false);
  assert.equal(store.targets.microsoft_store.package_state, 'not_built_or_certified');
  assert.equal(store.targets.google_play.package_state, 'no_verified_AAB');
});

test('candidate worker cannot claim offline game or replace active session', () => {
  assert.doesNotMatch(worker, /self\.addEventListener\(\s*['"]fetch['"]/);
  assert.doesNotMatch(worker, /caches\.open\s*\(/);
  assert.doesNotMatch(worker, /\bskipWaiting\s*\(/);
  assert.doesNotMatch(worker, /\bclients\.claim\s*\(/);
  assert.match(worker, /Network access remains essential/);
});

test('required owner release gates exist as documented', () => {
  const guide = data('pwa-owner-integration.md');
  assert.match(guide, /owner review/i);
  assert.match(guide, /actual.*Windows|Windows hardware/i);
  assert.match(guide, /Android AAB/i);
  assert.match(guide, /approved.*icon/i);
});

test('staged approved PNG files have exact bytes and expected dimensions', () => {
  const fixtures = [
    { size: 192, sha256: '69a2f35b90f3c84c5355a809b64b92970acd0d957d3bd9363f5fe75c8326d842' },
    { size: 512, sha256: '636d98b7510137224644558f397b5ad184e3f14bf09f96d0b70ad7524036141e' }
  ];
  for (const {size, sha256} of fixtures) {
    const filename = path.join(dir, 'assets', `y2k-robots-icon-${size}.png`);
    const bytes = readFileSync(filename);
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.subarray(12, 16).toString('ascii'), 'IHDR');
    assert.equal(bytes.readUInt32BE(16), size);
    assert.equal(bytes.readUInt32BE(20), size);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), sha256);
  }
});

test('Android TWA config is explicitly a proposal and cannot claim signed status', () => {
  const twa = JSON.parse(data('android-twa-manifest.candidate.json'));
  assert.match(twa._status, /NOT BUILT, SIGNED/);
  assert.equal(twa.packageId, 'technology.unfire.y2krobots');
  assert.equal(twa.host, 'unfire.technology');
  assert.equal(twa.startUrl, '/audio/');
  assert.equal(twa.name, 'Y2K ROBOTS');
  assert.equal(twa.enableNotifications, false);
  assert.equal(twa.fallbackType, 'customtabs');
  assert.equal(twa.webManifestUrl, 'https://unfire.technology/audio/game.webmanifest');
  assert.equal(twa.minSdkVersion, 26);
  assert.equal(twa.signingKey.path, './android.keystore');
  assert.equal(twa.signingKey.alias, 'android');
  assert.ok(!('certificateFingerprint' in twa));
});
