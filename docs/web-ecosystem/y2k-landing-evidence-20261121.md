# Y2K ROBOTS · Standalone web landing evidence
Status: **REVIEW / NOT LIVE** until an approved merge into gh-pages. Snapshot: 21 November 2026.

## Identity and truthful scope
- Planned public title: Y2K ROBOTS, as documented in the separate PWA identity candidate PR #260 (not deployed).
- The existing public browser beta remains accessible via `https://unfire.technology/audio/` and is still described as UNFIRE Mutants on parts of `/games/`.
- The landing describes the same evolving robot-world project, not a second unrelated game.
- No native PC/Steam binary, listing, release date or price is asserted. Browser beta has documented Android-phone issues (see game owner #13 and PR #335).
- This page contains no game engine, WebGL startup, telemetry, payment, remote dependency or signup. Its media comes from the already-public Unfire game press gallery.

## Original published browser-beta media
Source URLs in `gh-pages`:
- `/audio/press/captures/09-night-flight-panorama.jpg` — SHA-256 `3e8629be6bb979b3566cff91f656d07e0705f572a5b98c5a84327f68043a305b`
- `/audio/press/captures/04-island-exploration.jpg` — SHA-256 `551669308759212d9dc97853ff51fee3cae37751b07ad38b3ec0a6cd3b376309`
- `/audio/press/captures/06-sky-flight-sunset.jpg` — SHA-256 `d614feb4b273f23297ebab8064e682c1acf7c0347e131212076ce728fc5a1bca`

All three hashes were computed by downloading the currently live first-party HTTPS assets and streaming each through SHA-256 on the authorized Mac, without copying private game source or changing any device state.

The night/sunset original capture files were first published through commit `a235ecb5b079363e508e279436d9a67457e5f933`, **24 October 2026 UTC**. That commit's accompanying `tests/audio-press-flight-capture.cjs` shows genuine Chromium WebGL screen captures from the current game engine at a 1280×720 browser viewport, with real game lighting and no generated scenery. `audio/press/index.html` explicitly labels them authentic in-game captures. The island capture was already published in the same first-party press gallery, but original capture date/build/device provenance has not been independently recovered here.

This is **web-browser beta media**, not proof of a native Steam build, physical-console screenshot or final shipping gameplay. Capture creation date is not automatically identical to commit publication date.

## Acceptance evidence
- Head of draft PR #380, `gh-pages` base, exact version must be independently checked before merge.
- Static QA: truthful identity, captions, no store claims, non-indexability, CSS structure, valid local images, zero analytics or auto-loaded game.
- Browser CI (Chromium + WebKit) checks desktop 1440×900, phone 390×844, small phone 320×700 and tablet 820×1180; screenshots are review artifacts. A passing Playwright WebKit run is **not** proof of native Safari or a physical smartphone.
- Release blocker: real game owner confirms public identity, age/rights/legal review (#13/#140/#215), appropriate launch sequencing and privacy, plus desired search-indexing status. Keep noindex and no sitemap/nav link until approved.
- Post-merge only: verify HTTPS page 200 and content under live canonical domain; the website has not been deployed by creating a PR alone.
