# Y2K Robots · media rights evidence triage (4 November 2026)

**Legal status: NOT CLEARED.** Read-only source and provenance analysis. Do not interpret this report, a passing workflow, the existence of credits or a contributor's PR claim as approval for commercial redistribution. No asset or engine alteration is part of this audit.

## Source snapshot

- Examined public GitHub `main` as of `b9aa7bf7bb51e17e467586793d33db3ee4056ad3`, recursive Git tree `truncated=false`.
- Previously recorded 583 assets in 24 October audit #140. That was a subset of an earlier tree, **not** a full November inventory.
- New local private CSV from current tree: `~/Desktop/Unfire/Coordination/Y2K_ROBOTS_FULL_AUDIO_TREE_RIGHTS_2026-11-04.csv`, with **17,210** media resources in `audio/**`: **16,960 audio, 228 images, 12 videos and 10 font files**. This counts broader Audio website/store media, not just game resources; no inference that each file is served at runtime.
- In `audio/maletin/**`: **16,903** media files: 16,898 audio and 5 fonts. Within `audio/maletin/vox/**`: **16,692** recorded character-voice clips (11,532 es, 5,160 en). Within `audio/maletin/samples/**`: **206** instrumental samples. The engine can also generate procedural 3D shapes and media references; file-extension counting does not cover those.
- The `const SAMPLES` inline JSON in `audio/maletin/index.html` maps **206** sample file paths; **69** have a nonempty in-code `src` provenance string, **137** lack one in this particular map. A `src` claim is not permission evidence.

## Primary-source matches worth examining · do not overstate

