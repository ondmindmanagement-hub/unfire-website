# Music Network — implementation and release gates (draft)
Owner workstream: rights-first music intake. References #13 #78 #140 #173 #469. No partner agreement, legal approval or publication is implied.

## Zero-cost first phase
Static prototype only, no account, upload, checkout, telemetry or external embeds. Link-first pilot only after manual verification; use official release links, not downloaded platform audio. Public repository must NEVER contain private evidence, audio submissions, identity documents, keys or contracts. GitHub Pages cannot implement private intake. Do not collect submissions until controller identity, privacy notice, retention, private infrastructure and security have been verified; no paid services without owner authorization.

## Private architecture (not implemented)
Authenticated applicant, separate reviewer and publisher roles; per-record access controls. Private encrypted storage; quarantine uploads, restrict type and size, scan malware, hash and deduplicate, immutable audit records; signed short-lived read URLs; no direct access from public pages. Verify representative authority and chain of title for master and composition, coauthors, performers, samples, artwork, territorial and term restrictions. ISRC/ISWC/fingerprints aid matching only. Evidence and signed agreements stay private. Separate consent and purposes; retention/deletion policy, complaint and appeal process; security and legal review before handling data.

State machine: draft → submitted → quarantined → rights_review → approved_for_specific_scope → published. Reject or suspend from any review/publication stage; revoke upon expiry or credible complaint pending review. Approval by independent reviewer, never applicant self-approval. Server must enforce default-deny across all routes, cache invalidation and public catalog export. No new uses without signed scope. Public record: approved display name, title, permitted artwork, official URL and product scopes only, never raw evidence. Link validation: HTTPS, vetted hosts, canonical URLs, redirect controls; no arbitrary fetches, no automatic download, no embedded ads or tracking.

Permission dimensions: link, stream, offline download, DJ mix, DAW import, sample redistribution, adaptation, advertising sync, artwork/brand, territory, term, commercial conditions. Store policy and fiscal gate separate. Promotions never conditional on subscribing, following, streaming or liking. Keep purchased skins after unsubscribe; no forced playback. Revenue sharing based on documented net proceeds, refund adjustments, attribution, written terms and authorized payout setup.

## Product-specific positioning (provisional; reconcile exact catalog names #173 before launch)
| Product family | First target | Pilot |
| --- | --- | --- |
| MP3 | Independent artists, distributors, labels | Verified official links, curated profiles |
| Portable Synth DAW | BeatStars, producers, audio companies | Authorized beat discovery and licensed import proposal |
| Classical guitar | Schools, teachers, instrument makers | Licensed lessons and repertoire |
| Electric guitar | Guitar/amp/pedal brands, performers | Approved sound presets and signature editions |
| DJ dual deck / pro | DJs, labels, schools | Licensed mixing material / practice workflows |
| Vinyl player | Labels, record shops | Official album discovery |
| Tape recorder | Studios, retro brands | Original tape-effect presets |
| Voice recorder | Podcasters, singers | Recording workflow packs |
| Mixer | Engineers, studios | Mixing presets, approved integrations |
| Sampler / pads | Producers, sample vendors | Cleared sample packs |
| Keyboard | Teachers, MIDI makers | Licensed repertoire and instrument packs |
| Sequencer | Electronic producers | Original patterns |
| Visual FX | VJs, creators | Licensed visual packs |
| Spatial audio | Game/film audio teams | Original spatial presets |
| Drums | Percussion makers | Cleared kits |
| Mirrior (name spelling to verify) | MIDI/DAW partners | Authorized integrations |
| Gods Lamp | Artists, producers | Original musical experiences |
All brands are outreach targets only. No claims of compatibility or availability without product-level verification.

## Release tests required
- Reject missing, expired, wrong-territory and wrong-scope rights; applicant cannot self-approve; negative access tests across accounts.
- Quarantine invalid/oversized/malicious files, detect duplicates, record audit events without sensitive data; test complaint suspension and public/cache removal.
- Verify legal basis, contract versions, privacy and retention, secure backups, commercial and tax readiness; independent reviewer signs off.
- Validate links, keyboard/accessibility, 320px and tablet landscape/portrait, native real-device routing and restoration of purchases.
- No merge or deploy before designated release integrator; no third-party content or actual upload until above gates pass.
