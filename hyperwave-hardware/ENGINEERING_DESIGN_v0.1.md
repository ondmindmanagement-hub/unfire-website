# Hyperwave 2000 — Engineering design v0.1 (Unfire internal engineering)

**Date:** 2026-11-15 · **Branch / PR:** `feature/hyperwave-hardware-interest-20261115` / #330 (draft) · **Status:** design-level engineering, verified in simulation; **not yet built, measured or certified**.
**Rule kept:** one Hyperwave 2000. Every decision below is engineering of that single instrument.

## 1. What was physically wrong with the digital transformation (measured)

Measured with `tools/physics-audit.cjs` on the real model, T = 0…4 in 81 steps (1 model unit = 100 mm). The audit's detectors were proven with a negative control (panel deliberately raised 45 mm under the closed canopy → 3,998 crossings, 9,443 protruding vertices detected).

| Check | Before | After |
|---|---:|---:|
| Speaker pods cutting through the body shell | 9.9 mm deep, at every T from 0 to 3 | **0** |
| Speaker pods cutting through the canopy | 9.6 mm | **0** |
| Pod shell intersecting internal parts | 5 contacts | **0** |
| Pods floating with no support | 100 samples, up to 113.7 mm from the body | **0** |
| Parts that stretch like rubber (scaled struts / pistons) | 6 | **0** |
| Parts that appear from nothing | 8 | **0** |
| Canopy sweeping through keyboard / panel (surface-crossing detector) | 0 | 0 |
| Display assembly hitting keyboard / panel | 0 | 0 |
| Internal parts outside the enclosure when closed (cannot close) | 0 | 0 |
| Internal parts breaking through the body wall | — | 0 |
| Arm tubes hitting internal parts or the floor | — | 0 |
| Heavy parts overshooting and bouncing ('back' easing) | canopy 7.1°, pod yaw 7.2°, pods 3.4 mm | **none** (minimum-jerk) |

The instrument still plays: smoke test (`tools/smoke-instrument.cjs`) opens it, plays two voices through the real synthesizer (2 voices, audio level 0.25), goes to HYPER and closes back to T = 0 with no page errors. Existing Hyperwave audio tests pass.

## 2. Design changes made to the real model (`audio/hyperwave/index.html`, reproducible via `tools/patch-physical-model.py`)

1. **Speaker pods dock outside the body ends** (centre at ±266 mm instead of ±212 mm) so that no shell passes through another. The closed instrument becomes 600 mm wide instead of 492 mm; its silhouette — a silver body with amber end caps under a sapphire canopy — is unchanged.
2. **A real 4-stage telescopic arm** carries each pod at all times: rigid tubes Ø14/11.6/9.4/7.4 mm, 34 mm long, 3 mm overlap; collapsed 34 mm, capacity 127 mm, required 43–114 mm. The arm rises from a root bearing inside the body end (x = 208 mm, y = 47 mm) through a U-notch in the shell tip, which the docked pod covers.
3. **Wrist inside the pod**, 15 mm behind the pod centre: the pod turns 90° about a vertical turntable at the end of the arm. The pod's amplifier board moved to the outer half so the arm channel is free. The final pose was adjusted 3 mm (z 0.18 → 0.15 u) so the arm stays in one vertical plane: 2 joints on the arm (elevation + length) plus 1 at the wrist. The 7° pod tilt is driven passively by a parallel link (no fourth motor).
4. **Scissor lifts replace the stretching pistons** under the keyboard tray and control panel (rigid bars, fixed length, height from angle). The panel also gets front scissors, so it is supported at all four corners. *Physics note:* a scissor driven horizontally needs 90 N at 5° to lift the 0.8 kg panel, so the scissors only guide; a vertical lead screw does the lifting.
5. **Motion profiles:** heavy parts (canopy, tray, panel tilt, pods) use minimum-jerk profiles (zero velocity and acceleration at both ends — no slam, no bounce); keys, wheels, knobs and buttons decelerate to a stop instead of springing past.

## 3. Mechanism per movement (real scale, from `engineering/choreography.json`)

| Axis | Motion | Peak speed | Load | Proposed drive |
|---|---|---:|---|---|
| Canopy (1) | 0 → 91.7° in 0.76 s; HYPER +3.4° | 225°/s (36.5 rpm) | 0.8 kg, 0.86 N·m gravity closed, 0.23 N·m inertial | NEMA 17 closed-loop stepper + 20:1 planetary on a torque tube to both hinges; torsion springs carry ~70% of the gravity torque (motor needs ≈0.64 N·m); spring-applied brake holds on power loss; latch solenoid releases first |
| Tray cam (1) | ½ turn in 0.82 s: lift 14 mm, then advance 8 mm; flips the wheels | 1.14 turn/s | 0.9 kg | NEMA 14 + 5:1 planetary on a two-track cam plate (lift track, then advance track) |
| Key camshaft (1) | 180° in 0.92 s, 25 lobes phased 7.5° | 369°/s | 25 × 12 g + return springs | NEMA 11 + 2:1 belt; lobe dwell holds the key frames up so the keys play normally |
| Panel front (1) | 23 mm in 0.41 s | 167 mm/s | 0.8 kg (≈8.5 N) | NEMA 11 captive lead screw, 8 mm lead (785 rpm, 0.03 N·m) |
| Panel rear (1) | 23 mm, then +15.9 mm = 0.20 rad tilt | 167 mm/s | shared | same as front |
| Knob bar (1) | 21.5 mm in 1.01 s | 21 mm/s | 9 knobs | NEMA 8 lead screw. Lost-motion slots 1.75 mm apart stagger the knobs; a 7.5 mm-pitch helix (8° helix angle) turns each knob one full revolution as it rises, then disengages so the knob turns freely |
| Arm length L/R (2) | 43 → 114 mm | 135 mm/s | pod 0.3 kg | NEMA 8 with nested 2-stage lead screw inside the telescope |
| Arm elevation L/R (2) | 3.2° → 28.8° | 50°/s | 0.34 N·m at the root | NEMA 11 + 40:1 worm (self-locking; holds the pod with power off) |
| Pod yaw L/R (2) | 0 → 90° | 287°/s | small | NEMA 8 + 10:1 planetary in the wrist housing, magnetic encoder |

