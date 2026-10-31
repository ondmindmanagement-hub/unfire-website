import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
