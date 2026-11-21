# Hyperwave 2000 — Manufacturing feasibility plan and next technical milestones

**Date:** 2026-11-15 (second session) · **Status:** PLANNING DOCUMENT / NOT A QUOTE · **Issue:** #329 · **PR:** #330
**Builds on:** `MECHATRONIC_FEASIBILITY_20261115.md` (motion inventory, axis count, NRE and unit ranges). Nothing here is supplier-validated.
**One product only:** every architecture below is an engineering route for the same Hyperwave 2000, never a separate model.

## 1. Movement-by-movement mechanism map (from the real digital timeline, T = 0 → 4, ≈ 4.7 s at SPEED 0.85)

| # | Digital movement (source: `audio/hyperwave/index.html`) | Known mechanism? | Custom transmission? | Independent actuator? | Can share a cam / gear train? | Exact without redesign? |
|---|---|---|---|---|---|---|
| 1 | Canopy lifts and rotates ≈ 92° with the display (T 0–1) | Yes — geared rotary drive + encoder + counterbalance (gas spring / torsion) | Possibly a two-stage hinge to clear the rear | Yes (1–2 drives, mirrored) | No | Likely yes, if body depth allows the swing |
| 2 | Display boots (T 0.55–1.6) | Electronics only | — | — | — | Yes |
| 3 | Keyboard tray lifts and advances (T 1–2) | Yes — two synchronised guided linear axes (lead screw or rack) | No | Yes (1 drive + mechanical sync shaft preferred) | Tray lift and advance can share one cam plate | Yes, subject to ~10 cm closed height |
| 4 | 25 keys arrive in a staggered wave | Partly | **Yes** — one camshaft with 25 phased lobes or a drum cam lifting a key carrier | No (1 drive for all keys) | **Yes** | Wave timing yes; per-key independent motion would need 25 actuators — not recommended |
| 5 | Panel rises and inclines ≈ 0.2 rad (T 2–3) | Yes — four-bar lift-and-tilt linkage | Custom linkage geometry | 1 drive | Lift and tilt from one linkage | Yes |
| 6 | 9 knobs rise and turn into place | Partly | **Yes** — rise via shared cam bar; reveal rotation via detachable magnetic coupling so knobs stay fully manual and electrically read (encoders) | Prefer no | **Yes** | Rotation-to-position needs a declutching design; experiment in F2 |
| 7 | Wheels and ribbon emerge | Yes | Linked to tray cam | No | Yes | Yes |
| 8 | Speaker pods extend on telescopic arms and articulate (T 3–4) | Yes — per pod one telescopic linear stage + one rotary joint | Telescopic arm with internal cable chain | Yes (2 per pod = 4) | Left/right can be mirrored from one controller | **No** — the 3D strut stretches continuously; physical arms need nested sections and a visible joint |
| 9 | Light, LEDs, VFD, speaker pumping | Electronics | — | — | — | Yes (audio-reactive cone motion is real driver excursion) |

**Superseded by `ENGINEERING_DESIGN_v0.1.md` (12 axes, verified in simulation).** Original recommendation — **baseline architecture ("A"):** 8–10 powered axes — canopy (2, mirrored), tray (1), key camshaft (1), panel (1), knob cam bar (1), pods (4). This is the most reliable route to a visually faithful opening. Architecture "B" (fully independent keys/knobs, 30+ axes) multiplies cost, noise and failure modes without a visible benefit; reject unless the owner explicitly wants it.

## 2. Noise, heat, force, safety, maintenance

