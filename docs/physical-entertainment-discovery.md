# Unfire Physical Entertainment — Discovery specification
Status: **DRAFT / INTERNAL PLANNING ONLY**. Date: 2026-11-14. Owner coordination: #327, #78, legal #140.
Scope: new isolated `physical-entertainment/index.html`; do not modify website root, games, existing release assets, or any app.

## Mission
Explore a creator-first entertainment marketplace that could distribute independent **games and audiovisual works**, offer licensed **digital and physical editions**, connect **retail partners** and eventually support a **unified library and dedicated hardware**. This is a hypothesis-driven programme, not an existing product launch.

## Who benefits
- **Creators:** clear submission rules, merit-based assessment, optional distribution and transparent accounting.
- **Players and collectors:** curated discovery, ownership terms, accessible metadata, legitimately offered media and physical editions.
- **Retailers:** potential additional catalog and services, without implying any relationship with named chains.
- **Rights holders and platforms:** voluntary licensing, legitimate partner programmes and measurable incremental demand.

## Phase 0: discovery at zero spending
1. Publish no claims of availability. Use a manually reviewed English concept page; the current page is noindexed for review.
2. Accept only **non-confidential expressions of interest** by user-initiated mail to `hello@unfire.technology`. No file uploads, automated lead database, analytics cookies, paid deposits or pre-orders.
3. Collect **only high-level interest signals** if users voluntarily contact us: participant category, relevant format, their needs and region. Privacy/compliance owner must establish retention, notice and legal basis before any systematic CRM.
4. Privately track outreach deduplication and partner permissions before referencing any brand or contact.
5. Review concept fit, legitimate legal entity/tax status, insurance, rights, classification rules, checkout obligations, accessibility and customer support before accepting money or goods.

## Proposed creator workflow (not yet an offered service)
- **Preflight:** rights-holder identity, original work and declaration of authority; safe handling of personal data.
- **Submission agreement:** permission scope, refund/cancellation procedures, ownership retained, confidentiality, warranties, dispute process and takedown.
- **Technical gate:** signed/hash-checked builds, malware screening, platform requirements, installation and launch testing, stability, accessibility and data handling.
- **Editorial gate:** published safety/suitability criteria, age-ratings where required, clear rejection reasons and appeals. Avoid equating low budget with low quality.
- **Rights gate:** game engines, assets, music, performers, screenplay, trademarks and media-distribution territory/window clearances.
- **Release choices:** digital / physical / both / showcase-only. Physical requires separate rights, retailer/margin agreements, manufacturing minimums, fulfilment and warranty support.
- **Sales and reporting:** only after payment processor, legal seller information, terms, tax/VAT, refunds, anti-fraud, creator payouts, consumer complaints and reconciliation have been independently verified.

## Fee model to validate, not to announce
- **Recommended discovery-phase entry:** free initial contact and free feasibility discussion.
- **Digital distribution:** test revenue-share scenarios against real net revenue, platform fees, chargebacks, taxes, refunds and support cost. No fixed percentage promised.
- **Physical edition:** transparent creator agreement with proof of license, approved proofs, realistic minimum orders, margins and ownership of unsold inventory; prefer third-party fulfilment/presales only after contractual/legal approval.
- **Premium services:** optional scoped service agreements; never charge purely for editorial approval or imply payment buys acceptance.
- Compare creator take-home revenue, checkout conversion, fulfilment success and platform satisfaction—not just gross sales.

## Honest compatibility roadmap
| Tier | What is meant | Evidence before claiming |
| --- | --- | --- |
| 1 | Unfire-native titles | Hardware/software target and installation/launch testing for each build |
| 2 | Supported PC or cross-platform titles | Rights, operating system/CPU/GPU requirements and game-by-game QA |
| 3 | Licensed retro/ported titles | Publisher authority, lawful redistribution and per-title testing |
| 4 | Linked external libraries | Partner/API authorisation; **library visibility is not playability** |
| 5 | Other vendors' console titles | Contracts, permitted streaming/ports, hardware capabilities and legal review |

Do **not** promise compatibility with "all existing games", PlayStation, Xbox, Nintendo, Steam, or any third-party catalog by default. Explore partnerships before mentioning company names on sales surfaces. Distinguish legal open-source emulation software from copyrighted game content and firmware.

## Hardware gate: prototype before manufacturing
- Define realistic target hardware budget, power/thermal envelope, CPU/GPU, RAM, storage, controller, optical media feasibility, connectivity, security, updates and repairability.
- Decide whether physical support is disc playback or code/license-in-box; never imply that any arbitrary disc will run.
- Benchmark real games and cold/warm launch reliability; document incompatibilities openly.
- Verify regulatory requirements (e.g. CE conformity, EMC, RoHS, WEEE, batteries where applicable) with qualified advice prior to sale.
- No mass production without technical proof, IP clearance, manufacturing contract, quality plan and funded demand.

## Retail and media
- Optional video-club-inspired spaces, repair/retro culture, collectibles, game and film showcases, VR demos.
- Retailers participate only after opt-in agreements; trademarks/logo use needs permission.
- Audiovisual offerings have distinct distribution, territorial, subtitling, music, performer and age-classification rights. No assumption that the game review workflow covers films.

## Initial success metrics (to be set after consent and lawful collection methods exist)
- Qualified, permissioned expressions of interest by creators / shops / rights holders.
- Number of rights-clear pilot candidates and stores voluntarily requesting follow-up.
- Successful legal/technical feasibility validations; not fabricated "partnerships".
- Once released: active compatible catalog, paid conversion, net creator proceeds, refund rate, fulfilment time and buyer satisfaction.

## Website design and review evidence
- Standalone English semantic HTML, responsive grids, skip link, visible focus styling, reduced-motion support.
- No scripts, backend, cookies, tracking, personal-data form or third-party assets.
- Outbound contact is via native mailto links, never an automatic send.
- `robots=noindex,nofollow` to reduce accidental discovery before approval; remove only as a separately approved release change.
- No fake hardware imagery, game screenshots, certifications, platform logos or rights claims.
- Static preflight checked at authoring: HTML boundaries, language, no form/network script, email route, no pre-order claim, no screenshots, responsive and keyboard focus CSS.
- **Not yet done:** Safari/Chrome/Firefox or actual device visual QA; screen-reader QA; external legal/brand approval; CI for combined target SHA; live site publication or HTTP smoke test.

## Release blockers
1. Website owner and global coordination #78 approve review scope, files and integrator.
2. Legal owner #140 approves media-rights, seller identity, statement of stage, privacy, consumer claims and potential platform trademarks.
3. Complete manual responsive, accessibility, link and contrast QA, and any existing website CI; include screenshots of actual webpage (never fabricated product screenshots).
4. Verify the final commit SHA and only then merge with an authorised release integrator.
5. Publish using existing deployment route and independently verify public HTTPS, robots and navigation. Do not silently add homepage links or sitemap changes.
6. If launching contact-based research, use `hello@unfire.technology` as sole Unfire sender. No mass outreach without approved deduplication and opt-out procedures.

**No Unfire Rally/game code touched. No claims of production compatibility, partnerships or released hardware.**
