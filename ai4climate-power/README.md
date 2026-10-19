# Power Energy Prices — AI Energy Response Layer
**Unfire research demonstration | AI4Climate Global Youth Climate Solutions Challenge 2026**

## Status, provenance and rights
- **Functional offline research demonstrator:** 24-hour forecast visualization, train/reference 9 synthetic days, held-out 1 synthetic day, five-nearest-neighbour price prediction, transparent contiguous scheduling, and an explicit human approval step. Works with no API key, backend, appliance hardware, or credential.
- **Not production ready.** All example prices are synthetic generated data (fixed formula, reproducible in `index.html`). They are **not actual Spanish PVPC prices**. The evaluation MAE is computed **on synthetic examples only**, not a real-world forecasting score. This does not demonstrate energy savings, emissions reductions, customer adoption, verified emissions intensity or access to real grids.
- **Existing product:** Unfire's iOS Power Energy Prices app is a separate existing electricity-price viewing application. The research AI response layer is additional exploratory work; no autonomous device commands are installed or used.
- **Team:** Omar Baró, independent founder of Unfire (not an incorporated company).
- Intellectual property and third-party rights remain with their respective owners.

## One place, one problem, one AI decision task
**Setting:** Barcelona/Catalonia, Spain — potential future field pilot with an opt-in household or small-business user.
**Problem:** Flexible loads (laundry, charging, computing) can be shifted, but price curves are difficult to interpret in terms of actionable time windows. The working hypothesis is that combining calibrated energy-price forecasts with independently sourced, time-aligned emissions intensity could support lower-cost and, where evidence supports it, lower-emission flexible-load decisions.
**Users:** Households or small businesses with time-flexible consumption.
**AI task:** A supervised statistical model forecasts hourly prices using historical patterns. A constrained optimiser proposes a continuous time window within user-supplied earliest/latest limits. User confirmation is required; no control or dispatch to appliances occurs.
**Climate claim:** None is established. Carbon signals are **not** incorporated into the current demo. Evaluation of any emissions-related claim requires separately sourced electricity generation/emissions intensity and an auditable baseline.

## Run and reproduce
1. Open `index.html` in any modern desktop or mobile browser. It makes no external requests.
2. Change the appliance, permissible time window and duration. Observe the forecasted price differences and suggested hour.
3. Click `Accept suggestion (local only)`. This records no persistent approval and triggers no hardware command.
4. Optional test on developer's Mac: `node test_demo.cjs` (requires a locally installed Puppeteer/Chrome environment; adjust the absolute Puppeteer path if needed). The test covers 24 bars, deterministic synthetic-day validation, controls, impossible windows, human approval, mobile overflow and JavaScript errors.

## Model, data & limitations
The embedded deterministic generator builds ten illustrative daily 24-hour price profiles. The prediction for each hour uses 5 nearest samples from the first 9 synthetic days, with circular distance between hours and a minor recency tie-breaker. The last synthetic day is held out for synthetic MAE; no benchmark real-world out-of-sample result is claimed. For a selected consumption amount and duration, the optimiser compares all feasible contiguous windows and computes estimated costs. This is a small genuine k-nearest-neighbours statistical learning example, not a deployed or rigorously calibrated price model. Forecast uncertainty, tariff differences, grid emissions and privacy constraints still need research before pilot.

## Proposed 90-day field validation (not started)
- **Days 1–20:** Confirm one voluntary pilot site, tariff category, appropriate lawful data sources (e.g. official Red Eléctrica/eSIOS published PVPC datasets), consent/privacy and user needs. Define baseline and uncertainties.
- **Days 21–45:** Integrate licensed price histories and, if robust data are available, emissions-intensity measurements. Add source timestamps, data lineage, interval alignment, forecast confidence and failure-mode alerts. Do not infer cleaner electricity solely from lower cost.
- **Days 46–70:** Run prospective back-tests against a no-shift baseline and compare to simpler rule-based methods using time-split validation and transparent MAE/cost metrics. Separate actual measured emissions from modeled estimates.
- **Days 71–90:** Small opt-in usability test; compare recommendation understanding, acceptance and independently verified load shifting. Keep explicit human approval, no direct appliance access, and the ability to opt out.

## Important disclaimer
This demonstration is provided for research and competition evaluation only, not real tariff advice, market forecasts, or autonomous equipment control. Results are illustrative and may be wrong. Do not make financial or environmental decisions from the demo without reliable live data and validation.