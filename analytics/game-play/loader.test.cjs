'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'loader.js'),'utf8');
function fixture(o={}){
 let appended=[],tracked=0;
 const doc={head:{appendChild(s){appended.push(s);}},createElement(name){
  assert.equal(name,'script');return {attrs:{},setAttribute(k,v){this.attrs[k]=v;}};
 }};
 const w={
  document:doc,
  navigator:Object.assign({globalPrivacyControl:false,doNotTrack:'0'},o.navigator||{}),
  location:{protocol:o.protocol||'https:',hostname:o.hostname||'unfire.technology'},
  __UNFIRE_ANALYTICS_RELEASE_APPROVED:o.release===true,
  __UNFIRE_ANALYTICS_PRIVACY_GATE:o.privacy===true,
  __UNFIRE_ANALYTICS_APPROVED:false,
  umami:{track(){tracked++;return Promise.resolve();}}
 };
 vm.runInNewContext(source,{window:w});
 return {window:w,appended,tracked:()=>tracked};
}
const uuid='a94ad70d-d2ed-458d-85e6-8a14fd128e6d';
test('script not injected merely by loading this file',()=>{
 const f=fixture({release:true,privacy:true});assert.equal(f.appended.length,0);
});
test('requires BOTH explicit release and privacy gates',()=>{
 for(const x of [{release:false,privacy:false},{release:true,privacy:false},{release:false,privacy:true}]){
  const f=fixture(x);assert.equal(f.window.UnfirePlayMetricsLoader.enable(uuid),false);assert.equal(f.appended.length,0);
 }
});
test('invalid ID, wrong hostname, HTTP and GPC never load a third-party script',()=>{
 for(const x of [{release:true,privacy:true,hostname:'localhost'},{release:true,privacy:true,protocol:'http:'},{release:true,privacy:true,navigator:{globalPrivacyControl:true}}]){
  const f=fixture(x);assert.equal(f.window.UnfirePlayMetricsLoader.enable(uuid),false);assert.equal(f.appended.length,0);
 }
 const f=fixture({release:true,privacy:true});assert.equal(f.window.UnfirePlayMetricsLoader.enable('example-website-id'),false);
});
test('approved loader creates only one script with protective attributes',()=>{
 const f=fixture({release:true,privacy:true}),api=f.window.UnfirePlayMetricsLoader;
 assert.equal(api.enable(uuid),true);assert.equal(api.enable(uuid),false);assert.equal(f.appended.length,1);
 const s=f.appended[0];assert.equal(s.src,'https://cloud.umami.is/script.js');
 assert.equal(s.attrs['data-website-id'],uuid);
 assert.equal(s.attrs['data-auto-pageview'],'false');
 assert.equal(s.attrs['data-exclude-search'],'true');
 assert.equal(s.attrs['data-do-not-track'],'true');
 assert.equal(f.tracked(),0);
 s.onload();
 assert.equal(f.tracked(),1);
 assert.equal(f.window.__UNFIRE_ANALYTICS_APPROVED,true);
});
test('revoked privacy before asynchronous onload prevents even pageview',()=>{
 const f=fixture({release:true,privacy:true}),api=f.window.UnfirePlayMetricsLoader;
 api.enable(uuid);api.revoke();f.appended[0].onload();
 assert.equal(f.tracked(),0);assert.equal(f.window.__UNFIRE_ANALYTICS_APPROVED,false);
});
test('revoke immediately blocks collector event gate',()=>{
 const f=fixture({release:true,privacy:true}),api=f.window.UnfirePlayMetricsLoader;
 api.enable(uuid);f.appended[0].onload();api.revoke();
 assert.equal(f.window.__UNFIRE_ANALYTICS_APPROVED,false);assert.equal(f.window.__UNFIRE_ANALYTICS_PRIVACY_GATE,false);
});
test('DNT suppresses script injection',()=>{
 const f=fixture({release:true,privacy:true,navigator:{doNotTrack:'1'}});
 assert.equal(f.window.UnfirePlayMetricsLoader.enable(uuid),false);assert.equal(f.appended.length,0);
});
test('script has no fixed website identifier or credentials',()=>{
 assert.doesNotMatch(source,/Bearer |access_token|secret_key|apiKey\s*:/i);
 assert.doesNotMatch(source,/[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
});
