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

## Mandatory app presentation and authentic-capture gate · 29 October 2026

**Owner directive for ALL Unfire products, present and future:** Every app prepared for Apple, websites, marketplaces, media or a public launch must have a polished, accurate, English-language product presentation backed by **genuine captures of the real running app**. This is a release gate, not a request to generate decorative substitute images or resubmit apps already under review.

1. **Presentation:** prepare a consistent, restrained Apple-quality store/web product story: approved actual app name/icon and branding, one clear value proposition, truthful product description/features, well-composed first image, and a concise sequence of *different* real screens that demonstrates the most important usable functions. Ensure proper hierarchy, spacing, responsive cropping, contrast, legible English labels, accessibility and factual availability. Product trailers/app previews are optional; when used they must be authentic captures of actual interaction.
2. **Authenticity:** capture the **actual running product**, not an AI-generated UI, imagined mockup, staged screenshot, unrelated image, stock asset, outdated UNFAIR/ARCHER/Synth design, or another app's interface. Do not synthesize missing features, obscure critical limitations, paste a fake app screen into a device frame and label it a real capture, or use screenshots from a newer unfinished build to advertise an older delivered build.
3. **Device and version accuracy:** distinguish iPhone, iPad, Mac, browser and other targets. Capture separately for each claimed platform and required orientation/device family; never reuse an iPad UI for iPhone, a Mac window for mobile, or an iPhone Duo/simulator capture as proof of a different physical device. Record exact app/build/version, platform/OS, device or simulator model, capture date, image dimensions, and original source SHA-256 in the **private** product release handoff. A simulator screenshot may be genuine simulator evidence, but never claim physical-device testing without it.
4. **Selection and edits:** retain the real interface and factual state. Permitted presentation treatments such as layout, background, safe crop or typography must not misrepresent the actual in-app contents. Distinguish branded hero artwork from screenshots. Remove placeholder or duplicate views; check spelling, alignment, text truncation, margins, safe areas and accessibility at actual screenshot sizes. Keep the selected original captures, compare compressed/exported outputs against them and confirm readable details.
5. **Legal and privacy:** verify original ownership and commercial rights of all artwork, logos, audio and displayed third-party content; Pinterest sourcing does not establish a licence. Redact sensitive or personal information; avoid publishing the founder's image and private data. Any redaction must be explicit and must not fabricate product behavior.
6. **Release decision:** independently inspect the actual app/build and full final presentation before any upload or listing update. Confirm English-only visible copy, feature truthfulness, native UI behavior, rights, required Apple screenshot dimensions/slots, metadata, app privacy and exact App Store Connect status. Require evidence in the owning issue/PR and a single authorized release integrator. For builds already submitted or in review, preserve the binary and approved in-app design; update only metadata/screenshots if Apple permits and the owner release gate approves. No blind withdrawal, duplicate submission or asset replacement.
7. **Coordination:** follow canonical App Store presentation issue [#215](https://github.com/ondmindmanagement-hub/unfire-website/issues/215), global [#78](https://github.com/ondmindmanagement-hub/unfire-website/issues/78), app catalog [#173](https://github.com/ondmindmanagement-hub/unfire-website/issues/173), and the individual product owner's issue. Before recapturing or rewriting, inspect existing approved captures, pending PRs and file reservations. Agents/sessions that read this file can adopt the gate; editing this file does not broadcast into other live chats.

**No verified real capture for a required app/device/build = presentation BLOCKED, not ready for upload or publication.** Do not substitute generated artwork or make a false readiness claim.

## Existing work · 29 October 2026

- English-only public website and supporting dynamic UI corrections were previously integrated through PRs #229, #231, and #233. Do not reproduce that work.
- 3D game-engine translation remains **incomplete** in draft PR #236. It is not production-ready; visible NPC/dialogue/status strings and integration/cache/device checks remain, subject to the game-owner coordination issue #13.
- App Store metadata and native app language compliance require separate product-owner checks; website localization does not certify those applications.

Apply this file to any new work in this repository and cross-reference the same rule in other Unfire project handoffs. Respect one owner/integrator per release.