### Spanish speech
- Merged PR [#198](https://github.com/ondmindmanagement-hub/unfire-website/pull/198) (27 Oct) explicitly claims to replace macOS system voices with **Piper** `es_ES` voices `davefx` (CC0), `sharvard` (CC BY 3.0), `carlfm` (public domain), with 11 character voices. Merged PR [#196](https://github.com/ondmindmanagement-hub/unfire-website/pull/196) added many of the clips. File histories provide provenance clues but not an attested record of generation settings and exactly which model created which output.
- Original Piper voice model cards actually state:
  - [davefx](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_ES/davefx/medium/MODEL_CARD): dataset CC0; fine-tuned from another model. Verify model-chain rights and proper distribution.
  - [sharvard](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_ES/sharvard/medium/MODEL_CARD): source dataset CC BY 3.0; **attribution and licence link must be preserved where required**, confirm license consistency of model and derived recordings.
  - [carlfm](https://huggingface.co/rhasspy/piper-voices/blob/main/es/es_ES/carlfm/x_low/MODEL_CARD): dataset public domain.
- The current `audio/media-credits.html` mentions Piper and the three voices including attribution to the sharvard corpus. That is useful evidence of attribution efforts, not definitive compliance or file-level identification.

### English speech
- Merged PR [#181](https://github.com/ondmindmanagement-hub/unfire-website/pull/181) states English and some Spanish pre-recorded voices were made with Kokoro. [Kokoro-82M model card](https://huggingface.co/hexgrad/Kokoro-82M) states **Apache-2.0** for model weights. The model card also discusses dependencies with other licenses. The specific generation process, voicepacks and precise outputs per file remain to be proven. Some later Spanish clips were replaced by Piper.
- The repo also contains `scripts/generate-unfire-voices*.py` using `edge_tts` (Microsoft Edge read-aloud TTS), producing `audio/masters` in the source code. **Those scripts are not proof that the current `vox/**` clips were produced by Edge TTS.** Library `edge-tts` is LGPLv3 for much of its own source; that is **not** a standalone rights grant for commercially distributing Microsoft-service voice recordings. No Edge-service output redistribution permission has been documented. Keep any clip with that provenance **BLOCKED** pending a primary license/contract or regeneration with an adequately licensed alternative.
  - [edge-tts software license](https://github.com/rany2/edge-tts/blob/master/LICENSE)
  - [Microsoft services terms](https://www.microsoft.com/servicesagreement)

### Other media
- `audio/maletin/index.html` includes SAMPLES mapping and `audio/maletin/samples/**` contains 206 mp3 files. Prior audits cite VCSL CC0 and Virtuosity Drums CC0; source-field claims exist for only some. Need mapping from each resulting mp3 to its original source file and permitted packaging, plus sha/version.
- Existing `audio/media/credits.json` and `audio/media-credits.html` include photographic / video acknowledgements, some with CC BY or CC BY-SA terms. Need verify source URLs, modifications, attribution placement, and any ShareAlike obligations relevant to the exact use (do not assume CC BY-SA applies to entire game).
- Fonts in `audio/maletin/fonts/`: Audiowide, Michroma, Orbitron, ShareTechMono, VT323. Verify embedded licence texts and exact redistributed files, not merely family-level claims.
- Use `audio/vendor/three/LICENSE.txt` as starting point for third-party JS library rights; identify any other libraries and CDN service dependencies.

## Exact outstanding release gates
- [ ] Link each publicly served/bundled asset to `source URL + version/revision + owner + license text/evidence + rights for redistribution within game + attribution + assigned reviewer + record date`. Store private receipts securely off public GitHub.
- [ ] Crosswalk 16,692 voice files to generator/model name and revision or reproducible generation job logs. Document 11 actor-to-model slots. Confirm the Piper/Kokoro outputs not legacy macOS/Edge TTS replacements.
- [ ] Where CC BY applies, test the actual public legal/credits route **inside** supported in-app editions and accessibility settings.
- [ ] Verify 206 samples against VCSL/Virtuosity specific original file IDs and any other original sources. Confirm original download licensing.
- [ ] Map the images, video, fonts and JS dependencies actually loaded by the shipping game, browser, App Store and other packages. Identify rights and distribution notices per build.
- [ ] Resolve copyright/brand clearance for characters and original art, any creator/commission agreements, and third-party logos and marks.
- [ ] Complete game-specific T&C/EULA and actual discoverability via Options, privacy consent and moderation gates. **PR #289 contains only draft pages.**
- [ ] Conduct qualified legal verification in relevant territories before asserting full compliance; no store submission should be represented as legally cleared until proof exists.

## Local inventory caveats
The local 17,210-row manifest is private to the authorized Mac and references public Git blob SHA per file. Its `candidate_origin_from_repo_only` field is deliberately **not evidence of rights**. Every media item remains `commercial_distribution_verified=NO` until individually or in a reproducibly identified, proven group cleared. A group-level grant may legally apply to many derivative outputs, but the mapping and conditions must be demonstrable.

**Coordination:** #140 owns legal/IP audit; #13 owns game runtime; #78 global; #289 is separate draft legal documentation. Do not modify or deploy current game, existing license/privacy pages, payment gates, or other owners' branches in this task.

## Verified font license metadata and notices · 4 November 2026

This is a **narrow, reproducible source-license verification** for five bundled `.ttf` files, not clearance for the complete game or even for every font used elsewhere on the broader Audio website.

The exact bytes of each `audio/maletin/fonts/*.ttf` were retrieved from GitHub `main`, their OpenType `name` table copyright and license metadata inspected (name IDs 0 and 13/14), and Git blob SHA-1 computed. Each declares **SIL Open Font License 1.1**. The corresponding original Google Fonts `ofl/<family>/OFL.txt` full license notices were copied **verbatim** to `audio/maletin/fonts/LICENSES/` on legal PR #289. The new game license links directly to each notice. The font binaries were not altered.

| Exact game file | Git blob SHA-1 | Original copyright notice / license source |
| --- | --- | --- |
| `Audiowide.ttf` | `8b50bedc0f99bcfcb5686a3dbeb5b51d1c0190d5` | Brian J. Bonislawsky (Astigmatic), OFL 1.1 · `google/fonts/ofl/audiowide/OFL.txt` |
| `Michroma.ttf` | `59e8c534349962143f45b48152f80524fe9045bc` | Michroma Project Authors, OFL 1.1 · `google/fonts/ofl/michroma/OFL.txt` |
| `Orbitron.ttf` | `1fc54ce7116a6ec549f37358466bcc92f9a72c33` | Orbitron Project Authors, reserved name, OFL 1.1 · `google/fonts/ofl/orbitron/OFL.txt` |
| `ShareTechMono.ttf` | `1611474a4cc94c3cb51664597cae92a6f3c68857` | Carrois Type Design / Ralph du Carrois, reserved name 'Share', OFL 1.1 · `google/fonts/ofl/sharetechmono/OFL.txt` |
| `VT323.ttf` | `afa69098f15bf64849d397f133d9467486904053` | VT323 Project Authors, OFL 1.1 · `google/fonts/ofl/vt323/OFL.txt` |

The license permits bundling with commercial software if copyright and license requirements are met. Source: https://openfontlicense.org/how-to-use-ofl-fonts and https://openfontlicense.org/ofl-faq/ . All five notice files have original copyright lines plus the complete OFL 1.1 body. **The installed app bundle must still be checked to contain the required notices and accessible attribution**, not merely the website source.

### Automated non-clearance / release preflight

- New `.github/y2k-game-rights-release.json`: **10 P0 release checks blocked, `release_authorized=false`**. This is an intentionally conservative default, not a claim that each asset infringes.
- New `scripts/y2k-game-rights-preflight.cjs`: `--audit` validates declaration schema; `--release` fails closed unless all gates have evidence and a named review, but evidence strings alone never substitute for human/legal verification.
- New `.github/workflows/y2k-game-rights-gate.yml`: pull-request declaration and font notice QA, plus optional explicit manual release preflight. **This does not automatically prevent submission in App Store Connect, Google Play, Microsoft Store or Pages**; deployment teams must wire it into their real submission pipeline.
- Locally validated against staged PR files and exact five font binaries: **10 tests passed, zero failures**; `--audit` PASS, `--release` intentionally EXIT 1 / BLOCKED.
- The whole-product `fonts_images_video_and_dependency_notices` gate remains **BLOCKED** until all resources, exact installed build and third-party permissions are audited.

