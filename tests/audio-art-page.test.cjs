const assert=require('node:assert/strict');
const fs=require('node:fs');
const root=require('node:path').resolve(__dirname,'..');
const read=p=>fs.readFileSync(require('node:path').join(root,p),'utf8');
const html=read('audio/art/index.html');
const docs=read('docs/audio-art-open-calls-20261024.md')+read('docs/audio-creator-shorts-20261024.md');
for(const s of [html,docs])assert.ok(!s.includes(String.fromCharCode(8212)));
for(const name of ['unfire-mutants-share.webp','maletin-real-first-frame-desktop.webp','hyperwave-open.webp']){
assert.ok(fs.existsSync(require('node:path').join(root,'audio/img',name)));
assert.ok(html.includes('../img/'+name));
}
assert.ok(html.includes('Step inside the dream'));
assert.ok(html.includes('early, publicly accessible browser beta'));
assert.ok(!html.includes('<script'));
assert.ok(!html.includes('gtag('));
console.log('UNFIRE_ART_PAGE_PASS');
