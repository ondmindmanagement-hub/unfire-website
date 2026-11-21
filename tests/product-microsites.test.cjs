"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const pages = [
  ["portable-synth/index.html", "https://unfire.technology/portable-synth/"],
  ["portable-synth/play/index.html", "https://unfire.technology/portable-synth/play/"],
  ["games/y2k-robots/index.html", "https://unfire.technology/games/y2k-robots/"]
];
function targetExists(url) {
  if (url.startsWith("#") || url.startsWith("mailto:") || url.startsWith("https:")) return true;
  if (!url.startsWith("/") || url.startsWith("//")) return false;
  const pathname = url.split(/[?#]/)[0];
  const local = path.resolve(root, "." + pathname);
  if (local !== root && !local.startsWith(root + path.sep)) return false;
  return fs.existsSync(local) && fs.statSync(local).isFile() ||
    fs.existsSync(path.join(local, "index.html"));
}
test("every new product page has unique semantic identity and valid first-party references", () => {
  const seen = new Set();
  for (const [file, canonical] of pages) {
    const html = read(file);
    assert.match(html, /<!doctype html>/i);
    assert.match(html, /<html lang="en">/i);
    assert.equal((html.match(/<h1\b/g) || []).length, 1, file + ": H1");
    assert.match(html, /<main\b/);
    assert.match(html, /<meta name="description" content="[^"]{55,}"/i);
    assert.match(html, /<link rel="canonical" href="[^"]+">/);
    assert.ok(html.includes('href="' + canonical + '"'), file + ": canonical mismatch");
    assert.ok(!seen.has(canonical)); seen.add(canonical);
    assert.match(html, /<meta property="og:title"/);
    assert.match(html, /<meta property="og:description"/);
    assert.match(html, /<a class="skip" href="#main">Skip to content<\/a>/);
    assert.match(html, /<script type="application\/ld\+json">\{.*?<\/script>/s);
    for (const match of html.matchAll(/\b(?:href|src)="([^"]+)"/g)) {
      const url = match[1];
      assert.ok(targetExists(url), file + ": broken/unsafe reference " + url);
    }
  }
});
test("sitemap contains new, known and distinct canonical routes", () => {
  const xml = read("sitemap.xml");
  const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
  assert.equal(urls.length, new Set(urls).size, "duplicate sitemap URLs");
  for (const url of [
    ...pages.map(p => p[1]),
    "https://unfire.technology/portable-synth/beta/",
    "https://unfire.technology/audio/tienda/"
  ]) assert.ok(urls.includes(url), "missing " + url);
  assert.match(xml, /<urlset\b/); assert.match(xml, /<\/urlset>/);
  assert.match(read("robots.txt"), /Sitemap: https:\/\/unfire\.technology\/sitemap\.xml/);
});
test("genuine preview and release-status boundaries are explicit", () => {
  const synth = read("portable-synth/index.html");
  const game = read("games/y2k-robots/index.html");
  const play = read("portable-synth/play/index.html");
  assert.match(synth, /closed testing, not a general public release/);
  assert.match(game, /not a Steam release/);
  assert.match(game, /not a native PC release screenshot/);
  assert.match(play, /not<\/strong> the full Portable Synth Daw Android application/);
  assert.match(play, /does not transmit or record audio/);
  assert.ok(!/https:\/\/store\.steampowered\.com/.test(game));
  assert.ok(!/<script\s+src="https?:/.test(play));
});
test("browser synth has twelve real keys and quick-touch cancellation", () => {
  const html = read("portable-synth/play/index.html");
  const js = read("portable-synth/play/synth.js");
  assert.equal((html.match(/data-semitone="\d+"/g) || []).length, 12);
  assert.match(js, /new AudioContextClass\(\)/);
  assert.match(js, /ctx\.createOscillator\(\)/);
  assert.match(js, /pending\.add\(source\)/);
  assert.match(js, /pending\.delete\(source\)/);
  assert.ok(!/\b(fetch|XMLHttpRequest|sendBeacon|localStorage)\b/.test(js));
});
test("existing product and game hubs link to their new dedicated pages", () => {
  assert.match(read("games/index.html"), /href="\/games\/y2k-robots\/"/);
  assert.match(read("portable-synth/beta/index.html"), /href="\/portable-synth\/"/);
  assert.match(read("portable-synth/index.html"), /href="\/portable-synth\/play\/"/);
});