**Total: 12 axes.** This replaces the "8–18" estimate in the earlier feasibility study with a specific architecture. All axes use quiet stepper motion (TMC5160 class drivers: StealthChop2 for silent motion, StallGuard2 load sensing for stall and obstacle detection) with absolute magnetic encoders.

**Sensing that survives movement:** keys use Hall-effect velocity sensing (a magnet in each key, no contacts to break when the keybed rises); the knobs use contactless magnetic encoders below the panel, so a knob can rise and fall without a shaft connection; moving assemblies are wired with flex circuits rated for repeated cycles.

## 4. Electronics architecture
- **Audio computer:** Raspberry Pi Compute Module class running the existing JUCE C++ engine (`~/UNFIRE_LOCAL_WORKSPACE/HyperwavePlugin/Source/SynthEngine.h`), not the browser. Elk Audio OS (real-time Linux for low-latency audio; officially supported on Pi 4) is the first candidate; CM5 needs its own latency measurement first.
- **Motion controller:** dedicated microcontroller running `engineering/firmware/motion_core.*`; it is separate from audio so motion faults can never glitch sound, and vice versa. A heartbeat from the audio computer is a watchdog input.
- **Display:** 210 × 74 mm bar-type LCD behind the canopy window (VFD look rendered in software).
- **Power:** 24 V supply; motion peaks are short and sequential; class-D amplifiers in the pods.

## 5. Motion firmware and safety logic (verified on the host)
`engineering/firmware/`: `choreography.h` is generated from `choreography.json`; `motion_core.cpp` plays the 12-axis choreography forwards or backwards on a rate-limited time base (a reversal takes 0.5 s, with no velocity steps on any axis).

**Interlocks use measured positions:**
- The panel cannot rise until the canopy is at least 85° open.
- The tray cannot lift before the canopy is at 60°.
- The canopy cannot close below 89° unless both pods are docked (arm ≤ 44.5 mm), the panel is fully down and the tray is stowed.

**Fault handling:**
- Pinch or stall: stop within about 45 ms, back off for 0.35 s, then hold.
- Following error or watchdog: hold.
- Power loss: freeze the sequence, disable the drives; the worms, lead screws and canopy brake hold every position.

`host_test.cpp` (built with `c++ -std=c++17 -Wall -Wextra`, no warnings) simulates the machine with a 15 ms lag per axis. Results: **ALL MOTION TESTS PASSED.**

| Scenario | Result |
|---|---|
| Open to HYPER and close | No holds; every axis ≤ its velocity limit; every axis returns exactly to stowed |
| Reversal mid-opening | Smooth |
| Hand under the canopy | Backs off and holds; no motion until a new command; then closes |
| Jammed canopy at 40° | Safe stop; tray and panel never move |
| Speaker arm hits an obstacle | Retreats |
| Plan-level closing interlocks | No violations over the whole timeline |
| Power loss | Drivers off; sequence frozen |

## 6. What this does not prove yet
- Masses are estimates from geometry (canopy 0.8 kg, panel 0.8 kg, tray 0.9 kg, pod 0.3 kg), and the drive sizes follow from them. The next steps are real CAD with mass properties, then a torque check with measured friction.
- Packaging at 1:1 has not been checked in CAD. Two areas are tight: the four mechanisms under the ~100 mm closed height, and the U-notch for the arm.
- Noise, thermal, EMC and cycle life have not been measured. Design targets: ≤ 40 dB(A) at 1 m during motion, 20,000 cycles.
- An independent qualified engineer should review this design before money is committed to prototypes. Conformity classification is a legal step, not an engineering one.

## 7. Next steps (Unfire can do 1–3 itself)
1. Freeze the corrected digital model as the reference (done: film/frames can be re-captured with `tools/capture-digital-transformation.cjs`).
2. Build parametric CAD of the mechanism layout from `choreography.json` and the model dimensions; run interference checks in CAD; get real mass properties.
3. Print 1:1 demonstrators of the two riskiest mechanisms — the pod arm and wrist, and the knob helix — on a desktop 3D printer with off-the-shelf NEMA 8/11 motors and TMC drivers, running `motion_core` unchanged. Measure speed, noise and cycles.
4. Only then request quotations for the metal, glass and finishing work.
