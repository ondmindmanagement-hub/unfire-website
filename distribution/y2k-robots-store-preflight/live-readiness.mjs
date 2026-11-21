/**
 * Read-only public Y2K ROBOTS web readiness audit. Standard Node.js 20+.
 * No credentials, analytics, cookies, writes, accounts or installs.
 * It deliberately reports Not Ready even if all metadata checks pass:
 * store validation also requires actual device/game/legal QA.
 */
const origin = 'https://unfire.technology';
const timeoutMs = 9000;
const output = { product: 'Y2K ROBOTS', checked_at: new Date().toISOString(), public_url: origin + '/audio/', ready_for_store_submission: false, checks: [], manual_gates: ['Approved owner release', 'PWA install and Windows device QA', 'Android SDK 36/AAB and physical device QA', 'Signed Digital Asset Links', 'Licenses, privacy, age and publisher/SEPE review'] };

async function request(path, mode = 'text') {
  const url = new URL(path, origin);
  if (url.origin !== origin) throw Error('Unapproved external origin');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { method: mode === 'head' ? 'HEAD' : 'GET', redirect: 'follow', signal: controller.signal, headers: { 'Accept': mode === 'json' ? 'application/manifest+json,application/json' : '*/*' }, cache: 'no-store' });
    if (new URL(response.url).origin !== origin) throw Error('Unexpected redirect outside canonical origin');
    return { ok: response.ok, status: response.status, body: mode === 'head' ? null : await response.text(), type: response.headers.get('content-type') || '' };
  } finally {
    clearTimeout(timer);
  }
}

function add(key, passed, observed) {
  output.checks.push({ key, passed, observed });
}

const html = await request('/audio/').catch(e => ({ ok: false, status: 'NETWORK_ERROR', error: String(e.message) }));
add('game_web_accessible', html.ok && /text\/html/i.test(html.type || ''), html.status);
const manifest = await request('/audio/game.webmanifest', 'json').catch(e => ({ ok: false, status: 'NETWORK_ERROR', error: String(e.message) }));
add('webmanifest_accessible', !!manifest.ok, manifest.status);
if (manifest.ok) {
  try {
    const m = JSON.parse(manifest.body);
    add('public_product_title', m.name === 'Y2K ROBOTS' && m.short_name === 'Y2K ROBOTS', { name: m.name, short_name: m.short_name });
    add('public_manifest_id', m.id === '/audio/', m.id ?? '(missing)');
    add('public_english_copy', typeof m.description === 'string' && m.description.length >= 25 && !/\b(juego|aventura|gratuito|misiones|secretos)\b/i.test(m.description), m.description ?? '(missing)');
    for (const size of [192, 512]) {
      const icon = (m.icons || []).find(i => (i.sizes || '').split(/\s+/).includes(`${size}x${size}`) && i.type === 'image/png');
      if (!icon) {
        add(`public_icon_${size}`, false, 'Not declared in manifest');
        continue;
      }
      let resolved;
      try { resolved = new URL(icon.src, origin + '/audio/game.webmanifest'); }
      catch { add(`public_icon_${size}`, false, 'Invalid icon path'); continue; }
      if (resolved.origin !== origin) { add(`public_icon_${size}`, false, 'External icon not permitted'); continue; }
      const response = await request(resolved.pathname, 'head').catch(() => ({ ok: false, status: 'NETWORK_ERROR' }));
      add(`public_icon_${size}`, response.ok && /image\/png/i.test(response.type || ''), response.status);
    }
  } catch(e) {
    add('manifest_parse', false, String(e.message));
  }
}
const worker = await request('/audio/y2k-service-worker.js','head').catch(() => ({ ok:false,status:'NETWORK_ERROR' }));
add('candidate_service_worker_public', worker.ok && /javascript/i.test(worker.type || ''), worker.status);
// Presence alone is not proof that a service worker is registered, controls the game,
// or meets PWABuilder requirements. Must test in browser after owner deployment.
const privacy = await request('/audio/privacy.html','head').catch(() => ({ok:false,status:'NETWORK_ERROR'}));
add('privacy_page_public',privacy.ok,privacy.status);
output.blockers = output.checks.filter(x=>!x.passed).length;
process.stdout.write(JSON.stringify(output,null,2)+'\n');
if (process.argv.includes('--strict') && output.blockers > 0) process.exitCode = 1;
