# God's Lamp · Original UI reference gallery and release boundaries

Review date: 21 November 2026. Public website source: `gh-pages`. This feature is a DRAFT and is **not merged**, linked in the app catalogue, or listed in the sitemap.

## Provenance and integrity

Two first-party owner-supplied original interface screenshots were inspected visually and checked against the local source-port QA status. They form a **reference gallery**, not evidence that the current iPhone/iPad app has reached release parity or cleared App Store review.

| Mode | Owner-provided original | Source SHA-256 | Derived public reference | Derived SHA-256 |
|---|---|---|---|---|
| SONG | `IMG_8968.PNG` | `5331decd4f4130c1d71e6a904cc6a34e7270230c99d4b2e6aadfc6d005b6979b` | `apps/gods-lamp/media/original-song-reference.png` | `bd308c54e76d475c54081d7222c54dffa472c021b3c6064ab22ab10bdfd99e6f` |
| STEP | `IMG_8970.PNG` | `e5cc23fb55d0047ac7fc6389aaac9c17bc894912627c6a4d78835cf8074269e0` | `apps/gods-lamp/media/original-step-reference.png` | `0e2d4f0f8f5ddf62fe117fea5823e0a4a0961a6e26d00d8f6c07fbd93499c5b7` |

Source images measured 750 × 1334 pixels. The *only* alteration was a 39-pixel crop at the top to remove the phone status bar (result 750 × 1295). **No controls, labels, layouts, artwork, device bezels or screenshots were generated, redrawn or rearranged.** The original files were read-only; the derived copies were prepared in an isolated temporary directory and placed in an isolated website PR branch.

## Exact claim boundary

- The six owner-provided screenshots are documented as the original source references for the distinct RC73 port effort.
- Native iOS **development QA** captures were also found, but they are marked `SIM_NOT_FOR_APPSTORE` or `STEP_*_development`, show simulator UI overlays and do not demonstrate completed port fidelity. They are deliberately **excluded** from this website gallery.
- The port status document notes that the shipping target still uses a different stage; STEP original port is exposed in Debug QA, and SOUND, TAPE, VOICE, PLAY, COLLAGE, master EQ and additional settings still require parity or explicitly documented differences. Do not advertise them as currently verified iOS features.
- Original SONG/STEP user-provided references may differ from the eventual Android/iOS store builds. They are **not current iOS, iPhone Duo or iPadOS product captures**.
- No asset in this PR should be uploaded to App Store Connect as a native screenshot without an exact current build/device provenance review. No account, session, native app, game, billing or Apple submission was modified by this website work.

## Website gate

Before any promotion from `noindex,nofollow`, the product owner/integrator must review first-party app features by platform, permissions/privacy, trademark/media rights, App Store/Play release status and **authentic native device captures** from the exact approved build. CI checks capture-byte fingerprints, source paths, responsive rendering in Chromium and WebKit, and the explicit “reference only” captions. Browser QA is not physical iPhone testing.

The zero-cost public static landing remains useful as a future dedicated app home without falsely suggesting that a proof-of-concept is already a published app.

## Original approved visual identity

The original iOS release-candidate project's **actual current app icon** was inspected visually. It depicts a bright magenta/purple/orange lava lamp (not an arbitrary glowing sphere). Its 1024 × 1024 PNG is **byte-identical** in the newer separate RC73 development source: SHA-256 `5aef1293812bd2877e817eeb4e76696d7a10e5ca5f0784d606ffb9d9acd9472c`. Its unchanged PNG was added as `apps/gods-lamp/media/gods-lamp-app-icon-1024.png` for the landing hero and social preview. This is the authentic brand icon, **not an app-interface screenshot**.

## Platform distribution evidence, not release claims

- A 21 November 2026 Android verification handoff recorded Google Play **closed testing active**, app `technology.unfire.godslamp`, 1.0.0 (1), **0 of 12 production-gate testers opted in** as of that handoff. Do not claim production availability or present opt-in as public Google Play release.
- The iOS release-candidate upload log on 21 November 2026 reports **UPLOAD SUCCEEDED** for the 1.0.3 IPA. A successful transport to Apple does not establish App Store processing acceptance, TestFlight availability, review approval, App Store listing or public release.
- Separate in-progress source-port QA explicitly states that the iOS app has **not** achieved full RC73 original-UI parity; do not use its development-only simulator captures as product/store artwork.
- No live store link, availability badge, price, download or paid checkout is published by this draft.

The website may be used as a private-review-by-URL preview with `noindex,nofollow` after other release gates. Open search indexing remains blocked until the real final production apps and lawful commercial presentation are verified.
