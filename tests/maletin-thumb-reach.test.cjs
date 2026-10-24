'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const html=fs.readFileSync('audio/maletin/index.html','utf8');
const css=fs.readFileSync('audio/maletin/thumb-reach.css','utf8');
assert.equal((html.match(/thumb-reach\.css\?v=20261023thumb1/g)||[]).length,1);
assert(html.indexOf('thumb-reach.css')>html.indexOf('mobile-hud-guard.css'));
assert(css.includes('@media (pointer:coarse)'));
assert(css.includes('body.unfire-roaming #unfireTouchPad'));
for(const id of ['unfireTouchPad','unfireTouchKnob','unfireFly','unfireTalk','unfireDown']){
  assert(css.includes('#'+id),'missing existing control '+id);
  assert(html.includes('#'+id),'missing base control selector '+id);
}
assert(css.includes('env(safe-area-inset-left'));
assert(css.includes('env(safe-area-inset-right'));
assert(css.includes('env(safe-area-inset-bottom'));
assert(css.includes('orientation:portrait')&&css.includes('orientation:landscape'));
assert(css.includes('max-height:430px'));
assert(css.includes('max-width:420px'));
assert(css.includes('prefers-reduced-motion:reduce'));
assert(!css.includes('display:none'),'gameplay controls not hidden');
assert(!css.includes('pointer-events:none!important;\n  }\n  body.unfire-roaming #unfireFly'),'do not block primary action');
assert(!css.includes('position:absolute'),'no unanchored scene overlays');
assert(!css.includes('@import')&&!css.includes('url('),'no network assets');
console.log('PASS thumb-reach: touch-only, safe-areas, landscape/portrait, small phone, iPad, selectors preserved');
