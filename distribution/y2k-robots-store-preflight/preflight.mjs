// Read-only, zero-dependency checks. Run from any working directory.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDir, '../..');
const checks = [];
const add = (id, ok, detail) => checks.push({ id, status: ok ? 'PASS' : 'BLOCKED', detail });
const exists = (rel) => fs.existsSync(path.resolve(root, rel));
const read = (rel) => fs.readFileSync(path.resolve(root, rel), 'utf8');
const manifestPath = 'audio/game.webmanifest';

add('canonical_game_html_exists', exists('audio/index.html'), 'Requires the original game host to exist');
add('game_manifest_exists', exists(manifestPath), 'Requires an installable game manifest');

if (exists(manifestPath)) {
  let m;
  try { m = JSON.parse(read(manifestPath)); }
  catch { add('manifest_valid_json', false, 'Malformed webmanifest JSON'); }
  if (m) {
    add('manifest_selected_name', m.name === 'Y2K ROBOTS' && m.short_name === 'Y2K ROBOTS', `name=${JSON.stringify(m.name)}; short_name=${JSON.stringify(m.short_name)}`);
    add('manifest_english_description', typeof m.description === 'string' && m.description.length >= 30 && !/\b(juego|gratuito|aventura|misiones|secretos|robots transformables)\b/i.test(m.description), 'Public copy must be in English; manual language review remains required');
    add('manifest_standalone', m.display === 'standalone', `display=${JSON.stringify(m.display)}`);
    const icons = Array.isArray(m.icons) ? m.icons : [];
    const hasIcon = (size) => icons.some(i => new RegExp(`(^|\\s)${size}x${size}($|\\s)`).test(i.sizes ?? '') && i.type === 'image/png' && exists(path.join('audio', i.src ?? '')));
    add('game_png_192', hasIcon(192), 'Approved, genuine 192px PNG icon must exist and be declared');
    add('game_png_512', hasIcon(512), 'Approved, genuine 512px PNG icon must exist and be declared');
  }
}

add('privacy_page_exists', exists('audio/privacy.html'), 'Actual data flow and store declarations still require manual review');
add('game_press_kit_exists', exists('audio/press/index.html'), 'Genuine, rights-cleared assets require manual verification');
add('store_metadata_draft_exists', exists('distribution/y2k-robots-store-preflight/store-listing.en.json'), 'Draft metadata is not a submitted store listing');

const blockers = checks.filter(c => c.status !== 'PASS');
const output = { product: 'Y2K ROBOTS', scope: 'static source preflight only', ready_for_store_submission: false, blockers: blockers.length, checks, manual_gates: ['HTTPS/runtime PWA installation and scoped service worker', 'Verified Windows MSIX + Windows device QA', 'Android signed AAB + Android device QA', 'Original icon/capture/music rights', 'Store identity, privacy, age rating and SEPE compliance', 'Store review submission and approval'] };
process.stdout.write(JSON.stringify(output, null, 2) + '\n');
if (process.argv.includes('--strict') && blockers.length) process.exitCode = 1;
