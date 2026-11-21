# Hyperwave 2000 — Electromechanical feasibility, risk and cost study

**Date:** 2026-11-15. **Status:** DESK FEASIBILITY ONLY / NOT A PRODUCTION QUOTE. **Owner:** Unfire / GitHub issue #329, branch `feature/hyperwave-hardware-interest-20261115`. **Single product:** one Hyperwave 2000, not multiple editions.

## Executive engineering verdict

**Possible in principle, not yet mechanically demonstrated.** The currently implemented `audio/hyperwave/index.html` is a real interactive browser-based 3D/Web Audio synthesizer, **not** a physics-tested mechanism, CAD assembly, motor-controller firmware, tooling package or manufactured physical unit. Most scripted movements appear achievable using mechatronic mechanisms, but reproducing the *same shape, timing, motion and sound at real scale* is **UNPROVEN**. The 3D engine stretches some render primitives freely; real mechanisms require discrete telescoping parts, clearance, cable routing and load paths. Do not claim an exact physical replica, certifiable design, or shippable unit until proven.

**Indicative budgeting, excluding tax, NOT offers from vendors:**
- **Full initial engineering programme + integrated working prototype:** **EUR 200k–1m+**; larger if exact visual behavior requires many independent micro-actuators, complex tooling, redesigns or multiple certification cycles.
- **Repeat unit build cost at approximately 10–30 units:** **EUR 10k–55k+** per unit before amortizing programme cost, taxes, commercial margin and channel fees.
- **First one-off handcrafted full unit:** plausibly **EUR 20k–90k+ in direct fabrication and assembly** in addition to development, with very low confidence.
- **Sales price:** **TBD** until independent firm supplier quotes, achievable engineering milestones, production capacity, target market and full unit economics. Former USD 4,999 target is withdrawn, NOT an upper limit.

These broad ranges are **reasoned planning hypotheses**, not expert sign-off, contractual prices, or evidence that a supplier will build it without an advance.

## Evidence — actual digital source (as of main SHA 725b1a66dbf29079a712b43c5d226b15ba1fda53)

Primary source: https://github.com/ondmindmanagement-hub/unfire-website/blob/main/audio/hyperwave/index.html

Code explicitly states:
- Procedural Three.js **transformable digital model**, Web Audio synthesizer, 32-voice virtual-analogue display claim. The device's future physical capabilities must not be assumed from display label.
- Geometry scale comment **1 unit ≈ 10 cm**. Main body `A=2.3`, `C=1.2`: **approximately 46 cm wide × 24 cm deep** before deployment; casing base/lid depths indicate an approximately 10 cm closed envelope (illustrative only; zero mechanical clearance analysis).
- Stereo speaker pod centres reach about `x=±3.08` with pod half-width `0.34` -> approximately **68 cm deployed overall width** by the code's scale.
- A roughly 21 cm × 7.4 cm virtual display (`SW=2.1`, `SH=0.74`) is suspended under a rotating lid; actual manufacturable display dimensions/format unresolved.
- A **25-note** keyboard from MIDI notes 48–72 emerges sequentially with staggered digital keyframe animation. It is *not* proof that 25 motors are required: a common motor and cams may reproduce the pattern; conversely exact independence might necessitate many actuators.
- **8 parameter knobs + a MASTER knob** animate emergent motion and rotational motion; 2 pitch/mod wheels emerge. User input must remain manually accessible after movement.
- 2 speaker pods each extend/reposition/rotate in space; digital telescoping struts change their shape via render scaling (not physically validated).
- Lid lifts then rotates ~1.6 radians (~92°); panel rises and inclines ~0.2 radians; keyboard tray lifts and advances.
- Animation time parameter `TMAX=4`, speed `SPEED=0.85` -> a complete digital sequence nominally ~**4.7 seconds**. Physical mass, speed, torque, noise, cable flex and safety may require slower real motion.
- **First-pass trajectory velocities (derived from digital keyframes, not measurements):** keyboard tray lifts ~14mm over ~0.41s (**~34mm/s**); control panel rises ~23mm in ~0.41s (**~56mm/s**); an early speaker pod extends ~34mm in ~0.47s (**~72mm/s**). The cited Actuonix L12-210 actuator is only **6.5mm/s at zero load**, so it is **far too slow** for those movements at original timing. Faster drives and force/risk assessment are required; end-stop shocks and synchronization increase complexity.
- **Illustrative hinge sizing only:** if a lid assembly were 2kg with its centre of mass 0.10m from a horizontal hinge, gravity moment at the worst orientation is about **1.96N·m** before acceleration, friction and safety factors. ROBOTIS XH430-W350-T advertises a **0.68N·m rated continuous torque** (versus a much larger stall torque), so this hypothetical lid cannot be sized with one such motor at 1:1. The actual lid mass and lever arm are unknown; counterbalance, gearing or a more capable motor may solve it.
- SFX labelled servo/clack are synthetic digital audio; they are **not measured real motor sounds**.

