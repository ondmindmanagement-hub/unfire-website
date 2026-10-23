import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSummary, fetchReport } from '../scripts/unfire-audio-metrics-report.mjs';

test('human-friendly report never calls a payment click a sale', () => {
  const msg = formatSummary({period_days:30,
    counts:[{day:'2026-10-23',event:'game_enter',total:5},{day:'2026-10-23',event:'checkout_click',total:3}],
    consenting_tab_sessions:[{day:'2026-10-23',event:'game_enter',tabs:4}]});
  assert.match(msg, /Entradas al juego: 5 eventos \/ 4 sesiones/);
  assert.match(msg, /Clics hacia compra \(NO ventas\): 3/);
  assert.match(msg, /no son personas únicas/);
});

test('fetchReport rejects token in URL or HTTP transport', async () => {
  const fake = async () => ({ok:true,json:async()=>({counts:[],consenting_tab_sessions:[],period_days:30})});
  await assert.rejects(fetchReport('http://example.org/admin/summary', 'x'.repeat(24), fake));
  await assert.rejects(fetchReport('https://example.org/admin/summary?token=secret', 'x'.repeat(24), fake));
  await assert.rejects(fetchReport('https://example.org/admin/summary', '', fake));
});

test('fetchReport authenticates in header and does not leak secret into output', async () => {
  let received;
  const mock = async (url, opts) => {
    received = { url, opts };
    return { ok:true,status:200,json:async()=>({period_days:30,counts:[],consenting_tab_sessions:[]}) };
  };
  const token = 'private-test-token-must-not-be-printed';
  const report = await fetchReport('https://stats.example.org/admin/summary', token, mock);
  assert.equal(received.opts.headers.Authorization, 'Bearer ' + token);
  assert.ok(!received.url.includes(token));
  assert.ok(!formatSummary(report).includes(token));
});
