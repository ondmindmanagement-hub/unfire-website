// Unfire — selected external demo benchmarks. Dependency-free static release gates.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const ROOT=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(ROOT,p),'utf8');
const home=read('index.html');
const gallery=read('research/benchmarks/index.html');
const research=read('research/index.html');
const pageCSS=read('assets/css/unfire-benchmark-page-20261123.css');
const teaserCSS=read('assets/css/unfire-benchmark-teaser-20261123.css');
const ids=['hIwSHZT-eoQ','EbNaVOHnnvo','gM_wsjJBctM'];
test('home teaser is unique and links to dedicated gallery',()=>{
 assert.equal((home.match(/id="uf-benchmark-teaser"/g)||[]).length,1);
 assert.match(home,/href="\/research\/benchmarks\/"/);
 assert.match(home,/unfire-benchmark-teaser-20261123\.css/);
 assert.ok(home.indexOf('id="uf-benchmark-teaser"')<home.indexOf('id="scale"'));
});
test('the dedicated page is discoverable from the research section',()=>{
 assert.match(research,/href="\/research\/benchmarks\/"/);
 assert.match(gallery,/<link rel="canonical" href="https:\/\/unfire\.technology\/research\/benchmarks\/"/);
 assert.match(gallery,/<html lang="en">/);
});
test('all three official YouTube previews and source links are consistently present',()=>{
 for(const id of ids){
   for(const page of [home,gallery]){
     assert.match(page,new RegExp('https://www\\.youtube\\.com/watch\\?v='+id));
     assert.match(page,new RegExp('https://i\\.ytimg\\.com/vi/'+id+'/maxresdefault\\.jpg'));
     assert.match(page,/loading="lazy"/);
   }
 }
 assert.equal((home.match(/class="ufbm-card"/g)||[]).length,3);
 assert.equal((gallery.match(/class="project" aria-labelledby/g)||[]).length,3);
 assert.match(gallery,/dev\.meta\.ai\/resources\/blog\/meet-the-winners/);
});
test('external previews are linked, not locally copied or represented as Unfire prizes',()=>{
 for(const page of [home,gallery]){
  assert.match(page,/not Unfire products/);
  assert.match(page,/referrerpolicy="no-referrer"/);
  assert.match(page,/rel="noopener noreferrer"/);
  assert.doesNotMatch(page,/<iframe/);
 }
 assert.match(gallery,/not affiliated with, sponsored by or endorsed by/);
});
test('responsive, motion and accessibility gates',()=>{
 assert.match(teaserCSS,/@media\(max-width:600px\)/);
 assert.match(pageCSS,/@media\(max-width:520px\)/);
 for(const css of [teaserCSS,pageCSS])assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
 for(const page of [home,gallery]){
  assert.match(page,/aria-label=/);
  assert.match(page,/alt="/);
 }
});

test('creator videos load only after a first-party activation of official YouTube player',()=>{
 const script=read('assets/js/unfire-benchmark-embed-20261123.js');
 assert.match(script,/www\.youtube-nocookie\.com\/embed/);
 assert.match(script,/event\.preventDefault\(\)/);
 assert.match(script,/allowFullscreen=true/);
 assert.match(script,/replaceWith\(player\)/);
 assert.match(script,/event\.metaKey/);
 for(const page of [home,gallery]){
  assert.match(page,/unfire-benchmark-embed-20261123\.js/);
  for(const id of ids)assert.match(page,new RegExp('data-ufbm-video="'+id+'"'));
  assert.doesNotMatch(page,/<iframe\b/i);
 }
});
test('explicit source and privacy disclosures remain attached to both surfaces',()=>{
 assert.match(home,/YouTube may receive connection and playback data/);
 assert.match(gallery,/YouTube may receive connection and playback data/);
 assert.match(home,/Original video on YouTube/);
 assert.match(gallery,/separate direct link to its creator/);
});
