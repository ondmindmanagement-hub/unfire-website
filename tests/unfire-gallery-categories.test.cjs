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
          // Cards parked with data-archer-mobile-pending are intentionally not displayed yet.
          const allCards = [...root.querySelectorAll('.uf-gallery-card:not([data-archer-mobile-pending])')];
          const tags = [...root.querySelectorAll('.uf-gallery-availability')].map(x => x.textContent.trim());
          const nav = root.querySelector('.uf-gallery-taxonomy');
          const images = [...root.querySelectorAll('.uf-gallery-media img')];
          const icons = [...root.querySelectorAll('.uf-gallery-app-name img')];
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
            icons: icons.length,
            badIcons: icons.filter(i=>i.alt!==''||!i.getAttribute('src').startsWith('/assets/products/')).length,
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
        assert.equal(summary.images, 9); // Two authentic ARCHER Mobile device images; KeyBridge stays text-only
        assert.equal(summary.emptyAlt, 0);
        assert.equal(summary.icons, 9);
        assert.equal(summary.badIcons, 0);
        assert.equal(await page.locator('#apps .uf-gallery-card--control .uf-gallery-media img').count(), 1, 'Control must use its original app icon');
        assert.equal(await page.locator('#apps .uf-gallery-card--control a[href="/apps/unfire-control/"]').count(), 1, 'Control must offer product details');
        assert.equal(await page.locator('#apps .uf-gallery-media img[src*="keybridge"]').count(), 0, 'Never restore the unpublished private device capture');
        assert.equal(summary.bodyOverflow, false, 'Horizontal overflow at ' + viewport.width);
        assert.equal(summary.cardsWithin, true, 'Cards spill out at ' + viewport.width + ': ' + JSON.stringify({outside:summary.outside,layout:summary.layout}));
        assert.equal(summary.categoryHeadersWithin, true, 'Category headings spill out at ' + viewport.width);
        assert.deepEqual(summary.nav, Object.keys(expected).map(x => '#' + x));
        assert.deepEqual(summary.groups, Object.entries(expected).map(([id,headings])=>({ id,headings })));
        // Use the current live product statuses while preserving #75's Control image and link assertions.
        for (const status of ['Product preview · upcoming design, not the current App Store version', 'Development preview', 'Original app icon · Development preview', 'Lab prototype · not a production sign-in system']) {
          assert(summary.tags.includes(status), 'Missing disclaimer ' + status);
        }
        assert(summary.footnote.includes('features and release status may change'));
        for (const image of await page.locator('#apps .uf-gallery-card:not([data-archer-mobile-pending]) img').all()) {
          await image.scrollIntoViewIfNeeded();
          await image.evaluate(el => el.decode());
          assert.equal(await image.evaluate(el => el.naturalWidth > 0 && el.naturalHeight > 0), true, 'Failed product image');
        }
        // Translation stress test: preserve protected names and test longer Spanish labels.
        const hardware = await page.evaluate(() => {
          const root=document.querySelector('#hardware');
          root.querySelector('h2').textContent='Software que puedes sostener.';
          for(const tag of root.querySelectorAll('.uf-hw-top .tag')) tag.textContent='CONCEPTO DE DISEÑO · EXPLORAR DETALLES +';
          for(const li of root.querySelectorAll('.uf-spec li:last-child>span:last-child')) li.textContent='Representación CAD, todavía no existe un prototipo físico';
          const within=e=>{const r=e.getBoundingClientRect();return r.left>=-2&&r.right<=innerWidth+2&&e.scrollWidth<=e.clientWidth+2;};
          const cards=[...root.querySelectorAll('.uf-hw-item')];
          return {count:cards.length,allWithin:[...root.querySelectorAll('.uf-hw-item,.uf-hw-top,.uf-spec li,h3,.uf-hw-head')].every(within),overflow:document.documentElement.scrollWidth>innerWidth+2,columns:getComputedStyle(root.querySelector('.uf-hw-grid')).gridTemplateColumns.split(' ').length};
        });
        assert.equal(hardware.count,3,'Preserve all hardware concepts');
        assert.equal(hardware.allWithin,true,'Translated hardware overflow at '+viewport.width);
        assert.equal(hardware.overflow,false,'Translated homepage document overflow at '+viewport.width);
        assert.equal(hardware.columns,viewport.width<=1020?1:3,'Hardware responsive columns');
        const seamless=await page.evaluate(()=>[...document.querySelectorAll('#hardware .uf-hw-media')].map(el=>{
          const styles=getComputedStyle(el),media=[...el.querySelectorAll('img,video')].map(m=>{const cs=getComputedStyle(m);return {mask:cs.maskImage||cs.webkitMaskImage,composite:cs.maskComposite||cs.webkitMaskComposite,fit:cs.objectFit};});
          return {radius:styles.borderRadius,shadow:styles.boxShadow,media};
        }));
        assert.equal(seamless.length,3);
        for(const card of seamless){assert.equal(card.radius,'0px');assert.equal(card.shadow,'none');assert.equal(card.media.length,1);for(const m of card.media){assert.match(m.mask,/linear-gradient/);assert.equal(m.fit,'contain');}}

        // One video surface only; never a still poster underneath or a layout jump.
        const layers=await page.evaluate(()=>[...document.querySelectorAll('#hardware .uf-hw-media')].map(stage=>{
          const v=stage.querySelector('video'),initial=v.classList.contains('on');
          const state=()=>{const cs=getComputedStyle(v),r=v.getBoundingClientRect();return {transform:cs.transform,animation:cs.animationName,rect:[r.x,r.y,r.width,r.height]};};
          v.classList.remove('on');const before=state();v.classList.add('on');const after=state();v.classList.toggle('on',initial);
          return {children:stage.children.length,poster:v.hasAttribute('poster'),before,after};
        }));
        assert.equal(layers.length,3);
        for(const x of layers){assert.equal(x.children,1);assert.equal(x.poster,false);assert.equal(x.after.transform,'none');assert.equal(x.after.animation,'none');assert.deepEqual(x.before.rect,x.after.rect);}
        console.log('PASS gallery viewport ' + viewport.width + 'x' + viewport.height + ': 4 categories, 9 cards, no overflow, real images');
      } finally { await page.close(); }
    }
    // Real pointer churn without reduced-motion, including rapid scroll reversals.
    const page = await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'no-preference'});
    try {
      await page.goto(base,{waitUntil:'domcontentloaded'});
      const images=page.locator('#reach .uf-tier-media img');
      assert.equal(await images.count(),4);
      for(const image of await images.all()){
        await image.evaluate(el=>el.decode());
        await image.scrollIntoViewIfNeeded();
        const before=await image.boundingBox();
        for(let j=0;j<6;j++){await page.mouse.move(before.x+before.width/2,before.y+before.height/2);await page.mouse.move(1,1);}
        await image.hover();
        const state=await image.evaluate(el=>({transform:getComputedStyle(el).transform,transition:getComputedStyle(el).transitionDuration,decoded:el.naturalWidth>0}));
        assert.equal(state.transform,'none');assert.equal(state.transition,'0s');assert.equal(state.decoded,true);
        assert.deepEqual(await image.boundingBox(),before);
      }
      await page.evaluate(()=>{for(const id of ['hardware','reach','apps','reach'])document.getElementById(id).scrollIntoView({behavior:'instant'});});
      assert.equal(await page.locator('#reach .uf-tier-media img').evaluateAll(imgs=>imgs.every(i=>i.complete&&i.naturalWidth>0)),true);
      console.log('PASS rapid editorial pointer and scroll reversals');
      // Hold the first library request to exercise the cold-open path, not a warm cache.
      let release;const hold=new Promise(resolve=>{release=resolve;});
      await page.route('**/assets/vendor/three-r147/three.min.js',async route=>{await hold;await route.abort();});
      for(const key of ['synth','godslamp','control']){
        await page.locator('[data-hw="'+key+'"]').click();
        const dialog=page.locator('#uf-hw-dialog');
        assert.equal(await dialog.evaluate(el=>el.open),true);
        assert.equal(await dialog.locator('.uf-dlg-media img,.uf-dlg-media video').count(),0);
        assert.equal(await dialog.locator('.uf-3d-status').isVisible(),true);
        assert.equal(await dialog.locator('.uf-3d').count(),0);
        await dialog.locator('.uf-dlg-close').click();
      }
      release();
      console.log('PASS cold open: no photo/video fallback on any hardware detail');

    }finally{await page.close();}
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
