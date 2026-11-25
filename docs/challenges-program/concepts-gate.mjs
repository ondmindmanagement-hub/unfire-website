/**
 * Unfire Global Challenges — proposal-only fail-closed catalog gate.
 * It cannot approve a contest, verify legal evidence, authorize entry
 * collection or promise a prize. Those require a separate human release.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const ID = /^UGC-\d{3,5}$/;
const nonblank = v => typeof v === 'string' && v.trim().length > 0;
const record = v => !!v && typeof v === 'object' && !Array.isArray(v);

/** No catalog can be authorized to launch by this proposal-only validator. */
export function auditCatalog(catalog) {
  const errors = [];
  const add = (path, reason) => errors.push(`${path}: ${reason}`);
  if (!Array.isArray(catalog) || catalog.length === 0) {
    return { ok: false, errors: ['catalog: nonempty array required'], editions: 0, live: 0, launch_authorized: false };
  }
  const ids = new Set();
  for (const [i, e] of catalog.entries()) {
    const p = `edition[${i}]`;
    if (!record(e)) { add(p, 'object required'); continue; }
    if (typeof e.id !== 'string' || !ID.test(e.id)) add(p, 'invalid immutable edition id');
    if (ids.has(e.id)) add(p, 'duplicate edition id');
    ids.add(e.id);
    if (!nonblank(e.title)) add(p, 'title required');
    if (!nonblank(e.category)) add(p, 'category required');
    if (!nonblank(e.brief) || e.brief.trim().length < 24) add(p, 'useful written brief required');
    if (!['CONCEPT', 'PLANNED'].includes(e.state)) add(p, 'only CONCEPT / PLANNED permitted; live states need a different verified release process');
    if (e.written_only !== true || e.live_attendance_required !== false || e.travel_required !== false) add(p, 'written-only and no live/physical attendance required');
    if (e.entry_fee_eur !== 0 || e.purchase_required !== false) add(p, 'free entry without purchase required');
    if (e.selection_method !== 'skill_jury' || e.random_tie_break !== false) add(p, 'skills/jury only; no random tie-break');
    if (e.organizer_may_compete !== false) add(p, 'organizer must not win own awards');
    if (e.sell_participant_data !== false) add(p, 'participant data cannot be sold');
    if (e.entrant_retains_ip !== true) add(p, 'entrants retain their intellectual property');
    if (e.minimum_age !== 18) add(p, 'adult-only baseline must be reviewed before change');
    if (!record(e.intake) || e.intake.enabled !== false) add(p, 'formal intake must be disabled');
    if (e.intake?.submission_endpoint != null || e.intake?.upload_endpoint != null) add(p, 'no submission or upload endpoint in proposal catalog');
    if (!record(e.public_claims)) {
      add(p, 'public claims map required');
    } else {
      for (const k of ['winners_announced','named_partners_confirmed','cash_prize_advertised','open_for_entries']) {
        if (e.public_claims[k] !== false) add(p, `public claim ${k} must be false`);
      }
    }
    if (e.prize_amount_eur != null || e.sponsor_name != null || e.winner_name != null) add(p, 'unverified money, sponsor or winner claim');
  }
  return { ok: errors.length === 0, errors, editions: catalog.length, live: 0, launch_authorized: false };
}

export function loadAndAudit(fileUrl = new URL('./proposed-editions.json', import.meta.url)) {
  const raw = readFileSync(fileURLToPath(fileUrl), 'utf8');
  return auditCatalog(JSON.parse(raw));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = loadAndAudit();
    if (!result.ok) {
      console.error(`BLOCKED: ${result.errors.length} violations\n${result.errors.join('\n')}`);
      process.exitCode = 1;
    } else {
      console.log(`PASS: ${result.editions} draft concepts; 0 open; not launch authorization.`);
    }
  } catch (err) {
    console.error('BLOCKED: could not read or validate catalog:', err.message);
    process.exitCode = 1;
  }
}
