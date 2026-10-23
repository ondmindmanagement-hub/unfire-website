#!/usr/bin/env node
/* Read-only CLI report: keeps ADMIN_TOKEN in environment, never in a URL or repo. */
import { pathToFileURL } from 'node:url';

const LABELS = Object.freeze({
  page_view: 'Visitas consentidas',
  game_enter: 'Entradas al juego',
  match_start: 'Partidas iniciadas',
  briefcase_open: 'Maletines abiertos',
  checkout_click: 'Clics hacia compra (NO ventas)'
});
export function formatSummary(report) {
  if (!report || !Array.isArray(report.counts) ||
      !Array.isArray(report.consenting_tab_sessions)) throw Error('Invalid report schema');
  const lines = ['UNFIRE AUDIO — últimos ' + report.period_days + ' días, UTC'];
  for (const [event, label] of Object.entries(LABELS)) {
    const total = report.counts.filter(x => x.event === event).reduce((v, x) => v + Number(x.total || 0), 0);
    const dailyTabs = report.consenting_tab_sessions.filter(x => x.event === event)
      .reduce((v, x) => v + Number(x.tabs || 0), 0);
    lines.push(label + ': ' + total + ' eventos / ' + dailyTabs + ' sesiones de pestaña por día');
  }
  lines.push('ATENCIÓN: las sesiones de pestaña no son personas únicas ni usuarios mensuales activos.');
  lines.push('Las ventas pagadas deben comprobarse en la tienda/proveedor financiero.');
  return lines.join('\n');
}
export async function fetchReport(url, token, fetcher = fetch) {
  let parsed;
  try { parsed = new URL(url); } catch (_) { throw Error('Admin URL invalid'); }
  if (parsed.protocol !== 'https:' || !parsed.hostname || parsed.username ||
      parsed.password || parsed.search || parsed.hash) throw Error('Admin URL must be HTTPS without credentials/query');
  if (typeof token !== 'string' || token.length < 24) throw Error('Missing secure admin token');
  const response = await fetcher(parsed.href, {
    method: 'GET',
    headers: { Authorization: 'Bearer ' + token, Accept: 'application/json' },
    cache: 'no-store',
    redirect: 'error'
  });
  if (!response.ok) throw Error('Admin endpoint returned HTTP ' + response.status);
  return response.json();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const report = await fetchReport(process.env.UNFIRE_METRICS_ADMIN_URL,
      process.env.UNFIRE_METRICS_ADMIN_TOKEN);
    console.log(formatSummary(report));
  } catch (error) {
    console.error('Metrics unavailable: ' + error.message);
    process.exitCode = 1;
  }
}