## Physical motion architecture — *concept, not a verified mechanism design*

| Existing digital effect | Candidate physical actuation concept | Critical unknown / risk | Feasibility judgement |
|---|---|---|---|
| Lid screen opening and tilting | 1–2 geared rotary actuators with encoders, counterbalance, torque/current limits, locking hinge | Lid/display mass, forward/backward clearance, 12V/24V routing, fingers | Plausible; needs kinematic and torque design |
| Tray deploy and pitch/mod wheels | 2 synchronized guided linear axes, rack/lead screw, optionally shared cam for wheels | Vertical clearance inside ~10cm body, tray stiffness, mechanical jams | Plausible with enclosure changes |
| 25 keys stagger into place | One camshaft/sequential cam mechanism or linked actuation; ordinary velocity-sensitive playing keybed | Stagger timings, keybed feel/reliability, key pitch, interference | **High difficulty** under original form factor |
| Pop-up and tilting control panel | 2 lifting guides + tilt linkage | Knob protrusion, lid interference, sustained knob/user loads | Plausible, custom linkage |
| 9 knobs rise and twist | Shared cam and differential/magnetic couplers, or individual small motors/actuators | Independent 360° reveal while preserving hand rotation/electrical sensing | **High difficulty**, design experiment required |
| Left/right expanding speakers | For each pod one linear/telescoping actuation + one rotary axis, flexible cable/harness | True arc/position from keyframes, audio cable fatigue, resonance, balance | Plausible with bespoke joints |
| Flexible 3D procedural surface motions | Approximate with segmented rigid parts, overlapping covers, sliding inserts | Render mesh can deform continuously; hard material cannot | **Exact equivalence not established** |
| Audio-reactive speaker cone motion/lighting | Actual speaker driver diaphragm + LED DSP sync | Audible distortion, vibration, EMC, noise | Plausible |

**Rough axis count:** 8–18 powered axes **if cams/couplings synchronize** keys/knobs; potentially **more than 30** if the requirement is truly independent individualized rises and rotations. **These are architecture alternatives for the same Hyperwave, not separate sales versions.** Exact count awaits kinematic CAD.

**Special constraints:** silent/low-noise motion around a musical instrument, no RF/motor EMI in audio chain, safe fingers and pinch detection, stall protection, loss-of-power stable positions, fail-safe manual recovery, routing of display and speaker signal through folding joints, calibration, durability and maintenance.

## Cost construction (EUR excluding VAT, delivery retail margin and engineering amortization)

**Planning assumptions:** small premium series of 10–30 units, several custom-machined parts, specialized integration, not a cheap plastic piano. Lower and upper bounds are scenario estimates; neither is supported by an actual Hyperwave vendor quote. Updated when CAD geometry/BOM exists.

| Direct per-unit subsystem | Low | High | Basis / sensitivity |
|---|---:|---:|---|
| Actuators, gearing, drivers, encoders, sensors | 1,500 | 9,000 | Quantity, precision, torque, custom couplings |
| Precision metal/polycarbonate enclosure and surface finish | 2,500 | 14,000 | Multiple unusual curved pieces and small batch CNC |
| Mechanical transmissions, rails, hinges, flex routing | 800 | 4,500 | High duty cycle, cable chains, interlocks |
| Audio compute, controller boards and display | 600 | 2,500 | Embedded DSP port, screen, PCBs |
| 25-key keybed, ribbon, wheels, controls/LEDs | 400 | 2,000 | Custom mechanism and expression sensing |
| Speakers, amplifiers, power system | 250 | 1,800 | Thermal and acoustic engineering |
| Specialist assembly, individual alignment, calibration/QA | 2,000 | 8,500 | Skilled technician work and rework |
| Packaging, shipping allowance and warranty reserve | 800 | 4,200 | Heavy moving equipment / returns |
| **Subtotal, no programme amortization** | **8,850** | **46,500** | All estimates only |

