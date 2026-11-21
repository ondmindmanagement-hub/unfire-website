# Unfire AI Token Counter — Browser Lab

**Status:** functional, isolated draft candidate; **not merged or publicly released**. This browser app is distinct from the independent macOS utilities tracked in #212.

## Capabilities

- Enter input/prompt and output/response text.
- Show Unicode code-point characters, approximate word counts and lines.
- Use an adjustable **characters per estimated token** heuristic (default 4, 1–12).
- Override either side with a **user-supplied exact token count** obtained from provider usage.
- Enter **manual** current rates in USD per million input/output tokens and calls per month.
- Calculate illustrated per-exchange and monthly cost. **No embedded model pricing** and no price lookup.
- Copy a summary using browser Clipboard API where available.
- Export a CSV of aggregate numeric metrics **without source text**.
- Clear both source text and assumptions immediately with Reset.

## Accuracy, honesty and local privacy

This is **not an exact tokenizer** for OpenAI/Anthropic/Gemini/etc. A codepoint-based heuristic can diverge significantly for different languages, code, emojis, special tokens, images, context, cached tokens, tools and provider billing structures. Default four characters per token is an **approximation**, not a claim of provider accuracy. Counts called **exact** are user-entered and not verified against a provider. Price inputs are user-entered, unverified, and excludes caching, taxes, tools, credits and other provider charges.

The code uses **no `fetch`, `XMLHttpRequest`, third-party JS, analytics, API keys, cookies or localStorage**. Content is computed in memory in the current browser tab. It can be sent to the operating-system clipboard **only on explicit copy**, and that summary excludes source text. CSP blocks network connections (`connect-src 'none'`). CSV exports only fixed derived metrics. The static page assets themselves are loaded from the web host, but user text is never submitted by the application.

Hard bounds: each text <=250000 UTF-16 code units, manual exact tokens <=1e9, 1–1e6 calls/month, rates 0–100000 USD/million tokens.

## Run locally

From website repo root:

```sh
python3 -m http.server 8000
# open http://localhost:8000/apps/ai-token-counter/
node --test apps/ai-token-counter/engine.test.cjs
node --check apps/ai-token-counter/app.js
```

No package install or external API needed.

## Verification (21 Nov 2026)

- **Node.js / macOS:** 11/11 tests passed, `node --check` passed.
- **Chrome headless / macOS:** page and engine loaded; edited both texts; exact token overrides; manual rates + monthly calculation; actual CSV download and sensitive fixture text not present in downloaded CSV; invalid input disables exports and recovers after correction; reset clears private text/rates.
- **Responsive smoke test:** no document overflow at 320, 360, 390, 430, 768, 900 and 1440 CSS pixels.
- **Not yet done:** Safari and Firefox real browser tests, interactive iOS/Android, full assistive technology / screen reader audit, clipboard permissions, live HTTPS after release. Chrome headless results do not substitute for these.
- **CI:** must pass on the latest PR head before merge.

## Release coordination

- Work is isolated to `apps/ai-token-counter/` plus its **own** path-scoped workflow.
- Do not modify #212's native Mac work, #369 Archer Web Lab, existing `apps/index.html`, the production home, audio game, or existing release streams.
- Parent plan: #368. Catalog coordination: #52, #173. Global coordination: #78. Privacy/legal: #140.
- Do not add a public CTA or claim browser availability until merge approved, browser QA completed and HTTPS deployment verified.
- Target hosting costs: **zero additional fees**; no backend or third-party telemetry.
