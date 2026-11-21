'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.env.UNFIRE_GALLERY_URL || 'http://127.0.0.1:8771/';
const expected = {
  'apps-ai': ['BOLT', 'BOLT Mobile'],
  'apps-audio': ['ARCHER', 'ARCHER Mobile', 'Pocket Capture', 'Unfire Synthesizer I'],
  'apps-control': ['Unfire Control', 'Unfire KeyBridge'],
  'apps-energy': ['Power'],
};
const viewports = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 568, height: 320 },
  { width: 768, height: 1024 },
  { width: 1280, height: 800 },
];

(async () => {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport, reducedMotion: 'reduce' });
      try {
        await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.locator('#apps').scrollIntoViewIfNeeded();
        const summary = await page.evaluate((expected) => {
          const root = document.querySelector('#apps');
          const groupIds = Object.keys(expected);
          const groups = [...root.querySelectorAll('.uf-gallery-category')];
          const allCards = [...root.querySelectorAll('.uf-gallery-card')];
          const tags = [...root.querySelectorAll('.uf-gallery-availability')].map(x => x.textContent.trim());
          const nav = root.querySelector('.uf-gallery-taxonomy');
          const images = [...root.querySelectorAll('.uf-gallery-card img')];
          const within = el => {
            const r = el.getBoundingClientRect();
            return r.width > 0 && r.right <= innerWidth + 2 && r.left >= -2;
          };
          return {
            groups: groups.map(g => ({ id:g.id, headings:[...g.querySelectorAll('.uf-gallery-card h4')].map(x=>x.textContent.trim()) })),
            nav: [...nav.querySelectorAll('a')].map(x=>x.getAttribute('href')),
            cards: allCards.length,
            tags,
            images: images.length,
            emptyAlt: images.filter(i=>!i.alt.trim()).length,
            categoryHeadersWithin: groups.every(g=>within(g.querySelector('.uf-gallery-category-head'))),
            cardsWithin: allCards.every(within),
            outside: allCards.filter(x=>!within(x)).map(x=>({name:x.querySelector('h4')?.textContent, left:x.getBoundingClientRect().left, right:x.getBoundingClientRect().right, width:x.getBoundingClientRect().width, grid:x.parentElement.getBoundingClientRect().width, columns:getComputedStyle(x.parentElement).gridTemplateColumns})),
            bodyOverflow: document.documentElement.scrollWidth > innerWidth + 2,
            layout: (()=>{const root=document.querySelector('#apps');const wrap=root.querySelector('.wrap');const g=root.querySelector('.uf-gallery-grid');const rect=el=>{const r=el.getBoundingClientRect();const cs=getComputedStyle(el);return {left:r.left,right:r.right,width:r.width,cssWidth:cs.width,padLeft:cs.paddingLeft,padRight:cs.paddingRight,box:cs.boxSizing,marginLeft:cs.marginLeft,transform:cs.transform,overflowX:cs.overflowX}};return {viewport:innerWidth,root:rect(root),wrap:rect(wrap),grid:rect(g),scrollX:scrollX}})(),
            footnote: root.querySelector('.uf-gallery-footnote')?.textContent || '',
          };
        }, expected);
        assert.equal(summary.cards, 9);
        assert.equal(summary.images, 10); // Authentic paired ARCHER Mobile and Synth I screenshots; KeyBridge stays text-only
        assert.equal(summary.emptyAlt, 0);
        assert.equal(await page.locator('#apps .uf-gallery-card--control img').count(), 1, 'Control must use its original app icon');
        assert.equal(await page.locator('#apps .uf-gallery-card--control a[href="/apps/unfire-control/"]').count(), 1, 'Control must offer product details');
        assert.equal(await page.locator('#apps .uf-gallery-card img[src*="keybridge"]').count(), 0, 'Never restore the unpublished private device capture');
        assert.equal(summary.bodyOverflow, false, 'Horizontal overflow at ' + viewport.width);
        assert.equal(summary.cardsWithin, true, 'Cards spill out at ' + viewport.width + ': ' + JSON.stringify({outside:summary.outside,layout:summary.layout}));
        assert.equal(summary.categoryHeadersWithin, true, 'Category headings spill out at ' + viewport.width);
        assert.deepEqual(summary.nav, Object.keys(expected).map(x => '#' + x));
        assert.deepEqual(summary.groups, Object.entries(expected).map(([id,headings])=>({ id,headings })));
        // Assert current Control and Synth I disclaimers together; no private media.
        for (const status of ['Product preview · upcoming design, not the current App Store version', 'Development previews · not the approved App Store release', 'Original app icon · Development preview', 'Lab prototype · not a production sign-in system']) {
          assert(summary.tags.includes(status), 'Missing disclaimer ' + status);
        }
        assert(summary.footnote.includes('features and release status may change'));
        for (const image of await page.locator('#apps .uf-gallery-card img').all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate(el => el.decode());
          assert.equal(await image.evaluate(el => el.naturalWidth > 0 && el.naturalHeight > 0), true, 'Failed product image');
        }
        console.log('PASS gallery viewport ' + viewport.width + 'x' + viewport.height + ': 4 categories, 9 cards, 10 genuine images, no overflow');
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