- **Noise:** target ≤ 40 dB(A) at 1 m during motion (to be validated); belt or helical-gear reductions, BLDC with field-oriented control, rubber-isolated mounts, motion disabled while audio is playing loudly.
- **Heat:** motion duty cycle is tiny (seconds per opening), so motor heat is negligible; the audio amplifier and DSP set the thermal budget. Separate thermal zones for amplifier and motion electronics.
- **Force and safety:** current-limited drives with stall detection, capacitive or force-sensing pinch edges on canopy and panel, low-energy motion (< 50 N at closing edges as a design target), stable unpowered positions, manual override to close without power, emergency stop on the front control. Conformity route to be classified by a qualified assessor (Machinery Regulation 2023/1230 applicability is not assumed either way).
- **Maintenance:** modular axes replaceable as cartridges; cycle-rated cable chains; firmware logs cycles and motor currents to predict service. Design target: 20,000 open/close cycles before scheduled service (≈ 10 per day for 5 years) — to be proven in F2.
- **Fidelity vs reliability:** keep the original *sequence and choreography*; allow real timing to stretch (e.g. 6–9 s) if loads require. Agree with the owner what “identical” means before F1 (gate F0).

## 3. Cost structure — separated as requested (EUR, excluding VAT; planning ranges, not quotes)

| Block | Low | Mid | High | Notes |
|---|---:|---:|---:|---|
| Engineering / NRE (design, CAD, firmware, DSP port, safety) | 200,000 | 450,000 | 1,000,000 | From feasibility study; one-off |
| Prototype(s) incl. demonstrators and integrated unit | included above | included | included | ~35k–170k of NRE |
| Certification preparation and lab tests (EMC, electrical, mechanical) | 20,000 | 50,000 | 95,000 | One-off per design revision |
| Direct manufacture per unit (10–30 units) | 10,000 | 30,000 | 55,000 | Materials, CNC, drives, electronics, assembly, calibration |
| Insured transport per unit | 2,500 | 4,500 | 8,000 | Destination dependent; duties excluded |
| Installation per unit (where required) | 1,500 | 4,000 | 12,000 | Specialist visit, plinth integration |
| Warranty reserve (% of direct) | 6% | 8% | 10% | Specialist aftercare |

**Illustrative all-in cost per unit** (NRE + certification amortised over the units sold; USD/EUR ≈ 1.12 as of early November 2026, so USD 120,000 ≈ EUR 107,000):

| Scenario | 10 units | 20 units | 30 units |
|---|---:|---:|---:|
| Low | €36,600 | €25,600 | €21,900 |
| Mid | €90,900 | €65,900 | €57,600 |
| High | €190,000 | €135,300 | €117,000 |

**Price needed for a 40% gross margin (USD):** low ≈ $41k–68k · mid ≈ $107k–170k · high ≈ $218k–355k.

**Conclusion:** USD 120,000 works only if engineering lands near the low-to-mid range *and* at least ~20 units are sold. With 10 units in the mid scenario, the starting price should be about **USD 170,000**; in the high scenario, **USD 220,000–355,000**. Do not cut mechanisms to defend USD 120,000 — reprice after F1 quotes. A first commission could also fund part of NRE explicitly in its contract (with owner credit and safeguards), which would change the arithmetic.

## 4. Next technical milestones

| Milestone | Deliverable | Who | Spend authorised? |
|---|---|---|---|
| M0 (now) | Timecoded digital reference: 120-frame capture + film + per-movement T ranges (done this session: `tools/capture-digital-transformation.cjs`) | Unfire | No spend |
| M1 | Requirements pack (motion, force, noise, timing tolerance, power, closed envelope) from the digital model | Unfire | No spend |
| M2 | Replies from the three engineering firms already contacted; shortlist one for a paid F1 study | Helldorfer Engineering, Toolman Custom, Delta Kinetic (contacted 15 Nov) | **No** — requires owner approval |
| M3 (F1) | Kinematic CAD, mass and torque per joint, interference checks, architecture A vs B, refined NRE | Selected firm | Owner approval required |
| M4 (F2) | Two demonstrators: canopy hinge + flex harness; telescopic pod arm; optional key camshaft | Firm + Unfire | Owner approval required |
| M5 (F3) | Integrated prototype with real sound, filmed | Firm + Unfire | Owner approval required |
| M6 (F4) | Three manufacturing quotes (1/5/10/25), compliance classification, legal terms, safeguarded payments | Unfire + counsel | Owner approval required |

No quote requests beyond the three already-sent capability enquiries were sent in this session; no spend was authorised or incurred.
