# Unfire web ecosystem — architecture, zero-cost scope and release plan
**Baseline:** 2026-11-21 · **Status:** design/review plan, not proof of deployment or store approval.

## 1. One origin, distinct experiences

Use `https://unfire.technology/` as the only required domain. Keep the existing GitHub Pages hosting and canonical route structure: individual static directories behave like independent product websites while remaining part of one domain. Avoid new domains, paid builders, tracking vendors, forms, VPS or DNS changes. This gives a coherent brand and shared search signals, but a dedicated URL alone **does not guarantee SEO rankings**.

- Corporate website: `/`, `/about/`, `/contact/`, `/research/`, `/public-record/`, `/pilot/`.
- Application catalogue: `/apps/` (existing), with one **canonical product landing** per genuinely distinct app.
- Existing native app landings: `/bolt/`, `/archer/`, `/apps/power/`, `/apps/bolt-mobile/`, `/apps/archer-mobile/`, `/apps/pocket-capture/`, `/apps/unfire-control/`.
- Current app-specific routes: `/autonomy/`, `/signals/`, `/portable-synth/beta/` (actual Android beta entry).
- New proposals in PR #373: `/portable-synth/` (product overview), `/portable-synth/play/` (small playable web synth **not** Android app parity), `/games/y2k-robots/` (dedicated game project page).
- Games portal: `/games/` (existing). Actual browser beta currently lives under `/audio/`; this is **not** the audio store. Preserve the engine and avoid publishing unverified naming/Steam status. Game coordination: #13 and draft identity PR #260.
- Existing Audio commerce: `/audio/tienda/`; do not reclassify the entire `/audio/` route as a shop.
- `/games/gods-lamp/` is a **candidate future page**, not created here; require verified game identity, actual capture, rights and current release status first.
- Keep private/prototype/internal systems out of search until explicitly suitable for public disclosure.

## 2. Landing page vs browser app

A landing page is not a browser-compatible software port. Static GitHub Pages can host local HTML/CSS/JS/WebAssembly, but does not supply authenticated backend execution, a trusted OS agent or unlimited external API access.

| Product | Existing web presence | No-cost browser functionality | Honest next step |
| --- | --- | --- | --- |
| Portable Synth Daw | Android beta + new overview | Initial local Web Audio note player at `/portable-synth/play/` | Test Safari + touch/keyboard, then scope sequencing/WAV export as a **separate** web edition |
| Y2K ROBOTS / robot-world game | `/audio/`, `/games/` | Existing browser beta | Validate game identity, mobile performance, web/desktop version claims; do not equate beta with Steam native build |
| Archer | `/archer/`, store listing | Potential local audio preview via Web Audio/AudioWorklet | Establish DSP rights, accurate native-vs-web differences and real audio QA |
| Power | `/apps/power/`, store listing | Potential manual-input energy calculator | Avoid claiming real-time electricity prices without a verified, rights-cleared feed |
| Bolt | `/bolt/`, `/autonomy/` | Safe synthetic workflow simulation | Browser cannot directly control macOS or privileged files; local companion requires separate security architecture |
| Unfire Control | `/apps/unfire-control/` | Permission-based in-page camera demo could be feasible | Browser is not permitted to control the OS like the native Mac app |
| Pocket Capture | `/apps/pocket-capture/` | Permission-based local media capture is technically plausible | Check Safari MediaRecorder/WAV compatibility, device support and privacy |
| God's Lamp | Native development context; no verified game landing | Not established | Verify current build, authentic captures and browser feasibility before any new launch claim |

Do not use `Available now`, `Download`, `Steam` purchase URLs, review scores, price or feature claims without current first-party evidence. Separate released, beta, research and proposed functions visually.

## 3. Page system

Each public product page needs: exact approved product name, clear user problem, target platform, truthful build/availability label, 1 primary action, genuine app captures when the presentation gate requires them, a concise feature story, support/contact, privacy and legal links, canonical and Open Graph metadata, suitable structured data, keyboard-accessible mobile design, and a return path to the parent catalogue. All public copy remains English under AGENTS.md. Use the shared static stylesheet as a **template**, but do not forcibly redesign approved existing pages.

## 4. SEO and discoverability checklist

1. Each approved route must return HTTP 200 under HTTPS; redirects should not enter the sitemap as separate competing canonicals.
2. Unique visible `<title>`, descriptions, one H1, semantic headings, meaningful HTML text even without JS, clean human-readable URL and matching canonical.
3. XML sitemap includes only intended canonical indexable routes; keep robots.txt discovery and block sensitive/checkout-only pages where appropriate.
4. Cross-link from high-visibility hubs (`/`, `/apps/`, `/games/`, `/audio/tienda/`) to approved products. Coordinate the existing `apps/index.html` owner and open visual PR #230 before editing.
5. Real images: device/build metadata and licensing; compressed sizes, width/height, descriptive alt, avoid fabricated screenshots. Add social preview image if ownership is verified.
6. A distinct support/FAQ, compatible versions, change history and useful documentation for each **real** product. Avoid thin/duplicate pages created solely to target search terms.
7. Validate with Google Search Console and Bing Webmaster Tools free properties where possible. DNS/HTML ownership verification and actual sitemap submission have **not** been done in PR #373.
8. Track indexed pages, relevant queries, clicks and real email/store visits using aggregate free search tools. Do not turn on analytics cookies, remote tracking or user-profiling scripts silently.
9. Keep performance budget light: no external font packages, autoplay media, heavy 3D in a landing page or huge dependencies. Separate interactive game launch from search landing.
10. Check structured data against Google requirements; a schema field does not automatically create a rich result or improve rankings.

## 5. Publication gates and order

**Stage A — now (PR #373, review only):** new dedicated pages, one limited browser synth experiment, links from non-overlapping existing hubs, canonical sitemap updates, static CI. No product-store or checkout changes.

**Stage B — gate before merge:** all CI green, check responsive layouts in Safari/macOS and real supported mobile devices, verify the Y2K public identity against #13/#260, game image rights, genuine native app captures where required by #215; resolve conflicting copy with existing `/games/` UNFIRE Mutants branding. A single authorized web release integrator merges and verifies all requested HTTPS routes. If screenshots or identity cannot be verified, keep PR draft.

**Stage C — discovery:** link approved microsites prominently from catalogue and corporate homepage without overwriting PR #230, validate canonical and sitemap submission, create targeted FAQ/how-to/press assets grounded in real functionality, and share verifiable pages with relevant written-only partners/media.

**Stage D — expansion:** scope only commercially or technically justified web apps one by one, preserving local privacy and zero infrastructure cost. Avoid cloning the entire native catalogue with false feature parity. Actual paid B2B work still depends on signed scope, buyer eligibility and appropriate fiscal/legal status.

## 6. Controls and references

- Global work and English-only: #78, AGENTS.md.
- Product catalogue: #173 (closed, historical scope). Open presentation change: PR #230; avoid `apps/index.html` collisions.
- Game identity/engine: #13, PR #260 and other open game PRs.
- Authentic screenshots and Apple release boundaries: #215.
- Legal/privacy review: #140 where applicable.
- This work: **PR #373**; no evidence of live deployment until a separate release verification.

**Principle:** fewer strong, distinct product pages and demonstrable user journeys beat dozens of premature thin pages.