# Unfire — legal compliance release gates (24 October 2026)
Status: **technical documentation, not legal clearance**. Owner coordination: issue #140; cross-project issue #78; game changes issue #13.
Do not publish private addresses, tax IDs, benefit documents, personal correspondence or credentials to this public repository.

## Verified in this correction branch
- Updated `privacy.html`: named individual operator as already public, contact channel, data uses/legal-basis context, retention criteria, GDPR rights and AEPD; disclosed that P2P messages are available to other room participants and browser voice recognition may contact a browser vendor.
- Updated `cookies.html`: distinguishes necessary device-side storage from optional tracking and third-party network access; does not falsely promise an existing opt-in preferences panel.
- No change to payment settings, privacy consent implementation, analytics endpoint, game, mobile binaries, store listing, licence of assets or business registration.

## Remain blocked before **claiming** full compliance
| Area | Status | Evidence needed |
|---|---|---|
| LSSI publisher information | **NOT CLEARED** | Accurate complete art. 10 identification & practical privacy-safe address plan; never invent details |
| Spanish fiscal/benefits | **NOT CLEARED** | Individual advice from AEAT/TGSS/SEPE considering any existing marketplace activity and actual benefit documents |
| EU consumer paid products | **NOT CLEARED** | Product-specific trader identity, price/taxes, terms, withdrawal confirmation, delivery and support |
| Analytics | **DISABLED / NOT VERIFIED** | Actual page instrumentation, provider, retention, equal-choice consent UI and QA before release |
| Hosting and third-party transfers | **PARTIAL** | Actual vendor processing agreements, location, retention and technical network inspection |
| Marketplace apps | **NOT CLEARED** | Reconcile live binary/SDK permissions, disclosures, licences, App Store metadata and DSA contacts |
| Game player chat and minors | **NOT CLEARED** | Real multiplayer testing, abuse report/block tools and child safety safeguards; game owner #13 |
| Content, music, sample and OSS licences | **NOT CLEARED** | File-level provenance, version, contract/licence, redistribution rights, credits and hashes |
| Trademarks, product names | **NOT CLEARED** | Official OEPM/EUIPO prior-rights search, classes/territories and expert confusion analysis |
| Patent assistant product | **NOT READY** | Secure confidential handling, no invention disclosure by default, role boundary between filing help and legal representation |
| B2B and contests | **NOT CLEARED** | Verified entity eligibility, supplier terms, ownership, insurance/indemnity and signed scope |

## Enforced safety principles
1. Keep `.github/audio-commerce-release.json` commerce state **off** unless verified with legitimate documents and human authorisation. A blocked *web checkout* does not necessarily mean an app-store sale is inactive.
2. Never assume `no analytics` from a draft PR, or `fully local` where browser voice or peer signalling may use third parties.
3. No automatic opening of other work sessions, no conflict-inducing code edits in game/app owners' branches.
4. Changes to optional tracking need both accurate policies and code/consent gate, with an equally visible reject choice.
5. Keep public wording precise: a draft policy is not a legal certification, and this checklist does not establish compliance.

## Official primary sources
- LSSI art.10: https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758
- AEPD information: https://www.aepd.es/derechos-y-deberes/conoce-tus-derechos/derecho-de-informacion
- AEPD cookies: https://www.aepd.es/recurso-multimedia/guia-sobre-el-uso-de-las-cookies
- EUIPO search: https://www.euipo.europa.eu/eu/trade-marks/before-applying/availability
- Apple DSA: https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements
- SEPE: https://www.sepe.es/HomeSepe/prestaciones-desempleo/cobrando-prestacion-subsidio-desempleo/trabajo-como-autonomo.html
