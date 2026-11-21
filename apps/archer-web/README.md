# Archer Web Lab — browser-only experimental audio clipper

**Status:** proposed functional MVP in a feature branch, **not yet released**. This is not the native Archer AU/VST engine. Do not claim parity with native Archer algorithms or publish a release CTA until the browser QA gate passes.

## What users can do

- Select or drag a local audio file. Decoded by `AudioContext.decodeAudioData`; browser codec support varies.
- Listen to an original Web Audio soft-clipping process and change **Input gain**, **Threshold** and **Blend** live.
- View an approximate source waveform (first channel only).
- Export mono or stereo 16-bit PCM WAV, source sample rate, without uploads, account, APIs, or cloud processing.

## Run locally

Serve the **website repository root**, not only this folder:

```sh
python3 -m http.server 8000
# open http://localhost:8000/apps/archer-web/
node --test apps/archer-web/dsp.test.cjs
```

No npm packages or API keys. Browser supported: recent Safari, Chrome, Firefox where Web Audio and audio decoding are available. These browsers **must** be smoke-tested before merging.

## Limits and technical design

- File size <=30 MiB; decoded <=3 minutes, <=2 channels, <=96 kHz and <=80 MiB of PCM.
- Export allocates up to 80 MiB for output and executes synchronously; large audio may temporarily pause the interface. No batch processing or normalization.
- Input gain affects processed path; Blend mixes that with the original unamplified signal.
- Native `WaveShaperNode` preview and the hand-encoded PCM WAV use a matching normalized tanh soft-clip mathematical curve. Minor differences in Web Audio interpolation/playback can occur; extreme settings distort by design.
- Original audio remains untouched. WAV encoding clips any sample beyond full scale; export is lossy when decoded input was lossy or float and output is 16-bit.
- No analytics, external scripts, external fonts, service worker, storage, file uploads, microphone permissions, backend or payments.

## Verification already completed (21 November 2026)

- **Node.js on macOS:** 8/8 DSP and WAV encoder tests passed; syntax checks for all JS files passed.
- **GitHub Actions for initial PR revision:** Archer Web Lab checks, public security baseline, adaptive loading safety and brand metadata passed. Later revisions require their own green CI runs.
- **Chrome headless on macOS:** exercised actual browser WAV decoding, waveform UI, gain adjustment, playback and stop; real button-triggered WAV export downloaded and inspected (mono, 44.1 kHz, 44,100 frames, 16 bits). Responsive document overflow checks passed at 320, 390, 768 and 1440 px.
- **Safari WebDriver:** blocked by existing Safari setting (Allow remote automation disabled). No browser setting was changed and this does **not** count as Safari QA.

## Release gate (remaining)

- [ ] Safari desktop: import WAV and MP3, play, adjust live, stop/restart, download and play resulting WAV.
- [x] Chrome headless macOS: import a WAV, adjust live gain, preview and stop, export/download and inspect WAV header and length, check responsive overflow.
- [ ] Chrome normal interactive desktop session and Firefox: verify codec support, audible output, downloadable results and developer console.
- [ ] Safari iOS + Chrome Android: codec-specific behavior, download flow, audio unlock on gesture, acceptable memory.
- [ ] Accessible keyboard-only operation, focus and screen reader labels; responsive widths 320/390/768/1440.
- [ ] Test bad files, huge or long audio, repeated imports/exports, failure states and source privacy with network inspection.
- [ ] Confirm no overlapping live work in `/apps/`; confirm security and legal language, brand, support, and pricing.
- [ ] Integrator approval, merge and **HTTPS deployed page check** before adding public nav/catalog links.

Roadmap: #368. Existing catalog work: #52, #173. Audio coordination: #13. Global coordination: #78. Legal/privacy: #140.

## Live source correction — gh-pages (21 Nov 2026)

The live Unfire site deploys from **gh-pages**, not main. Original draft PR #369 targets main and must not be used for deployment. This new candidate ports the existing verified browser-only algorithm to gh-pages without touching native Archer, the Unfire Audio game, the app catalog, existing downloads or commerce. The page has noindex,nofollow until separate product release review, actual HTTPS verification and an honest usability check. Web Audio encoding remains browser-specific (not the native JUCE DSP).
