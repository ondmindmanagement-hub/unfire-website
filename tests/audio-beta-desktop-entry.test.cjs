'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const page=fs.readFileSync(path.join(root,'audio/beta/index.html'),'utf8');

test('beta PC gateway is a standalone, mobile-safe, lightweight HTML page',()=>{
  assert.match(page,/<!doctype html>/i);
  assert.match(page,/<html lang="es">/);
  assert.match(page,/name="viewport" content="width=device-width/);
  assert.match(page,/@media\(max-width:780px\)/);
  assert.match(page,/prefers-reduced-motion/);
  assert.doesNotMatch(page,/<iframe\b/i,'avoid a second WebGL renderer');
  assert.doesNotMatch(page,/<script[^>]+src=/i,'zero runtime dependencies');
});
test('true direct-to-game desktop CTA and playability copy',()=>{
  assert.match(page,/id="play"[^>]*href="\/audio\/\?utm_source=unfire_beta/);
  for(const word of ['WASD','Shift','Espacio','fly','map','robot'])assert.ok(page.includes(word),word);
  assert.match(page,/Versi[oó]n beta en desarrollo/);
  assert.match(page,/No installation required/);
  assert.doesNotMatch(page,/\.exe|\.dmg|beta\.zip|coming soon to steam/i);
});
test('Spanish/English toggle works without tracking, and Unfire name remains unchanged',()=>{
  assert.match(page,/data-language="es"/);
  assert.match(page,/data-language="en"/);
  assert.match(page,/const copy=\{/);
  assert.match(page,/document\.documentElement\.lang=l/);
  assert.match(page,/translate="no">UNFIRE/);
  assert.match(page,/aria-pressed/);
  assert.doesNotMatch(page,/google-analytics|gtag\(|umami|plausible|localStorage|sessionStorage|document\.cookie|fetch\(|sendBeacon|XMLHttpRequest/i,'no unconsented tracking');
});
test('real existing creative asset and public contact link',()=>{
  assert.ok(fs.existsSync(path.join(root,'audio/img/unfire-mutants-share.webp')));
  assert.match(page,/src="\.\.\/img\/unfire-mutants-share.webp"/);
  assert.match(page,/mailto:hello@unfire\.technology/);
  assert.doesNotMatch(page,/\b\d+[KkMm]?\+? players\b|\b\d+[KkMm]?\+? jugadores\b/i,'do not fabricate users');
});
