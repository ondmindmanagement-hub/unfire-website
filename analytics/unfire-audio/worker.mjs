/* Optional Cloudflare Worker + D1 counter. Never configured in public HTML
   until the owner provisions a database, verifies consent and approves rollout. */
const ORIGIN = 'https://unfire.technology';
const EVENTS = new Set(['page_view', 'game_enter', 'match_start', 'briefcase_open', 'checkout_click']);
const SESSION = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const respond = (object, status = 200, headers = {}) => new Response(JSON.stringify(object), {
  status,
  headers: Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, headers)
});
const cors = {
  'Access-Control-Allow-Origin': ORIGIN,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Vary': 'Origin'
};

async function ingest(request, env) {
  if (request.headers.get('Origin') !== ORIGIN) return respond({ error: 'origin_denied' }, 403);
  if (!env.DB) return respond({ error: 'not_configured' }, 503, cors);
  if ((request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase() !== 'application/json')
    return respond({ error: 'invalid_content_type' }, 415, cors);
  const body = await request.text();
  if (body.length > 512) return respond({ error: 'too_large' }, 413, cors);
  let value;
  try { value = JSON.parse(body); } catch (_) { return respond({ error: 'invalid_json' }, 400, cors); }
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).sort().join(',') !== 'event,session' ||
      !EVENTS.has(value.event) || typeof value.session !== 'string' || !SESSION.test(value.session)) {
    return respond({ error: 'invalid_event' }, 400, cors);
  }
  const day = new Date().toISOString().slice(0, 10);
  try {
    await env.DB.batch([
      env.DB.prepare('INSERT INTO daily_counts(day,event,total) VALUES (?,?,1) ON CONFLICT(day,event) DO UPDATE SET total=total+1').bind(day, value.event),
      env.DB.prepare('INSERT OR IGNORE INTO daily_sessions(day,event,session) VALUES (?,?,?)').bind(day, value.event, value.session)
    ]);
  } catch (_) {
    return respond({ error: 'collector_unavailable' }, 503, cors);
  }
  return respond({ ok: true }, 202, cors);
}

async function summary(request, env) {
  // Private endpoint. The token must be a secret, never in public JavaScript.
  if (!env.ADMIN_TOKEN || request.headers.get('Authorization') !== 'Bearer ' + env.ADMIN_TOKEN)
    return respond({ error: 'unauthorized' }, 401);
  if (!env.DB) return respond({ error: 'not_configured' }, 503);
  const from = new Date(Date.now() - 29 * 86400000).toISOString().slice(0, 10);
  const [totals, sessions] = await env.DB.batch([
    env.DB.prepare('SELECT day,event,total FROM daily_counts WHERE day >= ? ORDER BY day,event').bind(from),
    env.DB.prepare('SELECT day,event,COUNT(*) AS tabs FROM daily_sessions WHERE day >= ? GROUP BY day,event ORDER BY day,event').bind(from)
  ]);
  // "tabs" means nonpersistent consenting browser-tab sessions; NOT people/MAU.
  return respond({ period_days: 30, timezone: 'UTC', counts: totals.results || [],
    consenting_tab_sessions: sessions.results || [],
    note: 'Not unique humans or verified purchases. No historical data before integration.' });
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === '/v1/event' && request.method === 'OPTIONS') {
      return request.headers.get('Origin') === ORIGIN ? new Response(null, { status: 204, headers: cors })
        : respond({ error: 'origin_denied' }, 403);
    }
    if (path === '/v1/event' && request.method === 'POST') return ingest(request, env);
    if (path === '/admin/summary' && request.method === 'GET') return summary(request, env);
    return respond({ error: 'not_found' }, 404);
  },
  async scheduled(_event, env) {
    // Rolling data retention; no permanent session identifiers.
    if (!env.DB) return;
    const cutoff = new Date(Date.now() - 35 * 86400000).toISOString().slice(0, 10);
    await env.DB.batch([
      env.DB.prepare('DELETE FROM daily_sessions WHERE day < ?').bind(cutoff),
      env.DB.prepare('DELETE FROM daily_counts WHERE day < ?').bind(cutoff)
    ]);
  }
};
