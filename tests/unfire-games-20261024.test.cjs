'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const games=read('games/index.html');
const home=read('index.html');
const sitemap=read('sitemap.xml');
test('landing retains English-only, semantic, accessible navigation',()=>{
  for(const term of ['lang="en"','id="content"','href="#content"','data-en=','aria-labelledby="hero-title"','id="gallery"','id="hyperwave"','id="online"','id="install"'])assert.ok(games.includes(term),term);
  assert.match(games,/function setLanguage\(\)/);
  assert.doesNotMatch(games,/data-es=|data-set-lang=/);
  assert.match(games,/prefers-reduced-motion/);
  assert.match(games,/@media\(max-width:640px\)/);
  assert.match(games,/\.games-shots\{grid-template-columns:1fr\}/);
  assert.match(games,/translate="no"/);
});
test('screenshots are genuine images already tracked in game press directory',()=>{
  const shots=['09-night-flight-panorama.jpg','06-sky-flight-sunset.jpg','05-sky-flight-day.jpg','03-house-exterior.jpg','01-inside-house.jpg','04-island-exploration.jpg'];
  for(const f of shots){
    assert.ok(fs.existsSync(path.join(root,'audio/press/captures',f)),f);
    assert.ok(games.includes('../audio/press/captures/'+f),f);
  }
  assert.ok(games.includes('loading="lazy"'));
  assert.ok(!games.includes('AI-generated gameplay'), 'do not imply images created by AI');
});
test('Hyperwave is available but initialized only after click, with unload on close',()=>{
  assert.ok(fs.existsSync(path.join(root,'audio/hyperwave/index.html')));
  assert.ok(fs.existsSync(path.join(root,'audio/img/hyperwave-open.webp')));
  assert.ok(games.includes('id="play-hyperwave"'));
  assert.match(games,/<iframe[^>]*id="hyperwave-frame"[^>]*><\/iframe>/);
  assert.doesNotMatch(games,/<iframe[^>]*\ssrc=/);
  assert.ok(games.includes('frame.setAttribute("src","../audio/hyperwave/")'));
  assert.ok(games.includes('frame.removeAttribute("src")'));
  assert.ok(games.includes('id="hyperwave-embed" class="games-embed" hidden'));
  assert.doesNotMatch(games,/<canvas\b/);
});
test('shared-family wording does not claim universal synchronization',()=>{
  assert.ok(games.includes('shared navigation and access'));
  assert.ok(games.includes('remain separate experiences'));
  assert.ok(games.includes('cross-app or cross-device'));
  assert.ok(games.includes('href="../audio/"'));
  assert.ok(games.includes('href="../audio/press/"'));
});
test('home retains its existing Audio and Apps and adds Games once per nav',()=>{
  assert.equal((home.match(/href="\/games\/" class="notranslate"/g)||[]).length,2);
  assert.ok(home.includes('id="games" class="unfire-games-home"'));
  assert.ok(home.includes('id="audio"'));
  assert.ok(home.includes('id="apps"'));
  assert.ok(home.includes('href="/games/"'));
  assert.ok(home.includes('loading="lazy"'));
});
test('site discovery uses sitemap and canonical URL',()=>{
  assert.ok(sitemap.includes('https://unfire.technology/games/'));
  assert.ok(sitemap.includes('https://unfire.technology/audio/hyperwave/'));
  assert.ok(games.includes('<link rel="canonical" href="https://unfire.technology/games/">'));
  assert.ok(games.includes('property="og:image" content="https://unfire.technology/audio/press/captures/09-night-flight-panorama.jpg"'));
});
