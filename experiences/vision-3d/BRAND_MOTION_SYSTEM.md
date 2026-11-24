# Unfire · Procedural Motion Language
**Status:** visual research system, not a public website release. **Owner:** Unfire Vision 3D · issue #281 · draft PR #282.

## Positioning
Unfire's visual identity should express **continuity, calm control and discovery**. The experience is not a slide transition, a game or an attempt to compel a visitor to stay. It is a quiet signature that makes advanced technology feel intuitive while leaving reading, navigation and exit fully under the visitor's control.

**Visual motto:** *One continuous direction. Infinite forms.*

## Core grammar
1. **Organic procedural form.** Construct geometry in code from parametric coordinates and deterministic seeded variation. No prerendered asset falsely called procedural. Each chapter can change the mathematical surface: seed torus, woven connectivity, bounded shell, modular superellipse and opening bloom. Interpolate vertices in the **same U/V lattice** for seamless topology changes. Distinct chapters remain recognizable without flipping the camera.
2. **Stable visual axis.** No 90° camera turns, snap rotations or sudden reversals. Cursor motion is a micro-tilt, capped at approximately 5° horizontal / 4° vertical. The scene advances through morphology and depth rather than disorienting rotations.
3. **Subtle first, cinematic only when invited.** Static editorial content always remains readable without the animation. The homepage's primary call-to-action and navigation must never depend on the canvas. A larger immersive journey is opt-in.
4. **Fixed tempo / smooth response.** Hover lift 1–3 px / 180–260 ms; background depth offset 3–8 px; scroll-linked transformation eased, never scroll-jacking; opacity reveals restrained and reversible. No fake progress indicators.
5. **Signature palette.** Near-black surfaces, ivory text, restrained mineral mint, thin technical curves, generous negative space. Never place essential information inside the visual form.

## Planned rollout (none deployed)
| Area | Motion | Requirement |
|---|---|---|
| Global navigation | 1 px underline/opacity transition | Plain and quick with keyboard focus |
| Homepage hero | Low-opacity ambient mesh responding gently to cursor | Offscreen pause, reduced-motion static, no heavy preload |
| Work/product gallery | Small depth and edge-light response on hover | Cards and links remain obvious without motion |
| Sections and page transitions | Short fade/translate (6–12 px) | No hijacked scroll or obligatory intro |
| Immersive Vision route | Full procedural morph across five chapters | Separate optional destination, accessible fallback |
| Footer | Still or extremely low-motion motif | Clear contact/address; no obstructive overlays |

## Accessibility / user agency
- Honor `prefers-reduced-motion` and provide an always-visible motion toggle on immersive pages.
- No automatically playing sound, flashing content, forced timed sequence, hidden exits, false scarcity, addictive loops or casino-style engagement tricks.
- Keyboard navigation and conventional scroll always work; touch must not require hover; focus visible; headings semantic; WCAG contrast reviewed.
- Keep a completely usable DOM path with canvas/JavaScript unavailable.

## Engineering and QA gates
- **Prototype:** standalone self-contained HTML/CSS/Canvas2D; no external dependencies, cookies, analytics or WebGL requirement.
- **Runtime:** calculate parametric geometry only for the visible region, throttle/reduce work on mobile, stop frame work when tab hidden/offscreen, bound DPR and line count; use batched strokes for canvas performance.
- **Target, not measured:** smooth, sustained interaction on mid-range phones and older Macs with no perceptible scroll lag; device FPS, CPU and energy must be measured before publishing. No unsubstantiated 60 FPS claim.
- **Release:** stage new component in its own branch, review side by side against current site, check current page code owners, obtain QA on Safari/Chrome and real iOS/Android. Only then consider a separate homepage integration PR.
- **Safe fallback:** if context allocation fails, show static editorial content, not an empty blank screen.
- **Privacy, legal and claims:** public copy must still say independent technology and R&D initiative, not incorporated firm or accredited institute; do not imply the full Unfire interconnection vision already ships.

## Preview v5 research notes (3 November 2026)
- Standalone source generated at `Unfire_Procedural_Flow_v5.html` in the conversation workspace (not in this GitHub PR); five genuinely parametric families morph through a shared UV lattice.
- Morphing uses mathematical equations and seeded procedural variations, not a single static torus with a full orbit.
- Desktop 1280 × 760 and mobile 390 × 740 Chromium canvas smoke checks passed: five chapters, Continue navigation to 02/05, New form action, Motion on/off, no JavaScript page errors or horizontal overflow. Node `--check` passed. **Real Safari/Chrome hardware not yet tested.**
- Demo includes a 'New form' control only to show the generative system. **Do not include that control in the ambient site-wide deployment unless its UX is deliberately approved.**

## Current boundary
This document does not authorize edits to the live homepage, shared assets, apps, Audio game or merges. PR #282 remains a **DRAFT** until the designated website integrator clears release checks.
