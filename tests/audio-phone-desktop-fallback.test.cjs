'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../audio/index.html'), 'utf8');
const gate = html.match(/<script id="ufPhoneGate">([\s\S]*?)<\/script>/)?.[1];
assert.ok(gate, 'phone gate is present before rendering');
assert.ok(html.indexOf('id="ufPhoneGate"') < html.indexOf('<link rel="stylesheet"'), 'phone classification happens before CSS and deferred scripts');

function classify({ua, width = 390, coarse = true, mobileFlag = false}) {
  const classes = new Set();
  const context = {
    navigator: {userAgent: ua, userAgentData: {mobile: mobileFlag}},
    matchMedia: query => ({matches: coarse && width <= 540 && query.includes('max-width')}),
    document: {documentElement: {classList: {add: value => classes.add(value)}}}
  };
  vm.runInNewContext(gate, context, {timeout: 200});
  return classes.has('uf-phone-safe');
}

for (const {name, ua, width, coarse, mobileFlag, expected} of [
  {name: 'Motorola Android', ua: 'Mozilla/5.0 (Linux; Android 15; moto g06 power) AppleWebKit/537.36 Chrome/127 Mobile Safari/537.36', expected: true},
  {name: 'iPhone', ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1', expected: true},
  {name: 'small Android without Mobile marker', ua: 'Mozilla/5.0 (Linux; Android 14; generic) Chrome/123 Safari/537.36', width: 412, expected: true},
  {name: 'Android tablet', ua: 'Mozilla/5.0 (Linux; Android 15; Pixel Tablet) Chrome/130 Safari/537.36', width: 800, expected: false},
  {name: 'iPad', ua: 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile/15E148 Safari/604.1', width: 768, expected: false},
  {name: 'Mac', ua: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15', width: 1440, coarse: false, expected: false},
  {name: 'Windows', ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128 Safari/537.36', width: 1280, coarse: false, expected: false},
  {name: 'UA-CH reports a phone', ua: 'CustomBrowser', mobileFlag: true, expected: true},
]) test('phone classification: ' + name, () => assert.equal(classify({ua, width, coarse, mobileFlag}), expected));

test('phone fallback is accessible, truthful and retains the rest of Unfire Audio', () => {
  assert.match(html, /id="ufPhoneNotice" role="region" aria-labelledby="ufPhoneTitle"/);
  assert.match(html, /id="ufPhoneTitle"/);
  assert.match(html, /Continue on a PC or Mac\./);
  assert.match(html, /href="#instrumentos">Explore Unfire Audio/);
  assert.match(html, /html\.uf-phone-safe #ufPhoneNotice\{\s*display:flex!important/);
  assert.match(html, /html\.uf-phone-safe #malFrame/);
  assert.match(html, /html\.uf-phone-safe #field/);
  assert.match(html, /<iframe id="malFrame" data-src="maletin\/index\.html/);
  assert.match(html, /id="heroPin"/);
});

test('phone never starts a parent-page 3D game or an auxiliary 3D preview', () => {
  assert.match(html, /const UNFIRE_SCENE=\(\(\)=>\{\s*if\(document\.documentElement\.classList\.contains\('uf-phone-safe'\)\)return \{start\(\)\{\},onReady\(\)\{\},isReady\(\)\{return false\}\};/);
  assert.match(html, /function showDev\(c\)\{if\(document\.documentElement\.classList\.contains\('uf-phone-safe'\)\)return;/);
  assert.match(html, /3D previews are available on PC and Mac/);
  assert.match(html, /const Field=\(\(\)=>\{\s*if\(document\.documentElement\.classList\.contains\('uf-phone-safe'\)\)return \{setMode\(\)\{\},setTint\(\)\{\}\};/);
  assert.match(html, /const CaseSfx=\(\(\)=>\{if\(document\.documentElement\.classList\.contains\('uf-phone-safe'\)\)return \{play\(\)\{\}\};/);
  assert.match(html, /if\(document\.documentElement\.classList\.contains\('uf-phone-safe'\)\)return;try\{var c=document\.createElement\('canvas'\)/);
  assert.match(html, /<script id="ufAdaptiveBoot">\(function\(\)\{\s*if\(document\.documentElement\.classList\.contains\("uf-phone-safe"\)\)return;/);
});
