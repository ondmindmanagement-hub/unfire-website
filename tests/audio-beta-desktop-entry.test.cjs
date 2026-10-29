'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const page=fs.readFileSync(path.join(root,'audio/beta/index.html'),'utf8');

test('beta PC gateway is a standalone, mobile-safe, lightweight HTML page',()=>{
  assert.match(page,/<!doctype html>/i);
  assert.match(page,/<html lang="en">/);
  assert.match(page,/name="viewport" content="width=device-width/);
  assert.match(page,/@media\(max-width:780px\)/);
  assert.match(page,/prefers-reduced-motion/);
  assert.doesNotMatch(page,/<iframe\b/i,'avoid a second WebGL renderer');
  assert.doesNotMatch(page,/<script[^>]+src=/i,'zero runtime dependencies');
});
test('true direct-to-game desktop CTA and playability copy',()=>{
  assert.match(page,/id="play"[^>]*href="\/audio\/\?utm_source=unfire_beta/);
  for(const word of ['WASD','Shift','Space','fly','map','robot'])assert.ok(page.includes(word),word);
  assert.match(page,/beta is still in development/i);
  assert.match(page,/No installation required/);
  assert.doesNotMatch(page,/\.exe|\.dmg|beta\.zip|coming soon to steam/i);
});
test('English-only beta stays in English without tracking or translation toggles',()=>{
  assert.doesNotMatch(page,/<button[^>]*data-language=/i,'no obsolete locale buttons');
  assert.match(page,/const copy=\{/);
  assert.match(page,/const l='en';document\.documentElement\.lang=l/);
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

test('the public beta has authentic OG previews and voluntary share without tracking',()=>{
  assert.match(page,/<meta property="og:image" content="https:\/\/unfire\.technology\/audio\/img\/unfire-mutants-share\.webp">/);
  assert.match(page,/<meta name="twitter:card" content="summary_large_image">/);
  assert.match(page,/<meta property="og:url" content="https:\/\/unfire\.technology\/audio\/beta\/">/);
  assert.match(page,/<button[^>]+id="share"[^>]+data-t="share"/);
  assert.match(page,/navigator\.share\(/);
  assert.match(page,/navigator\.clipboard\.writeText\(link\)/);
  assert.match(page,/id="shareStatus" role="status" aria-live="polite"/);
  assert.doesNotMatch(page,/google-analytics|gtag\(|umami|plausible|localStorage|sessionStorage|document\.cookie|fetch\(|sendBeacon|XMLHttpRequest/i);
});
