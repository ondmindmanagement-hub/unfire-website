'use strict';
// Offline, deterministic, first-party release assertions for Unfire enterprise enquiries.
// Not a legal approval, buyer validation or complete WCAG test.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const html = fs.readFileSync(path.resolve(__dirname, '../enterprise/engagements/index.html'), 'utf8');

function one(regex, purpose) {
  const values = [...html.matchAll(regex)];
  assert.equal(values.length, 1, purpose + ': expected exactly one');
  return values[0];
}

test('complete self-contained HTML with one enterprise enquiry form', () => {
  assert.match(html, /^<!doctype html>/i);
  assert.equal((html.match(/<html\b/gi) || []).length, 1);
  assert.equal((html.match(/<main\b/gi) || []).length, 1);
  assert.equal((html.match(/<form\b/gi) || []).length, 1);
  assert.match(html, /<form id="enterprise-form" novalidate>/);
  assert.match(html, /<\/html>\s*$/);
});

test('declared production route and no private-preview indexing metadata', () => {
  one(/<link rel="canonical" href="https:\/\/unfire\.technology\/enterprise\/engagements\/">/g, 'canonical link');
  assert.match(html, /<meta name="robots" content="index,follow">/);
  assert.doesNotMatch(html, /Private design preview|Private review · No public offer|CSP_HASH_TO_REPLACE/);
});

test('four models are explicitly potential engagements, never finished products', () => {
  for (const tier of ['Autonomy Core', 'Autonomy Operations', 'Autonomy Command', 'Enterprise Foundry']) {
    assert.ok(html.includes('data-tier="' + tier + '"'), tier + ' CTA missing');
    assert.ok(html.includes('<option>' + tier + '</option>'), tier + ' selector missing');
  }
  assert.match(html, /not finished enterprise products, approved prices or guarantees of availability/);
  assert.match(html, /No third-party client results or certified savings are claimed here/);
  assert.match(html, /not a purchase, reservation, contract or claim that an enterprise product is production ready/);
});

test('no public internal quote or fictitious client proof', () => {
  assert.doesNotMatch(html, /EUR\s*(?:18,000|36,000|65,000|150,000)|\b€\s*(?:18\.000|36\.000|65\.000|150\.000)\b/);
  assert.doesNotMatch(html, /"caseStudy":|"testimonial":|customer-logo|certified enterprise-grade/);
  // Buyer budget options may contain EUR 20k–150k; these are not public prices.
  assert.match(html, /These are budget ranges for qualification, not Unfire prices|The budget ranges are for qualification, not Unfire prices/);
});

test('offline CSP is current and blocks network and form submission', () => {
  const csp = one(/<meta http-equiv="Content-Security-Policy" content="([^"]+)">/g, 'CSP')[1];
  const script = one(/<script>([\s\S]*?)<\/script>/g, 'inline script')[1];
  const digest = crypto.createHash('sha256').update(script).digest('base64');
  assert.ok(csp.includes("'sha256-" + digest + "'"), 'script CSP hash stale');
  for (const directive of ["default-src 'none'", "connect-src 'none'", "form-action 'none'", "frame-src 'none'", "object-src 'none'"]) {
    assert.ok(csp.includes(directive), directive + ' missing');
  }
  assert.doesNotMatch(html, /<script[^>]+src=|<iframe\b|<form[^>]+\baction=|<link[^>]+href="https?:\/\/[^"]+\.(?:css|js)"/i);
  assert.doesNotMatch(script, /\bfetch\s*\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie/);
});

test('business form fields require a genuine problem and a contact', () => {
  for (const id of ['company', 'email', 'tier', 'authority', 'problem', 'outcome', 'budget', 'timing']) {
    assert.ok(html.includes('id="' + id + '"'), 'missing ' + id);
    assert.ok(html.includes('for="' + id + '"'), 'unlabeled ' + id);
  }
  assert.match(html, /<input id="email" required maxlength="150" type="email"/);
  assert.match(html, /<textarea id="problem" required minlength="20"/);
  assert.match(html, /<textarea id="outcome" required minlength="12"/);
  assert.match(html, /f\.checkValidity\(\)/);
  assert.match(html, /f\.reportValidity\(\)/);
  for (const tag of html.match(/<(?:input|textarea|select)\b[^>]*>/g) || []) {
    assert.doesNotMatch(tag, /\sname\s*=/i, 'named field could be posted or serialized unexpectedly');
  }
});

test('business enquiry preview is explicit local-only and no email is auto-sent', () => {
  assert.match(html, /This page does not transmit your answers automatically/);
  assert.match(html, /Nothing has been sent/);
  assert.match(html, /'mailto:hello@unfire\.technology\?subject='/);
  assert.match(html, /window\.location\.href=url/);
  assert.match(html, /if\(url\.length>4500\)/);
  assert.match(html, /navigator\.clipboard\.writeText/);
  assert.doesNotMatch(html, /<button[^>]*\bformaction=|<input[^>]*\bformaction=/i);
  for (const match of html.matchAll(/mailto:([^"'\s?<>]+)/g)) {
    assert.equal(match[1], 'hello@unfire.technology', 'non-corporate recipient');
  }
});

test('privacy first layer and official policy links exist', () => {
  for (const part of [
    'Privacy at a glance.', 'Controller: Omar Baró', 'Purpose: assess and respond to your enquiry.',
    'Legal basis:', 'applicable data rights', 'full privacy policy'
  ]) {
    assert.ok(html.includes(part), 'missing privacy notice component: ' + part);
  }
  assert.match(html, /href="\/privacy\.html"/);
  assert.match(html, /href="\/legal\.html"/);
  assert.match(html, /Do not include sensitive personal information, passwords/);
});

test('keyboard, no-JavaScript and reduced-motion fallbacks remain present', () => {
  assert.match(html, /:focus-visible/);
  assert.match(html, /<noscript>/);
  assert.match(html, /JavaScript is needed to prepare a local email/);
  assert.match(html, /id="prepare" type="submit" disabled/);
  assert.match(html, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(html, /document\.querySelectorAll\('\[data-tier\]'\)/);
});

test('no external fonts, images or tracking dependencies in release page', () => {
  assert.doesNotMatch(html, /<(?:img|video|audio|iframe|canvas)\b/i);
  assert.doesNotMatch(html, /(?:google-analytics|gtag|googletagmanager|facebook\.net|pixel|fonts\.googleapis)/i);
  assert.doesNotMatch(html, /<script[^>]+src=|<link[^>]+rel="stylesheet"/i);
});

test('responsive and text-resizing regression hooks remain', () => {
  assert.match(html, /@media\(max-width:620px\)/);
  assert.match(html, /overflow-wrap:anywhere/);
  assert.match(html, /\.tier-head\{[^}]*flex-wrap:wrap/);
  assert.match(html, /\.tier-label\{[^}]*white-space:normal/);
  assert.match(html, /line-height:1\.02;letter-spacing:-\.065em;font-weight:660;margin:22px 0 26px;overflow-wrap:anywhere/);
});
