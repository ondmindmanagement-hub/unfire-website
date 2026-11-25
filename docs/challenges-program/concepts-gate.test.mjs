import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { auditCatalog, loadAndAudit } from './concepts-gate.mjs';

const base = JSON.parse(readFileSync(new URL('./proposed-editions.json', import.meta.url), 'utf8'));
const copy = () => structuredClone(base);
const failing = (title, mutator, expected) => test(title, () => {
  const catalog = copy();
  mutator(catalog[0]);
  const r = auditCatalog(catalog);
  assert.equal(r.ok, false);
  assert.ok(r.errors.some(e => e.includes(expected)), JSON.stringify(r.errors));
  assert.equal(r.live, 0);
  assert.equal(r.launch_authorized, false);
});

test('existing two concepts are valid but cannot become live on passing tests', () => {
  const result = loadAndAudit();
  assert.equal(result.ok, true);
  assert.equal(result.editions, 2);
  assert.equal(result.live, 0);
  assert.equal(result.launch_authorized, false);
});
test('empty array rejected', () => assert.equal(auditCatalog([]).ok, false));
test('null catalog rejected', () => assert.equal(auditCatalog(null).ok, false));
test('duplicate id rejected', () => {
  const c = copy(); c.push(structuredClone(c[0]));
  assert.ok(auditCatalog(c).errors.some(e => e.includes('duplicate edition id')));
});
test('null item does not crash', () => {
  const c = copy(); c.push(null);
  assert.ok(auditCatalog(c).errors.some(e => e.includes('object required')));
});

const cases = [
 ['invalid id',e=>e.id='x','invalid immutable'],
 ['missing title',e=>e.title=' ','title required'],
 ['missing category',e=>e.category=null,'category required'],
 ['brief too short',e=>e.brief='x','useful written brief'],
 ['OPEN forbidden',e=>e.state='OPEN','only CONCEPT'],
 ['JUDGING forbidden',e=>e.state='JUDGING','only CONCEPT'],
 ['RESULTS forbidden',e=>e.state='RESULTS','only CONCEPT'],
 ['unknown state forbidden',e=>e.state='ACTIVE','only CONCEPT'],
 ['no calls',e=>e.live_attendance_required=true,'written-only'],
 ['no travel',e=>e.travel_required=true,'written-only'],
 ['must be written',e=>e.written_only=false,'written-only'],
 ['no entry fee',e=>e.entry_fee_eur=5,'free entry'],
 ['no purchase',e=>e.purchase_required=true,'free entry'],
 ['no chance method',e=>e.selection_method='lottery','skills/jury'],
 ['no random tie-break',e=>e.random_tie_break=true,'skills/jury'],
 ['no organizer self-awards',e=>e.organizer_may_compete=true,'organizer must not'],
 ['no data sale',e=>e.sell_participant_data=true,'cannot be sold'],
 ['IP rights retained',e=>e.entrant_retains_ip=false,'entrants retain'],
 ['age baseline review',e=>e.minimum_age=16,'adult-only'],
 ['formal intake disabled',e=>e.intake.enabled=true,'intake must be disabled'],
 ['intake object required',e=>delete e.intake,'intake must be disabled'],
 ['no submission endpoint',e=>e.intake.submission_endpoint='https://example.org','no submission'],
 ['no upload endpoint',e=>e.intake.upload_endpoint='https://example.org','no submission'],
 ['no winner claim',e=>e.public_claims.winners_announced=true,'winners_announced'],
 ['no partner claim',e=>e.public_claims.named_partners_confirmed=true,'named_partners_confirmed'],
 ['no unfinanced cash claim',e=>e.public_claims.cash_prize_advertised=true,'cash_prize_advertised'],
 ['no entry-open flag',e=>e.public_claims.open_for_entries=true,'open_for_entries'],
 ['public claims map required',e=>delete e.public_claims,'public claims map required'],
 ['no speculative sponsor',e=>e.sponsor_name='Sponsor','unverified money'],
 ['no speculative amount',e=>e.prize_amount_eur=1000,'unverified money'],
 ['no fictitious winner',e=>e.winner_name='Winner','unverified money']
];
for (const [title, mutate, error] of cases) failing(title, mutate, error);