Allow 15–25% early-production contingency for yield/engineering changes: a rounded **EUR 10k–55k+ per repeat unit** is a useful risk envelope, **not** a purchase price or prediction. A one-off custom build may cost much more. Tax/VAT, sales operations, financing, selling fees, and engineering amortization are excluded.

**NRE / programme budget illustration:**
| Non-recurring work | Low | High |
|---|---:|---:|
| Mechanism architecture, industrial design, kinematics, detailed CAD | 65,000 | 270,000 |
| Mechatronic safety, motor power/control and electrical integration | 30,000 | 125,000 |
| Motion firmware and DSP/audio embedded implementation/integration | 30,000 | 145,000 |
| Prototype fabrication, revisions, fixtures, failure analysis | 35,000 | 170,000 |
| EMC/safety preparation, laboratory tests, DFM and build instructions | 15,000 | 95,000 |
| Programme integration, vendor sourcing and contingency | 25,000 | 195,000 |
| **Total rough risk range** | **200,000** | **1,000,000** |

Rates: a Barcelona hardware lab publicly quotes EUR 75/h and describes EUR 95–130/h as typical elsewhere; a European industrial design firm quotes mechanical design/engineering projects from EUR 50k. This instrument spans multiple specialisms and phases: it is **not** comparable to pricing a four-layer PCB in isolation. All rows are our **assumed work packages** for this product, not vendor rates or contractual quotes.

Example amortization: if development costs EUR 400k and only 20 units sell, R&D recovery contributes EUR 20k per unit **before** direct production, service, tax or profit. The business case is highly sensitive to verified demand and number of physical units.

## Source price anchors (not a selected BOM)
- Actuonix **L12-30-210-12-P** 30mm feedback linear actuator: USD 80 retail; spec 80N maximum, 30mm travel, no-load 6.5mm/s. A 30mm stroke taking 4.6 sec at no-load already consumes almost the *entire* 4.7s original sequence, showing timing may demand other actuator choices; do not assume rated force is available at this speed. https://www.actuonix.com/l12-30-210-12-p
- ROBOTIS **XH430-W350-T** servo: USD 413.89 retail, 3.4N·m *stall* versus recommended rated torque ~0.68N·m; no design should size a joint by stall torque. https://robotis.us/products/dynamixel-xh430-w350-t
- Protolabs says exact machined part cost requires upload of genuine 3D CAD: https://www.protolabs.com/es-es/recursos/preguntas-mas-frecuentes/
- Industry quoting reference with European engineering rates and examples (Oct 2026): https://halfbridge.eu/guides/hardware-development-cost-europe/
- European Commission study on EMC conformity: external lab fees EUR 800–1,500/day, some estimates EUR 5k–20k for tests, documentation EUR 1k–10k depending on product. Actual scope unknown. https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:52023SC0007
- European Commission mechanical safety page: Machinery Regulation EU 2023/1230 generally applies as of **20 Jan 2027** to in-scope equipment, but it has exclusions including some low-voltage electrical/audio equipment. **Have qualified conformity assessor determine legal classification.** https://single-market-economy.ec.europa.eu/sectors/mechanical-engineering/machinery_en

## Feasibility gates — mandatory sequence BEFORE any final retail price or paid reservation

**F0, source-to-mechanism extraction (no money):**
- Freeze a reference video generated by capturing **the actual digital Hyperwave demo**, with timecoded transformation milestones. Label it explicitly **digital simulation**, not hardware footage.
- Export/read 3D geometry and animated pivot transforms into manufacturable CAD constraints, keeping proof of which measurements are only visual-scaled assumptions.
- Define requirements for motion, sound, force limits, return-to-closed, transport, noise level and repairability. Identify what counts as 'identical' to the user's desired appearance.

