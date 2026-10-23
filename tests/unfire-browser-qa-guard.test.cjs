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

test('timeout kills a stubborn descendant in the owned Unix process group', { skip: process.platform === 'win32' }, () => {
  const script = [
    'const {spawn}=require("node:child_process")',
    `const g=spawn(process.execPath,["-e",${JSON.stringify("process.on('SIGTERM',()=>{});setInterval(()=>{},1000)")}],{stdio:"ignore"})`,
    'console.log("GRANDCHILD="+g.pid)',
    'setInterval(()=>{},1000)',
  ].join(';');
  const r = launch(450, script);
  assert.equal(r.status, 124, r.stderr);
  const pid = Number(r.stdout.match(/GRANDCHILD=(\d+)/)?.[1]);
  assert(pid > 0, 'Expected a spawned descendant PID: ' + r.stdout);
  const check = spawnSync('ps', ['-o', 'stat=', '-p', String(pid)], { encoding: 'utf8' });
  assert(check.status !== 0 || !check.stdout.trim() || check.stdout.trim().startsWith('Z'),
    'A browser descendant remained alive after timeout: ' + pid);
});
