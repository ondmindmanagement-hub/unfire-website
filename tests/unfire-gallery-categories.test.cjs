'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const base = process.env.UNFIRE_GALLERY_URL || 'http://127.0.0.1:8771/';
const expected = {
  'apps-ai': ['BOLT', 'BOLT Mobile'],
  'apps-audio': ['ARCHER', 'ARCHER Mobile', 'Pocket Capture', 'Unfire Synthesizer'],
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
            bodyOverflow: document.documentElement.scrollWidth > innerWidth + 2,
            footnote: root.querySelector('.uf-gallery-footnote')?.textContent || '',
          };
        }, expected);
        assert.equal(summary.cards, 9);
        assert.equal(summary.images, 8); // KeyBridge intentionally uses a private, text-only research cover
        assert.equal(summary.emptyAlt, 0);
        assert.equal(summary.bodyOverflow, false, 'Horizontal overflow at ' + viewport.width);
        assert.equal(summary.cardsWithin, true, 'Cards spill out at ' + viewport.width);
        assert.equal(summary.categoryHeadersWithin, true, 'Category headings spill out at ' + viewport.width);
        assert.deepEqual(summary.nav, Object.keys(expected).map(x => '#' + x));
        assert.deepEqual(summary.groups, Object.entries(expected).map(([id,headings])=>({ id,headings })));
        for (const status of ['Product preview', 'Development preview', 'App preview · original app icon', 'Lab prototype · not a production sign-in system']) {
          assert(summary.tags.includes(status), 'Missing disclaimer ' + status);
        }
        assert(summary.footnote.includes('features and release status may change'));
        for (const image of await page.locator('#apps .uf-gallery-card img').all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate(el => el.decode());
          assert.equal(await image.evaluate(el => el.naturalWidth > 0 && el.naturalHeight > 0), true, 'Failed product image');
        }
        console.log('PASS gallery viewport ' + viewport.width + 'x' + viewport.height + ': 4 categories, 9 cards, no overflow, real images');
      } finally { await page.close(); }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
