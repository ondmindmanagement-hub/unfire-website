# UNFIRE · Web game player analytics (DRAFT / tracking OFF)

Owner: issue #331. Dependencies: game #13, distribution #44, privacy/legal #140 and coordination #78.
Branch: feature/unfire-play-metrics-isolated-20261115, from main. Scope: NEW files under analytics/game-play only. Never overwrite audio/index.html, audio/maletin/**, checkout, privacy/cookies or the live gh-pages deployment without the sole release integrator.

## What can be measured (only after deployment)

- Website visitors: estimated distinct browsers/visitors of /audio/ in the chosen provider, NOT verified players.
- Pageviews: loads of /audio/; iframe preload is not a game session.
- Game starts: event "unfire_game_start" fired at actual immersion only after UNFIRE_SCENE.isReady; this counts game entries/sessions, NOT unique humans.
- Active duration: event "unfire_game_end", with only a coarse duration_bucket (under_1m, 1_to_5m, 5_to_15m, 15_to_30m, 30m_plus). Hidden-tab time is excluded, page-unload data can be lost, and network blocks may undercount.
- Countries/devices: only aggregated, if the approved provider supports it and the privacy notice properly discloses collection.

No existing analytics history was verified. None can be reconstructed from this client candidate.

## Vendor integration — requires real credentials/configuration and legal gate

Umami Cloud Hobby currently offers $0/month, up to 100K events/month, one website, six months of retention; verify current plan before using. Docs: https://docs.umami.is/docs/track-events and https://umami.is/pricing

No Umami account/site ID is verified for Unfire. This adapter performs ZERO HTTP requests on its own, stores no IDs or cookie, uses no local/session storage or device fingerprint and runs no timer.

The caller MUST separately enable ALL safety gates:
1. Privacy/legal owner validates the lawful basis for event recording (especially European visitors and minors), disclosure, provider contract/transfers, data minimization, retention and whether consent is necessary. No claim of automatic GDPR compliance. Do not activate when the user has opted out.
2. Owner authorizes a Umami website for the canonical hostname and obtains its REAL website ID. Never fabricate the ID or put an admin/API key into the website. The public website ID is separate from any sensitive API token.
3. Release integrator ensures the tracking script is NOT loaded before the applicable privacy gate; if authorized, install once on the top-level host /audio/ (not its child iframe), with restrictive hostname and do-not-track settings. Official script: https://cloud.umami.is/script.js . Require the actual site ID and check CSP, legal documentation, and possible mobile performance effects.
4. Only after those conditions are met, the authorized host may set window.__UNFIRE_ANALYTICS_APPROVED = true. This flag is NOT legal proof on its own.
5. Host owner loads this local adapter and makes these three tiny calls in the already-owned game lifecycle:
   - In the existing enterGame function after a real UNFIRE_SCENE.isReady() gate and the entryStart message: window.UnfirePlayMetrics?.start()
   - In actual exitGame: window.UnfirePlayMetrics?.end()
   - In intentional resumeGame after returning to the website: window.UnfirePlayMetrics?.start()
   - Avoid iframe load, scrolling, page load, menu hovers, preview views, failed WebGL boot, and every-frame game loops.

The adapter also stops a session on pagehide and pauses active duration when the tab becomes hidden. DNT/GPC triggers suppress custom events. For provider-level pageviews, its own loading must also be blocked when the privacy gate is not met.

## Evidence and release checks

Synthetic local QA on 15 Nov 2026: node --test collector.test.cjs -> 10 PASS / 0 FAIL. Tests prove no requests from the adapter without a correctly configured synthetic tracker, double-start suppression, hidden time exclusion, pagehide cleanup, and blocked-provider tolerance. They are not a production analytics acceptance test.

Before release: single integrating game owner, CI against combined SHA, real browser + iOS/Android QA, check no extra WebGL/audio overhead, validate data sent only for permitted users, network inspection, verify only expected event names and duration buckets, public site /audio/ verification, a real provider dashboard with test-mode entries (distinguish synthetic QA from actual players), and rollback.

Do NOT merge or deploy this draft automatically, send data to unapproved endpoints, interpret visits as unique players, or claim any historical player count.


## Secure manual loader added on 15 Nov 2026 (no vendor account created)

New files: loader.js, loader.test.cjs, integration.test.cjs. Test command:
node --test analytics/game-play/*.test.cjs
On the connected Mac: **20 tests PASS, 0 FAIL**, including a synthetic complete user entry after pageview and revocation blocking subsequent game events. This is local QA, NOT proof of production transmission.

The approved website integrator must load collector.js and loader.js on the SAME top-level /audio/ page; neither script loads a vendor automatically. After a REAL legal/privacy gate and production release signoff, the integrator may authorize:
- window.__UNFIRE_ANALYTICS_RELEASE_APPROVED = true (verified owner release decision);
- window.__UNFIRE_ANALYTICS_PRIVACY_GATE = true (actual approved lawful basis/consent logic, not blindly hardcoded true);
- window.UnfirePlayMetricsLoader.enable(REAL_UMAMI_WEBSITE_UUID); this is a public website UUID, NOT an API token or admin secret.

The loader validates a UUID, exact HTTPS hostname, release and privacy flags, Do Not Track/GPC, injects https://cloud.umami.is/script.js once and sends ONE manually invoked pageview after onload. Automatic pageviews are disabled via data-auto-pageview=false to minimize unexpected activity; URL search and hash are excluded. The collector separately gates EVERY game event on active release/privacy flags. Consent revocation should call loader.revoke(), which blocks future custom events but cannot undo earlier vendor processing. The website privacy integrator must consider whether complete vendor unload/reload is required. Do not load the vendor in an iframe.

**Event-based active-player report once live:** open Umami website Reports/Overview and filter Event = unfire_game_start; read Visitors for an estimated number of distinct visitors who triggered a play event in the selected date interval. Read the Events metric for total starts. This is not a count of authenticated distinct humans; privacy resets, browser/device changes, blockers and revisits make it approximate. Umami documentation: https://docs.umami.is/docs/filters and https://docs.umami.is/docs/cohorts .

Umami Cloud Hobby is free for one website up to 100K events/month with 6-month retention (subject to provider changes). The cloud free plan does not advertise API access; a verified dashboard or read-only share URL is the supported way to inspect statistics. Set EU data region when creating the account if appropriate, while noting subprocessor traffic may extend outside the EU. References: https://umami.is/pricing and https://docs.umami.is/docs/cloud/faq .

Last read-only live-site probe: 15 November, /audio/ returned HTTP 200 and showed none of Umami, Plausible, GA, Matomo, PostHog or Cloudflare Insights in its public HTML. **NO LIVE TRACKING VERIFIED.** No account, website ID or dashboard has been created or claimed by this PR.
