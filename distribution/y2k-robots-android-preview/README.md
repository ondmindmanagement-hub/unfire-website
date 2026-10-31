# Y2K ROBOTS · Android TWA preview source

**Experimental build evidence only. This is NOT a Play Store release candidate, not signed for distribution and not published.**

A minimal [Android Browser Helper](https://github.com/GoogleChrome/android-browser-helper) Trusted Web Activity launcher for the existing public browser experience at `https://unfire.technology/audio/`. This source is intentionally in an **isolated child draft PR** from the #259 store-preflight branch. No edits to the game, iOS/macOS build, host web, payment system, local Mac Android SDK or production signing data.

## Build target

- `applicationId`: `technology.unfire.y2krobots` **proposal, not reserved/confirmed in Play Console**.
- Android `compileSdk` and `targetSdk`: 36, `minSdk`: 26.
- Android Gradle Plugin 8.13.2, Gradle 8.13, JDK 17.
- `com.google.androidbrowserhelper:androidbrowserhelper:2.7.4`, Apache 2.0.
- `app/src/main/res/drawable-nodpi/game_icon.png`: exact approved game-green-robot 512px PNG, SHA256 `636d98b7510137224644558f397b5ad184e3f14bf09f96d0b70ad7524036141e`.

## GitHub Actions

The `Y2K ROBOTS Android TWA unsigned preview` workflow runs on a GitHub-hosted Ubuntu runner, **not the user's Mac**. It checks resource identity and sources, then attempts a debug APK and an **unsigned** release Android App Bundle, reports the output hashes and immediately discards CI output. It does NOT upload distributable build artifacts, deploy a web change, sign using developer credentials or invoke Google Play. The public repository's Actions job still uses repository CI resources; check failure logs before claiming a successful build.

The preview web origin may display a browser address bar because `/.well-known/assetlinks.json` with a REAL app signing certificate does not exist. This is intentional; no placeholder signature, key or relationship is asserted.

## Before ANY Play submission

- Review publisher legal identity, personal public disclosures, benefits/SEPE, privacy and license/audiovisual rights (#140). Do not use fake organization details or unreviewed copyrighted assets.
- Verify the current game owner release #13, actual mobile full game performance (heat, touch, orientations, story, save, audio, online PeerJS, reconnect) on a real Android device; this preview source/build is insufficient.
- Confirm unique package ID in the correct developer account. Generate a real upload key **privately**, configure Play App Signing and deploy verified Digital Asset Links with the actual **app signing** certificate, not a synthetic placeholder.
- Produce truthful Android captures from the installed build, accurate disclosures/ratings and an AAB signed for the authorized developer account. Personal new-account testing requirements may apply.
- Verify `audio/game.webmanifest` and owner-approved green icon have been deployed by the game owner; the live website is still not certified as an installable PWA. TWA in this preview is a separate unshipped Android app and does not certify Microsoft Store compatibility.

**No payment, Play registration, live deployment or publication authorized by these files.**
