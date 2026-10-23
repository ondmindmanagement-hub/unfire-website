#!/usr/bin/env node
'use strict';

// Bounded browser QA launcher. Only owns the process group it creates.
// Usage: node scripts/unfire-browser-qa-guard.cjs --timeout-ms=120000 -- node tests/qa.cjs
const { spawn } = require('node:child_process');

function parse(argv) {
  const divider = argv.indexOf('--');
  if (divider < 0 || divider === argv.length - 1) throw Error('Usage: --timeout-ms=MS -- COMMAND [ARG ...]');
  const options = argv.slice(0, divider);
  if (options.length !== 1 || !/^--timeout-ms=\d+$/.test(options[0])) throw Error('Provide exactly one --timeout-ms=MS');
  const timeout = Number(options[0].split('=')[1]);
  if (!Number.isSafeInteger(timeout) || timeout < 250 || timeout > 900000) throw Error('Timeout must be 250–900000 ms');
  return { timeout, command: argv[divider + 1], args: argv.slice(divider + 2) };
}

function run({ timeout, command, args }) {
  const isUnix = process.platform !== 'win32';
  const child = spawn(command, args, {
    cwd: process.cwd(), env: process.env, stdio: 'inherit',
    // On Unix, all browser subprocesses inherit this new process group.
    detached: isUnix, windowsHide: true, shell: false,
  });
  let timedOut = false, interrupted = null, finished = false, spawnError = false;
  let escalation = null;

  function signalOwnedGroup(signal) {
    if (!Number.isInteger(child.pid) || child.pid <= 0) return;
    try {
      if (isUnix) process.kill(-child.pid, signal);
      else child.kill(signal); // Windows: no broad process-tree kill of unrelated programs.
    } catch (error) {
      if (error.code !== 'ESRCH') console.error('[unfire-qa] cleanup:', error.message);
    }
  }

  function stop(signal) {
    signalOwnedGroup(signal);
    if (!escalation) escalation = setTimeout(() => signalOwnedGroup('SIGKILL'), 800);
  }

  const watchdog = setTimeout(() => {
    if (finished) return;
    timedOut = true;
    console.error(`[unfire-qa] time budget exceeded (${timeout} ms); stopping own QA process group`);
    stop('SIGTERM');
  }, timeout);

  for (const sig of ['SIGINT', 'SIGTERM']) {
    process.on(sig, () => {
      if (finished) return;
      interrupted = sig;
      stop(sig);
    });
  }
  child.on('error', err => {
    spawnError = true;
    console.error('[unfire-qa] cannot start child:', err.message);
  });
  child.on('close', (code, signal) => {
    if (finished) return;
    finished = true;
    clearTimeout(watchdog);
    // Clean up owned headless browsers even if the QA script exited early.
    signalOwnedGroup('SIGTERM');
    if (escalation) clearTimeout(escalation);
    process.exitCode = timedOut ? 124 : interrupted === 'SIGINT' ? 130 : interrupted === 'SIGTERM' ? 143 : spawnError ? 127 : code ?? (signal ? 1 : 0);
  });
}

if (require.main === module) {
  try { run(parse(process.argv.slice(2))); }
  catch (err) { console.error('[unfire-qa]', err.message); process.exitCode = 2; }
}
module.exports = { parse, run };
