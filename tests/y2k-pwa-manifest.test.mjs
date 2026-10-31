import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manifest = JSON.parse(readFileSync(path.join(root,'audio/game.webmanifest'), 'utf8'));

test('selected Y2K ROBOTS identity, English copy and unchanged launch scope', () => {
  assert.equal(manifest.name, 'Y2K ROBOTS');
  assert.equal(manifest.short_name, 'Y2K ROBOTS');
  assert.equal(manifest.lang, 'en');
  assert.equal(manifest.id, '/audio/');
  assert.equal(manifest.start_url, './');
  assert.equal(manifest.scope, './');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.orientation, 'any');
  assert.match(manifest.description, /\b3D\b/);
  assert.doesNotMatch(manifest.description, /\b(juego|gratis|misiones|secretos|gratuito)\b/i);
});

test('only owner-approved PNG game identity is used in manifest', () => {
  assert.equal(manifest.icons.length, 2);
  for (const size of [192, 512]) {
    const icon = manifest.icons.find(i => i.sizes === `${size}x${size}`);
    assert.ok(icon);
    assert.equal(icon.type, 'image/png');
    assert.equal(icon.src, `img/y2k-robots-icon-${size}.png`);
    assert.equal(icon.purpose, 'any');
  }
});

test('exact owner-approved game icon files and dimensions', () => {
  const fixtures = [
    [192,'69a2f35b90f3c84c5355a809b64b92970acd0d957d3bd9363f5fe75c8326d842'],
    [512,'636d98b7510137224644558f397b5ad184e3f14bf09f96d0b70ad7524036141e']
  ];
  for (const [size, expected] of fixtures) {
    const icon = readFileSync(path.join(root,`audio/img/y2k-robots-icon-${size}.png`));
    assert.equal(icon.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
    assert.equal(icon.subarray(12,16).toString('ascii'),'IHDR');
    assert.equal(icon.readUInt32BE(16),size);
    assert.equal(icon.readUInt32BE(20),size);
    assert.equal(createHash('sha256').update(icon).digest('hex'),expected);
  }
});
