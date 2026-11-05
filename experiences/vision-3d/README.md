# Unfire · An Interactive Vision (experimental)

Independent Technology & R&D Initiative · Catalonia, Spain · 2026

## Purpose
Isolated, English-language, cinematic scroll presentation about the Unfire R&D direction. This is **a vision/prototype**, not evidence that integrated systems, enterprise features, or institutional partnerships have shipped. Unfire is not represented as an incorporated company or accredited research institute.

## Path and isolation
- Entry: `experiences/vision-3d/index.html`
- No changes to the repository root homepage, game, app artifacts, styles, legal documents or releases.
- This route is not linked from the corporate homepage and will not deploy to the public site until the PR has been reviewed and merged by the assigned website integrator.
- Original source: internally reviewed `Unfire_3D_Vision_Package/index.html` version 2 (3 November 2026).

## Interactive behavior
- Cursor-controlled perspective, five scroll-driven shape transformations, chapter navigation and contact closing section.
- WebGL GPU scene where available; Canvas projected-3D fallback and non-WebGL backdrop.
- Responsive layout, visible focus outlines, skip link, labels and reduced-motion support; Motion toggle.
- No external fonts, CDN scripts, analytics, third-party images, API calls, online payments or stored visitor data.

## QA status · 3 November 2026
- **PASS**: HTML structure parsed; six sections (including Contact), anchor/contact links inspected and Node `--check` passed on inline JavaScript.
- **PASS**: static source inspection for network loading and external libraries; all assets inline.
- **BLOCKED**: a fresh desktop/mobile Playwright run in this isolated container; Chromium rejects both local `file://` and local HTTP navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. This is an environment restriction, not a passing browser test. Earlier prototype smoke checks were reported, but are not a substitute for current browser/device validation.
- **NOT RUN**: real Safari/Chrome, phone and keyboard/assistive technology audits; steady-state FPS/power/memory; WebGL context loss and recovery on real devices.

## Release gates
1. Perform real Safari/Chrome and mobile orientation/low-power QA and capture screenshots.
2. Inspect accessibility, reduce-motion, keyboard, focus order and fallback with WebGL disabled.
3. Review all public statements and links, check privacy/legal/brand fit.
4. Coordinate release with #78 and #281; only the website release owner may approve merge/deployment.
5. Verify resulting Pages URL after release, then consider an unobtrusive homepage link (separate PR, homepage owner coordination).

**Status:** draft PR, experimental. Do not merge or advertise as published without clearing gates.
