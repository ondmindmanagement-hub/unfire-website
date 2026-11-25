// Isolated, dependency-free smoke checks for the five new Unfire initiatives.
// Does not test browser behavior, paid services or published deployment.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const pages = [
 'initiatives/index.html',
 'challenge/index.html',
 'challenge/rules/index.html',
 'developers/index.html',
 'science/index.html',
 'pilot-marketplace/index.html'
];
const read = p => fs.readFileSync(path.join(root, p), 'utf8');
test('all six pages use accessible English HTML shells, without active inputs', () => {
 for(const page of pages){
  const h = read(page);
  assert.match(h, /^<!doctype html>/i, page);
  assert.match(h, /<html lang="en">/i, page);
  assert.match(h, /<meta name="viewport"/i, page);
  assert.match(h, /<a class="skip" href="#main">/i, page);
  assert.match(h, /<main id="main">/i, page);
  assert.match(h, /<nav aria-label=/i, page);
  assert.equal((h.match(/<h1(?:\s|>)/ig) || []).length, 1, page);
  assert.doesNotMatch(h, /<input\b|<form\b|<iframe\b|<script\b/i, page);
  assert.doesNotMatch(h, /google-analytics|gtag\(|hotjar|facebook\.net/i, page);
 }
});
test('all internal links on new pages resolve to source-controlled routes', () => {
 let count = 0;
 for(const page of pages){
  const h=read(page);
  for(const m of h.matchAll(/href="(\/[^"#?]*)/g)){
   let loc=decodeURIComponent(m[1].split(/[?#]/)[0]);
   const dest=path.join(root,loc.replace(/^\/+/,''),loc.endsWith('/')?'index.html':'');
   assert.ok(dest.startsWith(root+path.sep) && fs.existsSync(dest), page+' -> '+loc);
   count++;
  }
 }
 assert.ok(count >= 50, 'Expected at least 50 checked internal links');
});
test('initiative copy distinguishes proposals from production availability', () => {
 assert.match(read('challenge/index.html'), /Call for interest and proposals/);
 assert.match(read('challenge/rules/index.html'), /Not yet an open formal competition/);
 assert.match(read('developers/index.html'), /not a public Bolt or Unfire Control SDK/);
 assert.match(read('science/index.html'), /No NASA, ESA, university or laboratory partnership claimed/);
 assert.match(read('pilot-marketplace/index.html'), /No checkout, contract, production deployment or guaranteed outcomes/);
 assert.match(read('initiatives/index.html'), /not a separately incorporated company/i);
});
test('reference example is licensed only in its own directory', () => {
 assert.match(read('developers/examples/LICENSE.txt'), /THIS EXAMPLE DIRECTORY/);
 assert.match(read('developers/examples/approval-gate.mjs'), /No external operations/);
 assert.match(read('developers/examples/README.md'), /not an official production SDK/i);
});
