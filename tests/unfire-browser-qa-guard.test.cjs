'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const { parse } = require('../scripts/unfire-browser-qa-guard.cjs');
const cli = path.resolve(__dirname, '../scripts/unfire-browser-qa-guard.cjs');
function launch(ms, script) {
  return spawnSync(process.execPath, [cli, `--timeout-ms=${ms}`, '--', process.execPath, '-e', script],
    { encoding: 'utf8', timeout: 5000 });
}
test('strict CLI parsing without shell interpolation', () => {
  assert.deepEqual(parse(['--timeout-ms=900', '--', 'node', 'test file.cjs']),
    { timeout: 900, command: 'node', args: ['test file.cjs'] });
  for (const v of ['0', '1', '249', '900001', 'Infinity', '-10'])
    assert.throws(() => parse([`--timeout-ms=${v}`, '--', 'node']));
  assert.throws(() => parse(['--timeout-ms=900']));
});
test('successful QA run exits zero', () => {
  const r = launch(2000, 'process.stdout.write("OK")');
  assert.equal(r.status, 0, r.stderr); assert.match(r.stdout, /OK/);
});
test('failing QA run preserves exit code', () => {
  const r = launch(2000, 'process.exit(23)');
  assert.equal(r.status, 23, r.stderr);
});
test('hung QA is bounded and returns timeout code', () => {
  const r = launch(450, 'setInterval(()=>{},1000)');
  assert.equal(r.status, 124, r.stderr); assert.match(r.stderr, /time budget exceeded/);
});
test('missing executable reports distinct failure', () => {
  const r = spawnSync(process.execPath, [cli, '--timeout-ms=1000', '--', '__unfire_no_such_command__'],
    { encoding: 'utf8', timeout: 5000 });
  assert.equal(r.status, 127, r.stderr);
});
