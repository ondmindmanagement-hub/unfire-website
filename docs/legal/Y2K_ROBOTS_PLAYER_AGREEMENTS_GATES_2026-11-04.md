# Y2K Robots · player agreements and distribution release gates
**Date:** 2026-11-04  
**Status:** DRAFT / LEGAL + PRODUCT QA REQUIRED / NOT RELEASE CERTIFICATION  
**Scope:** Y2K Robots browser and distributed builds. This work is separate from audio plugins and their own license, and separate from existing asset-rights audit #140.  
**Source:** `main` inspected 2026-11-04, live HTTPS checked. Changes in this branch only add `audio/game-terms.html`, `audio/game-license.html`, and this document. No game engine, checkout, legal notice, existing privacy policy, public website links or store metadata changed.

## Current verified state
- Browser entry https://unfire.technology/audio/ works. Existing game-specific `audio/privacy.html` (dated 2026-10-27) returned HTTP 200; existing `audio/legal/` (dated 2026-10-28) returned HTTP 200.
- Existing `audio/legal/index.html` combines plugins and game content. It is not an independent, discoverable game EULA and does not replace an app-store EULA.
- `audio/maletin/coins-shop.js` identifies offline-only virtual coins and local storage, with no real-money transaction found in that isolated script. Do not infer no purchases elsewhere without a full source/runtime review.
- `audio/maletin/game-engine-v50.js` references PeerJS/WebRTC/getUserMedia/localStorage. Browser/installed variants may differ. Runtime verification and third-party/provider inventories remain outstanding.
- No acceptance flow or link to game-specific license/terms was found in the current `audio/maletin/index.html` from a static search for 'terms', 'privacy', 'license', 'legal'. Static search is not runtime verification.
- Existing global privacy/cookie corrections: merged PRs #157 and #170, per issue #140. **Do not duplicate or revert**.

## Documents prepared in this branch (not live)
1. `audio/game-terms.html` · player conduct, P2P/voice, fair play, virtual coins, age safety, reporting, rights and consumer law.
2. `audio/game-license.html` · limited player grant, protection of original assets, lawful exceptions, gameplay footage, difference from Apple's standard EULA, and consumer rights.
3. Existing `audio/privacy.html` · separate game privacy policy; **not modified here**.

## Release/operation gates (each requires actual evidence)
| Priority | Gate | Evidence required | Current state |
| --- | --- | --- | --- |
| P0 | Rights and chain of title | Source/licence/permission and redistribution right for every binary asset (incl. audio/3D/characters/fonts/third-party software), contributor/commissioner agreements, proof stored privately | **OPEN** · #140 inventoried 583 assets on 24 Oct but most per-file rights unknown |
| P0 | Discoverable and enforceable player agreements | Game menu/first-use entry with prominent terms, license and privacy links (accessible keyboard/mobile), appropriate consent/version record where legally needed | **OPEN** · files drafted only, no in-game integration |
| P0 | Accurate privacy disclosure | Data flow inventory for PeerJS STUN/TURN, network IP metadata, voice/mic/camera, storage keys, third-party video and analytics; provider roles, retention, rights and transfer/consent basis | **OPEN** · current notice informative but unverified against runtime |
| P0 | Child and multiplayer safety | Actual report/block/mute mechanics, abuse response process and access controls when required; risk-based age rating/gating; parental-consent mechanisms if applicable | **OPEN** · unverified. Do not claim moderation/blocking implemented |
| P0 | Operator identification | Legal notice meets applicable LSSI Art. 10 duties; professional, privacy-preserving solution for address/identity details with qualified review | **OPEN** · existing name/email alone may be insufficient |
| P0 | App Store license and store policies | For Apple: decide Standard EULA versus a custom EULA deployed in App Store Connect; if custom, ensure minimum terms; correct privacy URL, metadata, age rating, UGC safeguards, IAP if future payments | **OPEN** · standard EULA applies absent custom one |
| P0 | Store release-specific verification | Signed/notarized/compatible binary where relevant; rights and SDK notices bundled; platform-specific functionality and privacy tested; App Review/Google Play/Microsoft requirements verified on actual submitted build | **OPEN** · no app submission or live update in this branch |
| P0 | Commercial activation | Web checkout remains disabled; seller tax/labor/consumer identification, pricing, refund/withdrawal compliance, age safeguards, third-party rights before any real-money purchase | **OPEN** · do not enable checkout for future skins/coins |
| P1 | Brand and evidence protection | Verify sign availability in target classes/territories with OEPM/EUIPO search; archive dated source-control and original creative files, authorship, permissions, distribution records, game builds; evaluate optional registration | **OPEN** · do not assert registered trademark |
| P1 | Consumer-language/accessibility QA | English game UI and understandable consumer notice where required by distribution territories, accessible links, desktop/mobile small-screen behavior, legal text consistent with app UI | **OPEN** |

## Required implementation sequence
1. Review source and live runtime; verify game mode differences, live third-party calls, actual user-data handling and user-generated content.
2. Resolve rights provenance and factual privacy/multiplayer/age gaps; get professional Spanish consumer/IP/privacy review when appropriate.
3. Integrate clear, non-blocking access to terms/license/privacy from **Options** and onboarding or before any consent-dependent online feature. Coordinate engine/host edits only with #13 owner; do not modify their files in this legal draft.
4. Implement/verify any legally or platform-required reporting, blocking, age-appropriate safeguards and privacy controls before broad online release.
5. Review PR as one integrator; confirm tests on exact SHA, app/browser/mobile, then merge and verify deployed HTTPS. Synchronize store metadata and preserve versions.
6. If Apple Standard EULA is retained, do not claim the website's game license supersedes it; if custom EULA is desired, supply exact approved plain text through App Store Connect for intended territories.
7. Keep release gate **NOT CLEARED** until every relevant item has reproducible evidence, including a qualified review of unresolved legal facts.

## Trusted legal/platform references
- Spain LSSI Law 34/2002, Article 10 and 27: https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758
- Spain TRLGDCU RDL 1/2007, digital-content withdrawal: https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555
- Spain intellectual property law RDL 1/1996: https://www.boe.es/buscar/act.php?id=BOE-A-1996-8930
- AEPD children and consent: https://www.aepd.es/preguntas-frecuentes/10-menores-y-educacion/FAQ-1002-se-puede-recabar-y-tratar-datos-personales-de-menores
- Apple App Review guidelines: https://developer.apple.com/app-store/review/guidelines/
- Apple custom EULA instructions: https://developer.apple.com/help/app-store-connect/manage-app-information/provide-a-custom-license-agreement
- Apple standard EULA: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/

**Safety:** do not put addresses, tax identifiers, licence receipts with personal billing details, signing credentials, unpublished audio sources or contributor personal data in public GitHub. Evidence should live in authorized restricted storage and only non-sensitive hashes/refs in tickets.
