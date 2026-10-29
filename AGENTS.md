# Unfire · Global English-only standard

This repository follows the **Unfire English-only standard** for every new or modified user-facing deliverable. This instruction applies to coding assistants, collaborators, and release integrators who read this file. The cross-project handoff and coordination source is [Unfire issue #78](https://github.com/ondmindmanagement-hub/unfire-website/issues/78).

## Required language

- Use natural, professional **English** in all public product surfaces: company and product websites, web apps, games, macOS/iOS/iPadOS apps, desktop and mobile UI, onboarding, buttons, menus, notifications, errors, accessibility labels, and help/support copy.
- Use English for externally distributed App Store product names/descriptions (except proper names), subtitles, keywords, screenshots, preview videos, captions, trailers, marketing, and published product documentation.
- Correct existing Spanish, Catalan, and mixed-language copy when working in the relevant owner-controlled scope. Do not add a new language selector, localStorage preference, or browser-language fallback that silently returns a public release to Spanish.
- Preserve product and brand names, technical identifiers, API keys (names only, never credentials), stable data keys, saved-game formats, route URLs, file names, and API/protocol compatibility. Do not rewrite internal symbols merely because they resemble non-English words.
- Do not silently delete or rewrite existing contractual/legal disclosures or translations. Send legal-language changes through the responsible review/approval process; translations required by law must be retained if applicable.
- User conversations and private coordination may remain in the user's preferred language. This policy concerns the actual Unfire deliverables and their public release surfaces.

## Release acceptance and safety

1. Audit visible/static and runtime-generated strings, native UI, canvas/WebGL labels, screen-reader text, alerts, errors, embedded artwork, screenshots, Store metadata, and videos for unintended non-English text.
2. Verify on actual supported screen layouts and platforms. Source-level string replacement alone is not evidence of a fully English app.
3. Add or update targeted language tests, preserve functional behavior, and complete the project's existing tests and release gates.
4. Avoid duplicate work: check the owner issue, current main, open PRs, CI, and file reservations before editing. Do not edit reserved files or merge a draft under a project freeze.
5. Never claim a build is submitted, approved, deployed, or fully localized without direct verification. Do not submit to Apple or change product/release state just to satisfy this policy.

## Existing work · 29 October 2026

- English-only public website and supporting dynamic UI corrections were previously integrated through PRs #229, #231, and #233. Do not reproduce that work.
- 3D game-engine translation remains **incomplete** in draft PR #236. It is not production-ready; visible NPC/dialogue/status strings and integration/cache/device checks remain, subject to the game-owner coordination issue #13.
- App Store metadata and native app language compliance require separate product-owner checks; website localization does not certify those applications.

Apply this file to any new work in this repository and cross-reference the same rule in other Unfire project handoffs. Respect one owner/integrator per release.
