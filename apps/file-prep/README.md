# File Prep Web Lab — Unfire

Status: experimental, independent browser utility. The UnfireSuite native File Prep AI module currently establishes metadata and a product shell; this is NOT a port of a mature native application.

Available functions: normalize text line endings without changing Markdown soft breaks by default; optionally trim trailing spaces, reduce extra blank lines and trim outer whitespace. Validate/pretty-print JSON with built-in JSON.parse / JSON.stringify. Split text into labeled, overlapping chunks of a user-specified **character** size; chunk sizes are not token counts and may repeat context. Load only UTF-8 TXT, MD, CSV or JSON local files, up to 512 KiB and 200,000 characters. Copy/download only after user action.

Not included: DOCX/PDF processing, OCR, AI model API, automatic upload, privacy classification or personal data scanning. Source text remains in this tab; CSP blocks network requests and the program uses no third-party libraries or persistent storage. Warn users that text may contain private information.

Launch gates: unit tests, Chromium + WebKit functional browser QA (including clean, JSON failure handling, chunk and download), 320px/390px/1440px visual checks, Safari keyboard/accessibility verification and manual no-network audit. Keep noindex for the experimental release. Do not conflate this with full native product maturity.
