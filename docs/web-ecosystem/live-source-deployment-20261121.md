# Unfire web ecosystem — verified live-source deployment plan
Date: 2026-11-21 · Release status: PREVIEW (this branch not merged yet).

## Critical source distinction
- `gh-pages` is the **actual source currently serving** `https://unfire.technology/`, verified by matching the live `/portable-synth/` HTML and its exact GitHub file content.
- `main` does **not** contain that live `portable-synth/index.html`. A proposal built only from `main` must not recreate or overwrite it as if absent.
- Live `/portable-synth/`: **Android Direct edition 1.0.5**, GitHub Release `portable-synth-daw-android-direct-v1.0.5` (published 2026-11-09), with its own SHA-256 and a separate Google Play beta channel. Preserve its download and legal disclosures.
- Existing `/games/` is a portal; `/audio/` is an existing web game. The future Y2K ROBOTS separate landing `/games/y2k-robots/` is **not** live at initial audit (HTTP 404) and must not conflate unreleased native/Steam work with the existing browser-beta identity.

## Current safe scope
- `/portable-synth/play/`: small browser-based Web Audio keyboard, waveform and volume controls. Not a port of the Android studio; no sequencing/recording or full native feature parity.
- Shared CSS and accessibility support.
- A single additional link on the existing live Android Direct product page, **without modifying any APK URI, checksum, signed-edition description or privacy warning**.
- Contextual links from the existing `/apps/` catalogue and newly canonicalised product/retail routes in `sitemap.xml`.
- No payment APIs, backend, cookies, account creation, tracking or Mac build.
- Browser testing on GitHub-hosted Ubuntu 24.04 to prevent Playwright Ubuntu 26.04 dependency failure; final genuine Safari + physical mobile checks are a separate gate.

## Release process
1. **Branch** `release/web-audio-microsite-ghpages-20261121` must target `gh-pages`, not `main`.
2. Confirm static tests, Chromium and WebKit responsive smoke, no bad links or broken image loads, no uncaught JS exceptions, local-only synthesis, real screenshots of the page.
3. Check approved app and policy copy, cross-device touch and Mac Safari (CI WebKit is *not* proof of running native Safari).
4. Authorized single integrator may merge only after checks and page owner clearance. Existing Android Direct page must be diff-inspected to rule out accidental changes to the download source or cryptographic hashes.
5. After merge, `curl` live HTTPS `/portable-synth/play/`, `/portable-synth/`, `/apps/`, `/sitemap.xml`; inspect the page for real accessibility and sound. Sitemap alone does not guarantee Google indexing; use Google Search Console and Bing Webmaster Tools free validation.

## Other pages after this one
- Existing pages: `/bolt/`, `/archer/`, `/apps/power/`, `/apps/bolt-mobile/`, `/apps/archer-mobile/`, `/apps/pocket-capture/`, `/apps/unfire-control/`, `/autonomy/`, `/signals/`, `/audio/tienda/`.
- Separate Y2K ROBOTS landing only with game owner approval (#13, draft PR #260), correct branding, rights-cleared authentic game assets and unambiguous Steam status.
- God's Lamp: no new release page without confirmed identity, current screenshots and product readiness.
- Web ports one-by-one: browser audio/recorder/energy tools can be local-first; do not market privileged macOS Bolt/Unfire Control functions as browser capabilities.
- Long-term SEO: unique helpful documentation, release notes, FAQs, support, truthful screenshots, accessible pages and internal links. No empty duplicate pages or bought traffic.

Coordination: global #78, Apple product presentation #215, game #13, existing synth visual PR #230, and main-only draft PR #373 (superseded for publishing purposes). This note establishes **no** live deployment until explicitly verified.
