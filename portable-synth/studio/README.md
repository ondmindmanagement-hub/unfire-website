# Portable Synth Sequencer Lab — browser proof of concept

**Status:** functional experimental code in an isolated feature branch, **not published**. This is not a complete Portable Synth Daw port, not the existing /portable-synth/play/ browser keyboard, and not the Android closed beta.

All edits are confined to the new portable-synth/studio/ path plus a dedicated CI workflow. This preserves merged PR #374, which owns /portable-synth/, the browser sound demo, game microsites, and SEO. Production navigation, game engines, audio store, native apps, payments and user accounts are unchanged.

## Functional scope

- Four original procedural voices: kick, snare, hi-hat and pitched oscillator synth.
- 16 steps per voice; adjustable 50–200 BPM / 0–45% swing.
- Editable keyboard-accessible grid with aria-pressed, semantic labels and selectable synth MIDI notes 36–72.
- Four synth oscillator shapes and master volume.
- Continuous live Web Audio transport with lookahead scheduling; stops on tab blur/hide and on tempo/swing changes.
- Restore example, clear, randomize, download and load validated local JSON patterns.
- OfflineAudioContext rendering to genuine 16-bit stereo WAV, selectable 1, 2 or 4 bars.
- No server processing, uploaded audio, samples, external JS/fonts, API keys, analytics, accounts, cookies, localStorage or microphone capture.
- Explicit experimental positioning and noindex until authorized release review; only the already-published keyboard is indexable.

## Run locally

From the website repository root, launch a temporary static web server:

    python3 -m http.server 8000

Then open http://localhost:8000/portable-synth/studio/

Execute unit and syntax checks:

    node --test portable-synth/studio/engine.test.cjs
    node --check portable-synth/studio/engine.js
    node --check portable-synth/studio/audio.js
    node --check portable-synth/studio/app.js

No npm packages or API keys are required. Only current free static hosting resources are proposed; provider bandwidth and usage limits still apply.

## Technical limitations

- This is a **step sequencer, not a full DAW**. It has no multitrack audio recording, piano-roll editing, MIDI device support, external plugin hosting, audio sample import or cloud collaboration.
- Web Audio playback can be affected by device load and browser background throttling. Audio starts on deliberate user interaction.
- Offline WAV rendering is bounded to 4 bars, 44.1 kHz, stereo PCM16; values outside PCM range are safely clamped.
- JSON imports are capped at 16 KiB and strictly validate track arrays, MIDI note range, tempo, swing and oscillator type. Unknown fields are discarded.
- Pending audio startup and stale asynchronous file imports are cancelled. Transport stops and audio context cleanup prevent accumulated background playback.
- A limiter helps control output, but users should audition at comfortable volume. No blanket audio safety guarantee is claimed.

## Verified on 21 November 2026

- 12 of 12 Node engine tests passed after a correction to the asynchronous rejection test, with JS syntax checks clean.
- Chrome headless, isolated temporary profile on the Mac: validated 64 buttons, edited drum and synth steps, changed tempo, started and stopped Web Audio, downloaded and reloaded an edited JSON pattern, and downloaded a non-silent 44.1 kHz 16-bit stereo WAV (192,760 frames). Responsive no-overflow checks passed at 320, 390, 768, 1024 and 1440 CSS pixels, with horizontal grid scroll inside the container.
- After the async race fix, the complete 16-test Node suite passed on the latest code. A second isolated Chrome smoke test proved that interrupted AudioContext.resume cannot restart stopped audio, playback recovers correctly, and an older delayed JSON import cannot overwrite a newer pattern. Remaining Safari/mobile release checks are still required.

## Release gates (not yet passed in full)

- Latest-head CI and browser smoke checks after final code changes.
- Manual Safari macOS and Safari iOS playback, WebKit OfflineAudioContext and download flow.
- Firefox desktop, Chrome Android, keyboard-only and screen-reader checks, touch usability and audio quality.
- Ownership/merge coordination with PR #374, roadmap #368, legal/privacy #140 and global integration #78.
- Decide whether to integrate as an expanded /portable-synth/play/ or distinct /portable-synth/studio/ after PR #374 is merged.
- Explicit integrator release approval; then verify live HTTPS route before changing navigation, sitemap, indexability or product claims.

**Do not add a public CTA or merge from this isolated experiment without those release gates.**

## Production branch correction (21 November 2026)

Earlier draft PR #376 was developed from main before it was verified that the live website is deployed from gh-pages. This gh-pages adaptation is the intended release candidate, with the same verified processing engine, clear browser-mode navigation, and new WebKit/Chromium release tests. Do not merge the old main-based branch or resurrect closed superseded #373. The current Android Direct v1.0.5 page and download metadata are preserved unchanged.
