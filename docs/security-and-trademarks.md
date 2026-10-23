# Unfire — security and third-party trademark standard

Reviewed: 23 October 2026. Applies to website, Audio experience, game,
downloads, apps, releases and promotional copy. Internal operating standard,
not an independent legal opinion.

## Rules for all contributors and agents
1. Read issue #13, latest `main`, open pull requests, CI and file reservations before editing. Reserve a disjoint scope in issue #13; use one branch/owner per area and one release integrator. Never claim that other chats are automatically synchronized.
2. Never publish tokens, passwords, signed URLs, customer/user records, private identifiers, internal project notes or unlicensed assets. Use GitHub secrets or an authorized backend for runtime credentials, not JavaScript, HTML, images or public Git history. If exposed, revoke/rotate first, then remove content and review Git history and caching.
3. Do not directly process or store passwords, payment credentials or sensitive personal data in the static website. No direct checkout until the legal-commerce gate and verified fulfillment, refunds and privacy controls pass.
4. Keep only files needed to publish in GitHub Pages. Existing root historical HTML/TXT snapshots are accessible: archive privately, compare for data exposure and remove via separate reviewed PR. Removing a file does not erase Git history.
5. Validate external links, forms, embeds and script origins. For new-window links use `rel="noopener noreferrer"`. Avoid HTTP scripts, `eval`, unsafe unescaped HTML sinks, unrestricted cross-window messages and unnecessary third-party trackers. Avoid storing identifiable data in browser telemetry.
6. Test permissions, camera/microphone privacy, multiplayer trust boundaries, rate limiting, access control, browser and mobile flows separately before launch. P2P clients and front-end checks are not a substitute for server-side authorization.
7. Prefer passkeys/hardware-backed MFA for the owner accounts (GitHub, DNS registrar, Google Workspace and merchant). Use least privilege, protected main, required CI and human review. Never disclose backup codes in issues or commits.

## Apple and other brands
- Product names remain **Unfire**, **ARCHER**, **BOLT**, etc. Refer to third-party product names only to accurately describe verified compatibility.
- Accurate phrases in descriptive copy: “ARCHER for Mac”, “ARCHER for iPad”, “ARCHER for iPhone”, “Compatible with macOS” where actually tested. Distinguish compatibility labels from the product name, title, app store metadata and legal affiliation.
- Do not use “Built for Apple”, “Apple-certified”, “official Apple partner”, Apple-owned logos, screenshots, badges or photography without the applicable permission/brand guidelines. No claims of endorsement, and no compatibility promises for unfinished products.
- Spell marks as prescribed (for example **iPad**, **iPhone**, **Mac**, **macOS**; do not pluralize a trademark as “iPads” in formal marketing).
- Accurate references to Windows and Android are generally descriptive; still follow the respective owners' branding guidelines and verify compatibility.
- Legal notices should credit third-party mark ownership and state clearly that Unfire is independent; no affiliation implied. For App Store badges or official device representations, consult the separate official marketing terms before use.
- Resources: https://www.apple.com/legal/intellectual-property/guidelinesfor3rdparties.html and https://developer.apple.com/app-store/marketing/guidelines/

## Security limits and review queue
- GitHub Pages currently serves the HTTPS site; response headers observed on 23 Oct 2026 did not show a configured CSP, HSTS, Permissions-Policy or other custom hardened HTTP headers. GitHub Pages does not provide normal per-project response header controls. Evaluate a compatible DNS/proxy/CDN migration before claiming they are deployed. Do not apply an untested CSP that breaks audio, WebGL, embeds or payments.
- Google Workspace DNS publishes SPF and DKIM, but DMARC was `p=none`: use authentication reports to confirm all authorized mail streams before gradually enabling quarantine/reject. Do not change DNS blindly.
- The static CI scanner flags high-confidence leaked credentials and sensitive paths. It intentionally warns rather than blocking for legacy archives and some link hygiene; further human review is necessary.
- Review any unlicensed music/sample/video assets (especially redistributions) and privacy/consumer terms before publishing.
- Vulnerability reports: https://unfire.technology/.well-known/security.txt

## Release checklist
- [ ] GitHub issue #13 and file reservations checked; main and CI reviewed
- [ ] No secrets, private personal data or obsolete public archives
- [ ] Dependencies, scripts, external links and rights verified
- [ ] Product names, third-party marks, compatibility and actual availability checked
- [ ] Privacy and permissions tested; no unsupported claims
- [ ] Browser, mobile, rotation, low-end and multiplayer QA where relevant
- [ ] CI green, single integrator, deployment verified and rollback reference recorded
