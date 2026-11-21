# Privacy Lens Web Lab — Unfire

Status: experimental, browser-only utility. Independent of UnfireSuite's native metadata module. No claim of parity with a native app.

It checks text for **six selected categories**: possible access tokens, mod97-valid IBANs, checksum-valid Spanish DNI/NIE, emails, Spanish-format telephone numbers, and IPv4 addresses. The checks are deterministic regular expressions, **not an AI model** and not an exhaustive privacy scanner. It redacts matched values with named placeholders and shows only category counts. All sensitive-text examples in tests are artificial fixtures.

Security and privacy: script and styling self-hosted; no network requests, third-party packages, analytics, localStorage, cookies, server processing or accounts. CSP includes `connect-src 'none'`. User must click Analyze, Copy or Export. A Clear button wipes the form and current in-memory result; it cannot purge system clipboard, browser history or backups. Do not log real input.

Inputs: pasted plain text, or a local UTF-8 TXT/MD/CSV/JSON file no larger than 512 KiB. Text maximum 200,000 characters. Other formats (DOCX, PDF, images) are explicitly unsupported. Files are read locally with FileReader.

Release gates:
1. Node unit tests and static privacy checks.
2. Chromium and WebKit end-to-end test using **only synthetic data** (imports, categories, redaction, download, clear, responsive widths).
3. Manual Safari desktop and VoiceOver validation.
4. Explicitly review all outputs: false negatives and false positives are expected.
5. Do not publish a link from the official catalogue until this branch is reviewed and merged to `gh-pages`; keep `noindex,nofollow` for the experiment.
