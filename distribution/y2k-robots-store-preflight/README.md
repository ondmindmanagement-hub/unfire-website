# Y2K ROBOTS · Google Play and Microsoft Store preflight

Status: **PREPARATION ONLY**. No developer account was created, no fee was paid, no executable package was built, no product was uploaded, and no storefront was submitted or approved by this work.

## Verified product and source

- Selected public game title: **Y2K ROBOTS**. Publisher brand: **Unfire**. Keep existing technical URL identifiers stable.
- Canonical playable web experience: https://unfire.technology/audio/
- Existing discovery page: https://unfire.technology/games/
- Existing beta landing: https://unfire.technology/audio/beta/ (older UNFIRE Mutants wording; noindex at audit).
- Genuine-capture press page: https://unfire.technology/audio/press/
- Owner coordination: issues #13 (game) and #44 (distribution); global #78; rights #140 and presentation #215.
- Free-first base game approved in #44 on 30 October. Paid DLC is hypothetical and is NOT enabled.

## Microsoft Store path

Microsoft says a PWA can be packaged with **PWABuilder**, using the live HTTPS site, a compliant web app manifest and a service worker. Microsoft signs the package and new developer registration is free via https://storedeveloper.microsoft.com/ . It still requires legal account classification, identity verification, packaging, accurate game behavior and Microsoft certification. Do not promise offline gameplay or support unless implemented and tested.

Official sources:
- https://learn.microsoft.com/en-us/windows/apps/package-and-deploy/choose-distribution-path
- https://learn.microsoft.com/en-us/windows/apps/publish/partner-center/open-a-developer-account

## Google Play path

Google Play developer registration: **US$25 once**, paid only by the owner after identity/account review. An actual tested **Android App Bundle (.aab)** is required; the website or Windows PWA is not itself an Android release package. Evaluate a native Android implementation or a secure, policy-compliant Android Trusted Web Activity if compatible with the actual game; do not assume wrapping is sufficient.

For a newly created personal developer account, Google requires **12 opted-in closed testers continuously for 14 days**, followed by an application for production access. Organization accounts ordinarily require organization records and D-U-N-S. Google may publicly disclose legal name, country and other details based on account type, location and monetization. Account selection must therefore be reviewed before registration.

Official sources:
- https://support.google.com/googleplay/android-developer/answer/6112435
- https://support.google.com/googleplay/android-developer/answer/14151465
- https://support.google.com/googleplay/android-developer/answer/13628312

## Checked-in candidate assets and Android source configuration

- Official green robot image derivatives (192 and 512 PNG) are staged under `assets/` in this **draft** branch; image content hashes and dimensions are verified by `store-candidate.test.mjs`. They have not been copied into live `audio/img/` or deployed.
- `windows-pwa-manifest.candidate.json` and `service-worker.candidate.js` are inert Windows PWA integration candidates, not an installable Windows Store package.
- `android-twa-manifest.candidate.json` is an UNSIGNED, UNBUILT Bubblewrap configuration proposal, not a valid Play release or reserved package identity. Run the official generator only after the game site, icons and owner legal review are ready.
- Candidate tests: `node --test distribution/y2k-robots-store-preflight/store-candidate.test.mjs`.

## Android Digital Asset Links preview gate

`assetlinks-preview.mjs` is a read-only generator for the actual `/.well-known/assetlinks.json` content **only after** Play App Signing supplies a real SHA-256 **app signing certificate** fingerprint (not simply an upload certificate). The output is printed to stdout for human review, not written/deployed. Missing, malformed or zero placeholder fingerprints exit nonzero without JSON. Example with a verified REAL value only:

```bash
node distribution/y2k-robots-store-preflight/assetlinks-preview.mjs \
  --package technology.unfire.y2krobots \
  --sha256 "REAL:32:BYTE:SHA256:PLAY:CERT:FINGERPRINT"
```

The above string is **a placeholder**, not a valid command argument. Never put a fabricated fingerprint into the website. The package ID is also a candidate until confirmed in Play Console. After signing, independently verify certificate provenance and match the exact production package name, then validate the association on a physical Android device. See the official Chrome TWA documentation.

Tests:

```bash
node --test distribution/y2k-robots-store-preflight/store-candidate.test.mjs distribution/y2k-robots-store-preflight/assetlinks-preview.test.mjs
```

## Static preflight

Run from repository root:

```bash
node distribution/y2k-robots-store-preflight/preflight.mjs
node distribution/y2k-robots-store-preflight/preflight.mjs --strict
```

The default command reports observed blockers without changing any files or returning failure. Strict mode exits nonzero for static blockers. This static scan **does not** certify a PWA install, HTTPS, Android build, performance, real gameplay, ownership of music/assets, privacy, security or store compliance.

## Mandatory release gates before either submission

1. Confirm who legally owns the publisher account; do not misrepresent an unincorporated project as a registered legal organization. Confirm public identity disclosures, whether any release or revenue constitutes self-employment, and SEPE obligations before commercial activity.
2. Use the approved green robot game icon and **genuine game captures**. No synthetic, generic, replaced or third-party art; clear third-party music/voice/assets for redistribution and commercial rights.
3. Complete #13 integrated engine/mobile/desktop QA: first three missions, start/return, orientation, performance, save, real multi-device online and reconnection; record build SHA/platform/device.
4. For Microsoft: match PWA name, English content, manifest, installable assets and service worker; test PWABuilder generated MSIX **on Windows** and Microsoft Store certification flow.
5. For Google: produce signed release AAB with unique application ID, target SDK per current Play policy, privacy/Data Safety/age rating, real Android tests; organize testers if account is personal.
6. Review privacy notices and app content, support channel, permissions and non-misleading store claims. No payment links, cosmetic transactions or unapproved DLC.
7. After verified owner legal/quality approval and any required payment/signature, submit to the correct existing account (avoid duplicates). Record actual receipt, package version and review state in #44. **Never claim live until verified.**

## Current blockers recorded on 31 October 2026

- `audio/game.webmanifest` still names **Unfire Audio**, has a Spanish description and lacks a verified approved 512px game icon; static scanner checks exact source.
- The current source pages and old beta landing use prior game names in places; they must be aligned by the current web/game owner without breaking URLs.
- Windows MSIX and Android AAB are not verified built, tested or submitted.
- No confirmed Microsoft Partner Center or Google Play Console developer registration was found in the available Unfire business inbox search; absence of email is not proof no account exists elsewhere.
- Do **not** edit occupied `audio/`, `games/` or game-engine paths from this prep branch. This pack is intentionally isolated and should remain a **draft PR** until the product integrator reviews it.