**F1, kinematics and packaging (RFQ review, may be free to quote):**
- Produce dimensioned closed/open envelope, exploded mechanism concept, mass estimate, minimum clearances and cable routes.
- Compute motor torque per major joint using worst-case gravity/friction and acceleration, *rated/continuous* not stall ratings.
- Use collision/interference and fault recovery simulations. Verify all panels and speaker pods fit inside the closed chassis. If not, mark original dimensions infeasible and submit only a justified geometry update for owner approval.
- Produce 3 concepts of the **mechanism architecture for the ONE model**, not alternate retail products.

**F2, 1–2 mechanism demonstrators (not full instrument):**
- Build lid+display hinge with flex harness and speaker pod telescoping/rotating unit; optionally knob/key cam assembly for the highest uncertainty.
- Run repeatable open/close cycling under realistic loads and record stall, noise, repeatability, temperature and pinch response. Do not fabricate success metrics.

**F3, integrated engineering prototype:**
- Fit keys, audio/control DSP, screen, drives and power; integrate motion controller separate from low-latency audio DSP.
- Enforce driver watchdog, current/force limit, independent limit switches, emergency/recovery behavior, powered-off mechanical stability.
- Verify mass, mobility, sound, audio latency, motor noise bleed, RF/EMC and mechanical safety.

**F4, qualified manufacturing & commercial launch gate:**
- Obtain at least 3 real vendor RFQs covering small quantities (1, 5, 10, 25), NRE/tooling, MOQ, yield, durability, certifications, warranty and transport.
- Check EU/UK/US requirements based on markets. Legal reviewer decides Machinery Regulation 2023/1230 applicability rather than assuming it does or does not apply because the item is an instrument.
- Calculate cash runway, deposit policy, refund and delivery assurance; only then permit an owner-approved binding price/reservation flow.
- Protect IP with NDA/contract; supplier rev-share/no-upfront requires signed agreement and cannot be assumed.

## Initial supplier feasibility brief — UNSENT, email-first, no commitment

**Subject:** Unfire Hyperwave 2000 — confidential mechatronic transforming instrument feasibility & non-binding RFQ

> Hello,
>
> Unfire is investigating the feasibility of reproducing a **single transforming electronic musical instrument** from an existing real-time procedural 3D/audio demonstration. It is not yet a physical prototype. The approximate closed digital form factor is 460 × 240 × 100 mm, increasing to roughly 680 mm across the moving speaker modules. These are only *scaled 3D dimensions*, not validated manufacturing constraints.
>
> The intended movement sequence includes a powered screen lid, sliding/revealing 25-key keyboard, lifting/tilting control panel with emergent knobs, and two telescoping/reorienting speaker pods, coordinated in approximately 4.7 seconds. We require a serious feasibility opinion on safe power, motor/sensor selection, packaging, acoustic impact, mechanical durability, and whether faithful visual timing can be achieved.
>
> We first request **a free, non-binding, email-based capability fit check** (not unpaid engineering). Please say what CAD/videos/requirements you would need for a paid engineering feasibility package, your rough fee range for that package, and whether you can quote prototypes and production in quantities of 1/5/10/25. Please distinguish design/NRE/tooling from per-unit cost. We do not accept charges or commit to orders at this stage.
>
> Unfire | hello@unfire.technology

## Evidence/decision status as of 2026-11-15
- [x] Source-reviewed motion inventory, code-based dimensional and temporal clues
- [x] Public component pricing references and broad budget model
- [ ] Mass/torque/stroke motor calculations using real CAD
- [ ] Kinematic CAD / interference / physically achievable packaging
- [ ] Independent mechatronic engineer feasibility signoff
- [ ] Prototype built / measured
- [ ] Actual supplier RFQs received
- [ ] Compliance classification and scope reviewed
- [ ] Customer willingness-to-pay validated
- [ ] Final retail price authorized
- [ ] Binding reservations/payments enabled

**BOTTOM LINE: conditional technical plausibility is not proof of manufacture; an accurate cost quote requires proper CAD and supplier engineering. Keep the public hardware interest page DRAFT/noindex until verified.**
