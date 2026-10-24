'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'games', 'index.html'), 'utf8');

test('games landing is a standalone accessible route', () => {
  assert.match(html, /<html lang="es">/);
  assert.match(html, /<main id="content">/);
  assert.match(html, /href="#content"/);
  assert.match(html, /@media\(max-width:640px\)/);
  assert.match(html, /prefers-reduced-motion:reduce/);
  assert.match(html, /:focus-visible/);
  assert.match(html, /<title translate="no">Unfire Games/);
  assert.match(html, /class="notranslate"/);
  assert.match(html, /rel="canonical" href="https:\/\/unfire\.technology\/games\/"/);
});

test('play actions lead to the existing actual game, not a mock', () => {
  assert.equal((html.match(/href="\.\.\/audio\/"/g) || []).length, 3);
  assert.doesNotMatch(html, /href="[^"]+\.(exe|dmg|msi|app|zip)"/i);
  assert.match(html, /salas temporales P2P/);
  assert.match(html, /todavía no están publicadas/);
  assert.match(html, /no un servidor permanente/);
  assert.match(html, /sin conexión/);
});

test('all local static assets and link targets exist on disk', () => {
  const links = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map(match => match[1]);
  for (const link of links) {
    if (link.startsWith('#') || /^[a-z][a-z0-9+.-]*:/i.test(link)) continue;
    let target = link.split(/[?#]/)[0];
    if (target === '' && link.includes('?')) target = '../';
    const absolute = path.resolve(root, 'games', target);
    assert.ok(absolute.startsWith(root + path.sep) || absolute === root, 'link stays in repository: ' + link);
    assert.ok(fs.existsSync(absolute), 'missing target: ' + link);
    if (fs.statSync(absolute).isDirectory()) {
      assert.ok(fs.existsSync(path.join(absolute, 'index.html')), 'directory has index: ' + link);
    }
  }
  assert.match(html, /audio\/img\/unfire-mutants-share\.webp/);
});

test('languages and metadata are safe; no third-party client scripts', () => {
  const count = regex => (html.match(regex) || []).length;
  assert.ok(count(/data-es="/g) >= 25);
  assert.equal(count(/data-es="/g), count(/data-en="/g));
  assert.match(html, /data-set-lang="en"/);
  assert.match(html, /data-set-lang="es"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /alt="Arte original/);
  assert.doesNotMatch(html, /<script[^>]+src=/);
  assert.doesNotMatch(html, /<iframe\b/i);
  assert.doesNotMatch(html, /https?:\/\/(?:www\.)?(?:itch\.io|newgrounds\.com|poki\.com|crazygames\.com)/i);
  assert.doesNotMatch(html, /GoogleAnalytics|gtag\(|facebook\.net\/tr|stripe\.com\/checkout/i);
  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)];
  assert.equal(scripts.length, 1);
  assert.doesNotThrow(() => new vm.Script(scripts[0][1], { filename: 'games/index.html' }));
});
