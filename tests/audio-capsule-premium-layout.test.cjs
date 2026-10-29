'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const page = fs.readFileSync(path.resolve(__dirname,'../audio/index.html'),'utf8');
const section = page.slice(page.indexOf('<section id="capsulas"'),page.indexOf('<!-- 5 · Precios:'));
test('capsule collection uses balanced stage and a meaningful scroll destination',()=>{
 assert.match(section, /class="sechead reveal capsule-head"/);
 assert.match(section,/class="btn btn-blue capsule-collection-link" href="#capGrid"/);
 assert.doesNotMatch(section,/href="#capsulas"[^>]*>▶ Explore all 100 ↓/);
 assert.match(page, /#capsulas \.gacha-wrap\{[^}]*grid-template-columns/);
 assert.match(page, /#capsulas \.gacha-wrap\{[^}]*max-width:1180px/);
 assert.match(page, /@media\(max-width:900px\)\{\s*#capsulas \.gacha-wrap\{grid-template-columns:minmax\(0,1fr\)/);
 assert.match(page, /@media\(max-width:500px\)/);
});
test('actual interactive canvas, spin handle, ball and all 100 collection remain in place',()=>{
 for(const id of ['globe','crank','ball','prize','prizeImg','prizeFam','prizeName','prizeTxt','capFilters','capGrid'])
   assert.match(section,new RegExp('id="'+id+'"'));
 assert.match(section, /aria-label="Spin the handle"/);
 assert.match(section, /aria-label="Open the capsule"/);
 assert.match(section, /DISCOVERY CONSOLE/);
 assert.match(section, /<b>01<\/b> Spin/);
 assert.match(section, /<b>02<\/b> Open/);
 assert.match(section, /<b>03<\/b> Explore/);
 assert.match(page, /const Gacha=\(\(\)=>\{/);
 assert.match(page, /CAPS\.forEach\(c=>\{/);
 assert.match(page, /CAPS\.filter\(c=>c\[2\]===k\)\.length/);
});
test('prize iframe insertion works with both initial and opened capsules',()=>{
 assert.match(section, /class="prize-visual"><img id="prizeImg"/);
 assert.match(page, /\$\('#prizeImg'\)\.after\(fr\)/);
 assert.match(page, /#capsulas #prize \.prize-visual:has\(#prizeFr\)/);
 assert.match(page, /#capsulas #prize \.prize-visual #prizeFr/);
 assert.doesNotMatch(page, /#capsulas #prize:has\(#prizeFr\) \.prize-visual\{display:none\}/);
 assert.match(page, /#capsulas \.prize-visual img\[src=""\]\{opacity:0\}/);
});
test('English-only labels, accessible focus and reduced-motion fallback',()=>{
 assert.match(section, /EXPLORE BY FAMILY/);
 assert.match(section, /Explore all 100/);
 assert.match(page, /#capsulas #capGrid a:focus-visible/);
 assert.match(page,/prefers-reduced-motion:reduce/);
 assert.doesNotMatch(section, /Efectos|Instrumentos|Ritmos|Cápsulas|Girar la manivela/i);
});
