# Hyperwave 2000 — Private showroom presentation QA
**Date:** 2026-11-15 (Europe/Madrid) | **Status:** DRAFT, NOT PUBLISHED | **Owning issue:** #329 | **PR:** #330

## Scope
- Only the existing **single Hyperwave 2000** hardware concept; no separately named product editions.
- Website presentation: `hyperwave-hardware/index.html` on isolated draft branch.
- Audio/game engine `audio/**`, corporate homepage, checkout and release settings untouched.
- Existing **real** `audio/img/hyperwave-open.webp`, `hyperwave-closed.webp` artwork reused from main, clearly labeled **digital renders**, not photography or physical devices.
- User-targeted commercial positioning **USD 120,000** from; exceptional bespoke commission budgets **USD 200,000–3,000,000**. Non-binding aspirational figures subject to final engineering quotes and buyer demand.
- No sold/reserved units, hardware completion, supplier commitment, escrow, payment facility or delivery date claimed. Inquiry is an ordinary mailto link.

## Visual and interaction design delivered
1. Full-bleed cinematic black/champagne hero with large editorial serif typographic signature and real digital Hyperwave render.
2. Interactive “Closed / Transformed” digital-asset viewer using semantic buttons and `aria-pressed`, no extra image generations.
3. Four-step scripted movement story, correctly framed as an *unvalidated physical engineering goal*.
4. One atelier offering proposed colour, textures, engraving, artistic/installation and separately scoped bespoke engineering, no fake production-ready samples.
5. Premium price story with aspirational figures but no purchase/checkout.
6. Explicit proof/status panel: digital works now; physical mechanisms/manufacturer/deadline not verified.
7. Invitation to inquire through hello@unfire.technology without tracking forms or auto-send.
8. Responsive layout, keyboard visible focus, reduced motion and print stylesheet.

## Actual QA execution (isolated local static preview)
**Method:** Chromium/Google Chrome headless via Puppeteer (one bounded browser at a time) on authorized MacBook, isolated under a private temporary QA directory (not production). Downloaded the original two render assets into the same test path. No existing application or live site overwritten. A temporary test served file-relative paths; this does **not** certify production GitHub Pages deployment.

| Browser viewport | Image load | Toggle click, return | JS page errors | Horizontal scroll | Result |
|---|---|---|---|---|---|
| 1440×900 desktop | 2/2 PASS, natural width 1200 px | PASS | 0 | none (1440/1440) | PASS |
| 390×844 mobile | 2/2 PASS | PASS | 0 | none (390/390) | PASS |
| 820×1180 tablet | 2/2 PASS | PASS | 0 | none (820/820) | PASS |

A first pass identified overflow of +5px desktop and +28px tablet due to `grid-template-columns` percentages plus gaps. Fixed using `minmax(0,fr)` columns; second browser run confirmed all three viewports with no document overflow. Overflow detection also passed at desktop/tablet. Mobile hero image is intentionally cropped by the full-bleed art direction inside a contained viewport; the document itself is not horizontally scrollable.

**Screenshots taken and visually inspected:** desktop hero and mobile hero/atelier in local temporary QA. Presentation typography, spacing, contrast and source imagery were inspected. Screenshots stay private; no new digital render is misrepresented as a physical camera capture.

## Factual and safety static checks
- [x] Single physical model and no manufactured units claimed
- [x] One headline price target (USD 120,000); bespoke budgets do not constitute new models
- [x] Original real digital demo URL linked
- [x] Correct labels on real source render art
- [x] Mailto inquiry exists (not an external send)
- [x] No payment gateway, shopping cart or stock count
- [x] `robots=noindex,nofollow` until review
- [x] No manufactured options promised, no delivery dates invented
- [x] Responsive, reduced-motion and focus CSS present
- [x] No runtime JavaScript errors in three tested Chrome viewport sizes

## Gates before owner-approved public launch
- [ ] Actual production-path smoke test on GitHub Pages, including CSP and all relative URLs
- [ ] Manual keyboard + iOS Safari and Android testing; headless Chrome is not proof of physical mobile browser coverage
- [ ] Content legal review for international luxury commisions (UK/UAE/EU/US as sold), privacy policies, trade descriptions, taxes and customer deposit protections
- [ ] External font loading privacy/license review: site currently requests Google Fonts for Italiana and DM Sans; local screenshot QA did not certify compliant consent/third-party transfers. Replace with approved hosted fonts if required.
- [ ] Independent brand/signoff and factual engineering approval for future physical specs
- [ ] Owner approval of publishing numeric aspirational targets as an offer disclaimer, especially when prospects are contacted
- [ ] No paid reservation until real manufacturer/prototype contract, credible timing and legally compliant refund/escrow protections exist

**Release decision: KEEP PR #330 DRAFT AND UNMERGED pending gates. Do not claim page is deployed, live, searchable or production verified.**
