# Hyperwave 2000 — Session log: cinematic presentation, atelier, dossier, film (2026-11-15, 18:30–19:30 Europe/Madrid)

**Branch:** `feature/hyperwave-hardware-interest-20261115` (PR #330, draft) · **Issue:** #329
**Working copy:** isolated clone `~/Developer/UnfireLocal/HyperwaveAtelier-20261115` (no other clone or project touched).
**Coordination checked first:** AGENTS.md (English-only, authentic-capture gate), README/feasibility/market/QA docs on the branch, PR #330 and issue #329 comments (no STOP, no newer commits on the remote branch).

## Files changed / added
| Path | Change |
|---|---|
| `hyperwave-hardware/index.html` | Rebuilt presentation: cinematic hero, six-movement scroll theatre (49 real frames), film dialog, detail gallery, **live 3D atelier** (real model in a same-origin iframe, materials recoloured in-browser, original file untouched), commission brief → `mailto`, engineering systems, commission process, status, enquiry. Google Fonts removed (system Didot/Avenir stacks, no third-party requests). `noindex,nofollow` kept. |
| `hyperwave-hardware/media/` (4.3 MB) | Authentic captures of the digital instrument: hero, details, closed/open stills, 49-frame sequence `seq/t00–t48.webp`, 4 finish studies, film poster, 26.5 s film MP4 (2.0 MB, 720p). |
| `hyperwave-hardware/tools/*.cjs, *.sh` | Reproducible capture, film, media, dossier render and QA scripts (Chrome via puppeteer-core; WebKit via playwright-core). |
| `hyperwave-hardware/dossier/dossier.html` | Source of the 11-page English dossier. |
| `hyperwave-hardware/MANUFACTURING_PLAN_20261115.md` | Movement-by-movement mechanism map, separated cost blocks, unit economics, repricing logic, milestones. |
| `hyperwave-hardware/COMMERCIAL_STRATEGY_20261115.md` | Second-wave channels, video note, Arabic caveat. |
| `audio/**` | **Not modified.** |

**Kept outside the repo** (`~/Developer/UnfireLocal/HW-capture-20261115/deliverables/`): `Hyperwave-2000-Private-Commission-Dossier.pdf` (11 pages, 10.8 MB) and the 1080p film master — the repo deploys to a public site and the PDF is for private distribution.

## Authenticity
- All imagery comes from the unmodified `audio/hyperwave/index.html` via its own `window.__hw.renderAt(T, az, el, zoom, ty)` hook in headless Chrome (Metal/ANGLE). Only 2D text overlays (brand/hint/help) were hidden; crops, scaling, a mild vignette and typography overlays are the only treatments.
- Every image and the film carry "Digital concept visualisation"; finish studies carry "Digital finish study". No claim of physical hardware, sound recordings of motors, sales, stock or delivery dates.

## Tests run
| Test | Result |
|---|---|
| Chrome headless, 1440×900, 390×844 (iPhone UA, touch, DPR 3), 820×1180, 1920×1080 | 0 JS errors, 0 failed requests, 0 px horizontal overflow, 13/13 images, theatre frames/chapters advance correctly, film dialog plays (26.5 s, 1280 px), atelier goes live and recolours, brief/mailto generated |
| WebKit (playwright 1.49, iPhone 13 emulation) | 0 errors, no overflow, theatre scrubs, atelier live with real click, `<dialog>` supported |
| Dossier render | 11 pages, no content overflow, every page visually inspected |
| Visual review of screenshots | Desktop and iPhone inspected; fixes applied (hero title stacking, theatre label overlap, mobile atelier status, page-4 caption contrast) |

**Real defect found and fixed:** the invisible iframe covered the "Enter the live atelier" button, so real taps could not start the atelier (JS-click tests had masked it). WebKit real-click test exposed it; fixed with `visibility:hidden; pointer-events:none` until live.

## Not done / open
- Not tested on a physical iPhone/iPad or Safari desktop (emulation only). Not tested on GitHub Pages production path.
- **Gmail:** 0 replies and 0 bounces to the 10 first-wave messages. **5 new drafts created, not sent** (M.A.D.Gallery Geneva, bitforms NYC, Audio Exotics Singapore, Portier HiFi Geneva, Ideaworks Monaco) — awaiting owner review. No duplicates found in Gmail.
- No supplier quotes requested; no spend; no payments or reservations implemented.
- PR stays draft and unmerged; publication requires the release gates in `README.md`.

---

## Engineering pass (2026-11-15, 19:10–23:15) — owner: "tú eres el ingeniero"

**Changed `audio/hyperwave/index.html` on this draft branch only** (via `tools/patch-physical-model.py`) to make the transformation physically buildable: pods dock outside the body, rigid 4-stage telescopic arms, wrist inside the pod, scissor-guided lifts, no overshoot on heavy parts. Not merged, not deployed; the live site is unchanged.

| Evidence | Result |
|---|---|
| `tools/physics-audit.cjs` before → after (`engineering/physics-audit-before.json`, `-after.json`) | pods through shell 9.9 → 0 mm; floating pods 100 → 0 samples; stretching parts 6 → 0; pop-in parts 8 → 0; all other checks 0 |
| Negative control (panel raised 45 mm under closed canopy) | detectors fire: 3,998 crossings, 9,443 protruding vertices |
| `tools/smoke-instrument.cjs` | opens, plays 2 voices, HYPER, closes; 0 errors |
| `tests/*hyperwave*.test.cjs` | pass |
| `engineering/firmware/host_test.cpp` (12-axis motion core, interlocks, pinch/stall/jam/power-loss) | ALL MOTION TESTS PASSED, no compiler warnings |
| Presentation re-captured from the corrected model (hero, sequence, details, studies, film) and dossier PDF re-rendered | Chrome 4 viewports re-run; dossier 11 pages, no overflow |

New: `ENGINEERING_DESIGN_v0.1.md`, `engineering/gen_choreography.py`, `engineering/choreography.json`, `engineering/firmware/*`, `tools/physics-audit.cjs`, `tools/patch-physical-model.py`, `tools/smoke-instrument.cjs`, `tools/probe-structure.cjs`.
Owner review needed for: the 600 mm closed width (was 492 mm), and whether `audio/**` changes should go to production after the audio owner (#13) reviews them.
