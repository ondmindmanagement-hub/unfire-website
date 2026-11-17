'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const page = fs.readFileSync(path.join(__dirname, '../audio/maletin/index.html'), 'utf8');
const match = page.match(/<script id="ufDirectWebPhoneGuard">([\s\S]*?)<\/script>/);
assert.ok(match, 'direct-web-phone guard exists');
assert.ok(page.indexOf('id="ufDirectWebPhoneGuard"') < page.indexOf('src="app-mode.js'), 'guard runs before any potentially heavy scripts');
assert.ok(page.indexOf('id="ufDirectWebPhoneGuard"') < page.indexOf('rel="preload"'), 'guard runs before game-engine preload');

function run({name, ua, width = 390, pointer = true, mobileFlag = false,
  href = 'https://unfire.technology/audio/maletin/index.html?quality=compact',
  appSession = false, expectedRedirect = true}) {
  test(name, () => {
    const redirect = [];
    const url = new URL(href);
    const loc = {href, protocol:url.protocol, search:url.search, replace(x){redirect.push(x)}};
    const env = {
      navigator: {userAgent:ua,userAgentData:{mobile:mobileFlag}},
      matchMedia: () => ({matches:pointer && width<=540}),
      location:loc,
      URL,
      sessionStorage:{getItem:k=>k==='unfire_app' && appSession ? '1' : null}
    };
    vm.runInNewContext(match[1], env, {timeout:300});
    assert.equal(redirect.length, expectedRedirect?1:0, 'unexpected redirect state');
    if(expectedRedirect) assert.equal(redirect[0],new URL('../#hero',href).href);
  });
}

run({name:'Motorola Android direct link redirects without loading the game',ua:'Mozilla/5.0 (Linux; Android 15; moto g06 power) Chrome/127 Mobile Safari/537.36'});
run({name:'iPhone direct link redirects',ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile Safari/604.1'});
run({name:'Small Android direct link without Mobile token redirects',ua:'Mozilla/5.0 (Linux; Android 14; generic) Chrome/127 Safari/537.36'});
run({name:'Android tablet remains supported by existing game route',ua:'Mozilla/5.0 (Linux; Android 15; Pixel Tablet) Chrome/127 Safari/537.36',width:800,expectedRedirect:false});
run({name:'iPad remains on existing game route',ua:'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) Mobile Safari/604.1',width:768,expectedRedirect:false});
run({name:'Mac desktop stays in game',ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',width:1400,pointer:false,expectedRedirect:false});
run({name:'Windows desktop stays in game',ua:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/127',width:1400,pointer:false,expectedRedirect:false});
run({name:'App Store mobile WKWebView ?app=1 is exempt',ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',href:'https://unfire.technology/audio/maletin/index.html?app=1',expectedRedirect:false});
run({name:'Native iOS app user agent is exempt',ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Y2KRobotsApp',expectedRedirect:false});
run({name:'Native app custom URL scheme is exempt',ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',href:'y2k://bundle/audio/maletin/index.html',expectedRedirect:false});
run({name:'Native app session is exempt',ua:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)',appSession:true,expectedRedirect:false});
run({name:'User-Agent Client Hints phone redirects',ua:'TestBrowser',mobileFlag:true,expectedRedirect:true});
