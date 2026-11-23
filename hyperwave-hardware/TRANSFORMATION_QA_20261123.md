# Hyperwave 2000 · transformation and camera QA · 2026-11-23

## Scope and source integrity
- The embedded Atelier and the full-screen interactive model share the original playable WebGL instrument in `audio/hyperwave/index.html`. Material customization and instrument controls remain unchanged.
- The six-movement theatre uses a **new actual WebGL capture**: `media/hyperwave-2000-transformation-50fps.mp4`. Its 240 individually rendered frames (1280 × 720, 50 fps, 4.8 s) form a continuous, silent, all-intra H.264 sequence, approximately 4.54 MB.
- This is **digital concept visualisation**, not physical prototype footage or production verification. The original 49 WebP frames are retained only for fallback and reduced-motion static presentation.
- Regeneration script: `tools/build-theatre-video.cjs`, requiring local Chrome, `puppeteer-core`, a local HTTP server and `ffmpeg`. The pipeline invokes the instrument's real `window.__hw.renderAt()` hook for every frame. No generated, imagined or interpolated imagery is substituted.

## Behaviour
- A camera fit based on the changing model bounding sphere adapts automatically to its open/closed stages and frame aspect ratio. The Atelier zoom limits scale with the object, instead of fixed, too-close camera distances; default framing and Fit View recenter after user orbit/pan/zoom.
- The six-movement theatre can be scrolled forward and backward with fine frame-accurate video seeking. A Play/Pause control starts the full continuous sequence from the beginning; manual Pause/Resume holds the precise frame. Optional 0.75× playback is deliberate mild slow motion.
- Dedicated zoom-in, zoom-out, Fit and Expand controls are provided in the theatre, the interactive Atelier and the separate 26-second trailer dialog. Ordinary scroll continues navigating the theatre; Shift/Control + wheel or two-finger pinch zooms its picture. The source video never changes the physical-prototype status wording.
- The modal Atelier uses available screen height, with a dedicated scrollable finish panel on desktop and stacked viewer/options on narrow screens. The shorter theatre scroll distance avoids excessively long navigation.

## Verified tests (local)
- **Browser:** headless Chrome on macOS, tested viewport sizes **1440 × 900** and **390 × 844**, 2026-11-23.
- **Media:** `ffprobe` confirms **240/240 keyframes**, **50 fps**, **1280 × 720**, **4.8 s**; video size **4,540,227 bytes**.
- **Seeking:** range-capable local HTTP server returned **206 Partial Content**. Scroll positions 3%, 24%, 48%, 70%, 95% produced matching video timestamps and chapter highlights; observed seek error after settling was within a single video frame. Both desktop and mobile had no horizontal overflow.
- **Camera:** projected bounds of the real WebGL model were checked at T = 0, 0.4, 1, 2, 2.8, 3, 3.6, 4 with candidate zoom factors. Captured camera at 0.72× kept those stages within image bounds. Screenshots of the closed, open and fully deployed stages were visually examined.
- **Controls:** Play from 95% scroll starts at 0, Pause freezes the current frame, Resume continues from it; 0.75× rate, Zoom in, Fit, film dialogue controls and Close were exercised. Embedded Atelier dialog displayed at desktop size and expanded to the viewport.
- **Deployment target:** GitHub Pages responded to `Range: bytes=0-128` with **206 Partial Content** for the existing Hyperwave trailer, confirming byte-range support (required for scrubbing).

## Not verified / release gate
- Manual tests on physical iPhone/iPad and Safari interaction/accessibility have **not** been performed. CSS and JavaScript include Safari-compatible fallbacks, but this is not equivalent to a real-device acceptance run.
- No production deployment, Apple submission, hardware manufacturing or purchase flow is implied by these local tests. The release integrator should verify the deployed asset, title, poster, expected load/seek behaviour and the homepage modal after merging.
- This change does **not** alter the proposed physical manufacturing claims, commission wording, costs, warranties or legal disclosures.

## Front-facing expansion refinement (same PR, 23 Nov)
- Opening the embedded Atelier now triggers the actual 3D model's **Hyper/fully deployed** transition automatically and selects the matching form button. No manual rotate or extra button is necessary to see both extended pods, canopy, keyboard and controls.
- The camera starts at a front-biased three-quarter view (0.15 rad yaw) and re-fits the real model bounds continuously as its geometry expands, keeping a safe margin around **both** speaker pods. The full instrument is centered on initial paint, not just after the animation starts.
- Choosing a different stage automatically returns to this centered presentation angle; manual orbit, pan and zoom still work. The Fit view button returns to complete view after exploration. The small-screen help/status text was moved below the top controls to remove an overlap.
- Repeated automated Chrome checks at **1440 × 900** and **390 × 844** recorded 12 separate positions along opening, including early, middle and speaker-extension phases: the projected 3D model stayed inside the viewport at all observed checkpoints. Initial mobile state now begins within frame instead of briefly exceeding its left boundary. Close/reopen and Fit recenter were also exercised, and final desktop/mobile full-extension screenshots were inspected.
- As before, real Safari/device acceptance is not claimed and deployment remains under the release gate.
