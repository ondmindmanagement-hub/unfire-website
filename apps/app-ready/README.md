# App Ready Web Lab — Unfire

Independent experimental browser checklist, **not a port of a finished macOS app**. The native UnfireSuite AppStorePrep module contains only its metadata JSON and minimal Swift enum. This browser utility implements actual local human self-review and preserves the distinction.

## Functionality
- Pick one target platform: macOS, iPhone or iPad. Switching platform resets checklist answers.
- Inspect 19 applicable, evidence-driven release gates; mark each Pending or Checked; only conditional gates permit Not Applicable.
- Summary updates immediately. Even 100% means only self-reported progress, never certification or Apple approval.
- Optional app name; export a dated local JSON report on user click; import reports with JSON schema, unknown-key rejection, 64 KiB bound and restricted status values.
- No login, remote calls, cookies, localStorage, IndexedDB, analytics, credential handling, automatic uploads or document publication.
- User content is displayed using textContent. Restrictive CSP: connect-src 'none', script-src 'self'.
- Experimental URL uses noindex; the page never submits to or signs in to Apple.

## Upstream references checked November 22, 2026
Apple App Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
Apple App Store Connect submission process: https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app
Apple Screenshot specifications: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/

## Scope limitations
No automatic binary scan, screenshot validator, legal rights proof, upload, notarization, App Review access, privacy audit, performance certification or guarantee of approval. Review access credentials should never be entered in this page. Apple may change its requirements; verify current official documents before submission.

## QA and publication gate
- Deterministic Node tests: task visibility, state validation, report I/O, malformed JSON, filename safety.
- Real Chromium/WebKit E2E at 390/768/1440 widths: platform-specific tasks, status controls, progress, download/import, explicit reset, no overflow, no third-party requests, axe-core WCAG 2.2 AA automated check.
- GitHub public repo preflight, privacy/SEO/security checks. All required jobs must pass before release.
- After merge, verify GitHub Pages built the expected head and the live HTTPS route and its assets respond with correct content.
- No external fees, Apple terms acceptance or edits to native packages.

This tool is independent from and not endorsed by Apple. © Unfire.
