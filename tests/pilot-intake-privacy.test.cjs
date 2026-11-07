'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const page=fs.readFileSync(path.resolve(__dirname,'../pilot/intake/index.html'),'utf8');
const form=page.match(/<form\b[^>]*id="intake"[^>]*>([\s\S]*?)<\/form>/)?.[0];
const code=page.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
const ids=['org','contact','sector','owner','problem','outcome','scope','timing'];
function harness(){
 const elements=new Map(),trace=[];
 for(const id of [...ids,'intake','status','previewBox','preview','prepareEnquiry','openEmail','copyEmail']){
  elements.set(id,{value:'',hidden:id==='previewBox',disabled:id==='prepareEnquiry',textContent:'',listeners:{},
   addEventListener(type,handler){this.listeners[type]=handler;trace.push(id+':'+type)},
   checkValidity(){return true},reportValidity(){},scrollIntoView(){},focus(){},select(){}});
 }
 const el=id=>elements.get(id);
 const location={href:'https://fixture.example.invalid/pilot/intake/'};
 const clipboard={copied:null,async writeText(v){this.copied=v}};
 vm.runInNewContext(code,{document:{getElementById:el},window:{location},navigator:{clipboard},
   encodeURIComponent,fetch(){throw Error('network action forbidden')}},{timeout:500});
 return {el,location,clipboard,trace};
}
function fill(h){
 const values={
 org:'FICTIONAL STUDY',contact:'reviewer@example.invalid',sector:'Textiles / supply chain',
 owner:'Yes — I own this workflow',problem:'Completely fictional materials have missing declarations.',
 outcome:'A reproducible synthetic review report with human oversight.',
 scope:'Budget not confirmed',timing:'Exploratory / no date'
 };
 for(const [id,v] of Object.entries(values))h.el(id).value=v;
}
function submit(h){let prevented=false;h.el('intake').listeners.submit({preventDefault(){prevented=true}});return prevented}
test('the eight buyer fields are unnamed and cannot enter fallback GET query parameters',()=>{
 assert.ok(form);
 const controls=[...form.matchAll(/<(?:input|select|textarea)\b[^>]*>/gi)].map(x=>x[0]);
 assert.equal(controls.length,8);
 for(const id of ids){
  const tag=controls.find(t=>t.includes('id="'+id+'"'));
  assert.ok(tag,id);
  assert.doesNotMatch(tag,/\bname\s*=/i);
 }
 assert.doesNotMatch(form,/\baction\s*=/i);
});
test('no script disables submission and offers direct email guidance',()=>{
 assert.match(form,/<button[^>]*id="prepareEnquiry"[^>]*type="submit"[^>]*disabled>/);
 assert.match(page,/<noscript>[\s\S]*JavaScript is required[\s\S]*mailto:hello@unfire\.technology[\s\S]*<\/noscript>/);
});
test('the listener is installed before enabling submit',()=>{
 const h=harness();
 assert.deepEqual(h.trace,['intake:submit','openEmail:click','copyEmail:click']);
 assert.equal(h.el('prepareEnquiry').disabled,false);
});
test('valid synthetic enquiry prepares a local preview without navigation',()=>{
 const h=harness();fill(h);assert.equal(submit(h),true);
 assert.equal(h.el('previewBox').hidden,false);
 assert.match(h.el('preview').value,/reviewer@example\.invalid/);
 assert.match(h.el('status').textContent,/Nothing has been sent/);
 assert.equal(h.location.href,'https://fixture.example.invalid/pilot/intake/');
});
test('invalid browser input does not prepare anything',()=>{
 const h=harness();fill(h);let called=false;
 h.el('intake').checkValidity=()=>false;h.el('intake').reportValidity=()=>{called=true};
 assert.equal(submit(h),true);assert(called);
 assert.equal(h.el('previewBox').hidden,true);
 assert.equal(h.location.href,'https://fixture.example.invalid/pilot/intake/');
});
test('too-short desired outcome is blocked',()=>{
 const h=harness();fill(h);h.el('outcome').value='short';submit(h);
 assert.equal(h.el('previewBox').hidden,true);
 assert.match(h.el('status').textContent,/more detail/);
});
test('only explicit click can open the mail app',()=>{
 const h=harness();fill(h);submit(h);
 assert.equal(h.location.href,'https://fixture.example.invalid/pilot/intake/');
 h.el('openEmail').listeners.click();
 assert.match(h.location.href,/^mailto:hello@unfire\.technology/);
 assert.match(decodeURIComponent(h.location.href),/FICTIONAL STUDY/);
});
test('clipboard copying requires a separate explicit click',async()=>{
 const h=harness();fill(h);submit(h);assert.equal(h.clipboard.copied,null);
 await h.el('copyEmail').listeners.click();
 assert.match(h.clipboard.copied,/To: hello@unfire\.technology/);
});
