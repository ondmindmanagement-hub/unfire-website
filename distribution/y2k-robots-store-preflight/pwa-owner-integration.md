# Y2K ROBOTS · Windows PWA candidate integration (owner review only)

This candidate is **not currently deployed** and neither app package nor Store registration is complete.

## Source-derived official icon assets

Approved exact source on the owner Mac:
`~/Desktop/Unfire/Coordination/ReleaseCandidates/Y2KRobots_AppStore_20261027/USER_APPROVED_GREEN_ROBOT_1024.png`

Source SHA-256: `f3eda6a0f1fae38f02c7e4c75f93a9e11af414b2148726fbc4b7bd35d6f5113f`.

Derived via **lossless PNG resize only** using macOS sips on 31 October 2026. Existing local outputs (not pushed to the public repository or deployed):
- `~/Desktop/Unfire/Coordination/StoreDistribution_20261031/Y2K_ROBOTS/y2k-robots-icon-192.png`. 192×192 PNG. SHA-256 `69a2f35b90f3c84c5355a809b64b92970acd0d957d3bd9363f5fe75c8326d842`.
- `~/Desktop/Unfire/Coordination/StoreDistribution_20261031/Y2K_ROBOTS/y2k-robots-icon-512.png`. 512×512 PNG. SHA-256 `636d98b7510137224644558f397b5ad184e3f14bf09f96d0b70ad7524036141e`.

Do not accidentally substitute older corporate dragon logos or other robot imagery. Verify the owner's exact approved identity and current licensing before committing official assets.

## Isolated integration steps for the current game/web integrator

1. Confirm #13 and #78 own the public game host/engine and have cleared QA/rights before editing. Do not edit another owner branch.
2. Review, then copy the approved sized PNG files to `audio/img/y2k-robots-icon-{192,512}.png`, preserving verified SHA hashes.
3. Review `windows-pwa-manifest.candidate.json`, merging ONLY compatible fields into `audio/game.webmanifest`. Preserve id `/audio/`, URL scope, original functionality and saved-data behavior. Do not deploy generic images.
4. Review `service-worker.candidate.js`; if legally/technically appropriate, copy to `audio/y2k-service-worker.js` and register it explicitly **only after full load** from the /audio/ owner page, e.g.:
   ```js
   if ('serviceWorker' in navigator && location.protocol === 'https:') {
     window.addEventListener('load', () => {
       navigator.serviceWorker.register('/audio/y2k-service-worker.js', { scope: '/audio/' })
         .catch(() => {}); // Do not block normal browser play.
     }, { once: true });
   }
   ```
   Never cache multiplayer, voice, login, licensed audio, or the WebGL engine without a separately designed cache update/recovery protocol.
5. Test HTTPS PWA criteria with Chromium/Edge; install/uninstall/update and fullscreen ↔ return to website, keyboard/mouse/touch, audio, load, online, save; test Windows hardware before claiming Windows compatibility.
6. When the website and game build pass the owner's release gates, package the PWA with the **official** PWABuilder workflow and select the appropriate developer account identity. Use store signing; do not purchase an unrelated code-signing certificate.
7. Record exact SHA/manifest, test proof, real Windows package receipt, store submission and reviewer status in #44.

## Android is a different deliverable

A Windows PWA is NOT an Android AAB. Before choosing TWA vs native Android, check actual WebGL performance, Android input, audio and fullscreen, external hosts, app policies, and Digital Asset Links/keystore signature. The current Mac has no SDK 36/Gradle/adb/Android Studio as of this audit; installing a heavy emulator could impair other active Mac/audio tasks. Do not claim Android ready without SDK build and real-device tests.

## Limits

No Microsoft account, Play account, app identifier, company incorporation, personal identification number, developer fee, or AAB/MSIX was created by this candidate. No declaration of offline availability. No automation for a personal identity verification or contract signature.
