'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const html=fs.readFileSync(path.resolve(__dirname,'../pilot/intake/index.html'),'utf8');
const cspMeta=html.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)">/i);
const decode=t=>t.replaceAll('&#x27;',"'").replaceAll('&#39;',"'").replaceAll('&amp;','&');
const policy=cspMeta?decode(cspMeta[1]):'';
const directives=Object.fromEntries(policy.split(';').map(x=>x.trim()).filter(Boolean).map(x=>{
 const parts=x.split(/\s+/);return [parts[0],parts.slice(1)];
}));
test('CSP exists and blocks unsolicited form submissions and external network requests',()=>{
 assert.ok(cspMeta,'CSP meta must exist in the head');
 assert.ok(html.indexOf(cspMeta[0])<html.indexOf('<form'),'CSP must precede form');
 assert.deepEqual(directives['default-src'],["'none'"]);
 assert.deepEqual(directives['base-uri'],["'none'"]);
 assert.deepEqual(directives['form-action'],["'none'"]);
 assert.deepEqual(directives['object-src'],["'none'"]);
 assert.deepEqual(directives['connect-src'],["'none'"]);
 assert.deepEqual(directives['frame-src'],["'none'"]);
});
test('only local external scripts and exact SHA256 of approved inline JS are accepted',()=>{
 assert.ok(directives['script-src']?.includes("'self'"));
 assert.ok(!directives['script-src']?.includes("'unsafe-inline'"));
 assert.ok(!directives['script-src']?.includes("'unsafe-eval'"));
 const scripts=[...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)];
 const inline=scripts.filter(x=>!/\bsrc=/.test(x[1]));
 assert.equal(inline.length,1);
 const hash=crypto.createHash('sha256').update(inline[0][2],'utf8').digest('base64');
 assert.ok(directives['script-src'].includes("'sha256-"+hash+"'"),'CSP inline hash drift');
 for(const x of scripts.filter(x=>/\bsrc=/.test(x[1]))){
   assert.match(x[1],/\bsrc="\/assets\/js\/[^"]+"/);
   assert.doesNotMatch(x[1],/https?:\/\//);
 }
});
test('CSP allows only local styles and images and does not embed user-controlled inputs',()=>{
 assert.ok(directives['style-src']?.includes("'self'"));
 assert.ok(directives['img-src']?.includes("'self'"));
 assert.ok(directives['font-src']?.includes("'self'"));
 assert.equal(directives['media-src']?.join(','),"'self'");
 assert.ok(!html.includes('<base '));
 assert.ok(!html.includes('<iframe '));
});
