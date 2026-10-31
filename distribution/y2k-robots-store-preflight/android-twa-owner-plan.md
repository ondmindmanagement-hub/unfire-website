# Y2K ROBOTS · Android / Google Play release candidate plan

Status: **UNBUILT SOURCE PLAN**, not APK or AAB, no Android SDK installed, no Play Console account verified and no signing key generated.

## Proposed implementation

If the *actual* mobile game works well, preserve the existing free browser experience and generate a **Trusted Web Activity (TWA)** using Google's open-source Bubblewrap rather than shipping an arbitrary insecure WebView wrapper. The Android package will depend on Chrome-compatible browser support and HTTPS availability. A real Android build and on-device performance, audio, touch, orientation, online multiplayer, reconnect and permission testing are compulsory before any store submission.

The protected origin is `https://unfire.technology`, web manifest is `https://unfire.technology/audio/game.webmanifest`, launch is `/audio/`. Keep technical web manifest `id=/audio/` stable for installed users. Proposed Android application ID for owner/legal review: `technology.unfire.y2krobots` (a **candidate**; not reserved in Play Console). Do not commit to production ID without publisher account access and collision check.

A separate `android-twa-manifest.candidate.json` is staged in the same PR; it has no keystore, signed fingerprint or reserved Play identity and MUST be checked against Bubblewrap's current generated schema before use. The owner-approved official icon PNGs are staged under `assets/` without modifying the game.

## Canonical workflow after PWA owner integration and full QA

1. Verify genuine approved 192x192 and 512x512 icons, English metadata, security, an intentionally registered service worker, HTTPS and the exact deployed launch page. The current `audio/game.webmanifest` does not yet match this candidate and `https://unfire.technology/audio/sw.js` returned 404 on 31 October 2026.
2. Initialize in **separate Android-only workspace**, not the Apple/game active working tree:
   ```sh
   bubblewrap init --manifest=https://unfire.technology/audio/game.webmanifest
   ```
   Confirm values interactively; create the signing/upload keystore privately. **Do not store keys, personal data, passwords, API credentials or hashes of private identity documents in the public GitHub repository.**
3. Review generated `twa-manifest.json`, app ID and `app/build.gradle`. The current Google Play target for new Android phone apps is **API 36** as of 31 August 2026. Follow the current official Android compatibility requirements. No assuming that a generated default SDK is sufficient.
4. Compile using **official Android SDK API 36**, then `bubblewrap build` to produce APK and AAB. Record SHA-256 and version code/name; do not claim completion from an ordinary source ZIP or a Java syntax check.
5. Before trusting fullscreen, generate and host the real `https://unfire.technology/.well-known/assetlinks.json` **after** the final package signer certificate SHA-256 fingerprint is known; association needs the correct app package name and certificate. **Do not invent fingerprint or package signature.**
6. Test installed APK on at least one real Android phone in both orientations, including WebGL load, frame stability and heat, foreground/background, audio, camera/mic permissions, safe-area, game returning from fullscreen, first missions, local save, WebRTC/P2P invitations and recovery without a host. Check Google Play game policies and unique functionality. No monetization or push/analytics by default.
7. Register or reuse the correctly verified Google developer identity. Google charges a one-time **US$25** and new personal accounts require at least 12 continuously opted-in testers for 14 days before applying for production access. Registration and any developer agreement require the account owner's action. Check public identity and tax/SEPE implications before selecting account type.
8. Complete Play's Data Safety form, privacy URL, content rating, target audience and any permission/advertising declarations from actual signed build. Prepare real Android screenshots, not iOS or desktop captures. Upload the signed AAB only to an authorized testing track, monitor tests, then seek production review after explicit owner approval.

## Why no Android build on 31 October

The authorized Mac has Java and Node but **no Android Studio, Android SDK, Gradle, adb or sdkmanager**. There are active Apple/game/audio worktrees; avoid a large emulator installation, license acceptance or unexpected storage/CPU load. Existing Unfire Android Bolt pilot #241 is **a different application**, with separate owner and source, and must not be confused with Y2K ROBOTS.

## Official sources

- https://github.com/GoogleChromeLabs/bubblewrap/tree/main/packages/cli
- https://developer.chrome.com/docs/android/trusted-web-activity/quick-start
- https://developer.android.com/google/play/requirements/target-sdk
- https://support.google.com/googleplay/android-developer/answer/6112435
- https://support.google.com/googleplay/android-developer/answer/14151465
