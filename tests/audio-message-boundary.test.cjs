'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'audio', 'index.html'), 'utf8');
const handler = "addEventListener('message',e=>{";
const start = html.indexOf(handler);
assert.ok(start >= 0, 'Host iframe message listener must exist');
assert.equal(html.indexOf(handler, start + handler.length), -1, 'Unexpected extra unreviewed host listener');
const first = html.slice(start, start + 450);
const guard = /if\s*\(\s*e\.source\s*!==\s*fr\.contentWindow\s*\|\|\s*e\.origin\s*!==\s*location\.origin\s*\)\s*return\s*;/;
const match = guard.exec(first);
assert.ok(match, 'Only same-origin messages from the game iframe may change the host');
assert.ok(match.index < first.indexOf('const d=e.data'), 'Authenticate message sender before parsing commands');
assert.ok(match.index < first.indexOf('d.unfire'), 'Sender check must precede all game commands');
console.log('PASS: Audio host authenticates source window and origin before handling commands.');
