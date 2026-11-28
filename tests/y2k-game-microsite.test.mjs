import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const site=fs.readFileSync(path.join(root,'games/y2k-robots/index.html'),'utf8');
const img=fs.readFileSync(path.join(root,'games/y2k-robots/robot-icon-512.png'));
test('draft product microsite is English-only, accessible and not prematurely indexed',()=>{
  assert.match(site,/<html lang="en">/);
  assert.match(site,/<title>Y2K ROBOTS/);
  assert.match(site,/<h1>Y2K<br>ROBOTS/);
  assert.match(site,/<meta name="robots" content="noindex,nofollow">/);
  assert.match(site,/href="\/audio\/"/);
  assert.match(site,/href="\/audio\/privacy.html"/);
  assert.match(site,/href="#main"/);
  assert.match(site,/@media\(prefers-reduced-motion:reduce\)/);
});
test('no fake platform download buttons, prices or third-party trackers',()=>{
  assert.doesNotMatch(site,/play\.google\.com\/store|apps\.microsoft\.com|steampowered\.com|DOWNLOAD.*ANDROID|BUY NOW|COMING TO STEAM/i);
  assert.doesNotMatch(site,/<script[^>]+src=|google-analytics|analytics\.js|sendBeacon/);
  assert.doesNotMatch(site,/Omar Baró|Tudela|@gmail\.com/);
});
test('gallery images are existing original press capture filenames',()=>{
  for(const file of ['04-island-exploration.jpg','05-sky-flight-day.jpg','09-night-flight-panorama.jpg']){
    assert.ok(fs.existsSync(path.join(root,'audio/press/captures',file)));
    assert.match(site,new RegExp(file.replaceAll('.','\\.')));
  }
});
test('only the original approved green robot icon has been staged',()=>{
  assert.equal(img.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(img.readUInt32BE(16),512);
  assert.equal(img.readUInt32BE(20),512);
  assert.equal(createHash('sha256').update(img).digest('hex'),'636d98b7510137224644558f397b5ad184e3f14bf09f96d0b70ad7524036141e');
});
