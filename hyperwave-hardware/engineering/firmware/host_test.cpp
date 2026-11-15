// Host-side verification of the Hyperwave motion core with a simulated machine.
// Build & run:  c++ -std=c++17 -O2 -Wall -Wextra motion_core.cpp host_test.cpp -o host_test && ./host_test
#include "motion_core.h"
#include <cmath>
#include <cstdio>
#include <cstring>

using namespace hw;
static int failures = 0;
#define CHECK(c, ...) do { if (!(c)) { ++failures; std::printf("FAIL %s:%d ", __FILE__, __LINE__); std::printf(__VA_ARGS__); std::printf("\n"); } } while (0)

struct Plant {            // each axis follows its set-point with a 15 ms first-order lag (stepper + mechanism)
  float pos[AXES];
  bool stuck[AXES] = {};
  float stuckAt[AXES] = {};
  Plant() { for (int a = 0; a < AXES; ++a) pos[a] = MotionCore::eval(a, 0.f); }
  void step(const Outputs& o, float dt) {
    for (int a = 0; a < AXES; ++a) {
      if (stuck[a]) { pos[a] = fminf(o.target[a], stuckAt[a]); continue; }
      pos[a] += (o.target[a] - pos[a]) * fminf(1.f, dt / 0.015f);
    }
  }
};

struct Run { MotionCore m; Plant p; Inputs in{}; Outputs out{}; float prev[AXES]; float maxRatio[AXES] = {}; int holds = 0;
  Run() { std::memset(&in, 0, sizeof in); in.watchdogOk = in.powerOk = true; for (int a = 0; a < AXES; ++a) prev[a] = MotionCore::eval(a, 0.f); }
  void go(float seconds, float dt = 0.001f) {
    for (float s = 0; s < seconds; s += dt) {
      for (int a = 0; a < AXES; ++a) in.measured[a] = p.pos[a];
      m.tick(dt, in, out);
      if (m.state() == State::Holding) ++holds;
      for (int a = 0; a < AXES; ++a) { float v = fabsf(out.target[a] - prev[a]) / dt / AXIS_DEFS[a].vmax; if (v > maxRatio[a]) maxRatio[a] = v; prev[a] = out.target[a]; }
      p.step(out, dt);
    }
  }
};

int main() {
  // 1. full opening to HYPER: no faults, no interlock holds, every axis within its velocity limit
  { Run r; r.m.requestHyper(); r.go(6.0f);
    CHECK(r.m.state() == State::Hyper, "state %d", (int)r.m.state());
    CHECK(r.m.fault() == Fault::None, "fault %d", (int)r.m.fault());
    CHECK(r.holds == 0, "unexpected interlock holds %d (%s)", r.holds, r.m.lastInterlock());
    for (int a = 0; a < AXES; ++a) CHECK(r.maxRatio[a] <= 1.0f, "%s velocity %.2f x vmax", AXIS_DEFS[a].name, r.maxRatio[a]);
    std::printf("open->hyper   checked t=%.3f s\n", r.m.time());
    // 2. close from HYPER: every axis returns exactly to its stowed position
    r.m.requestClose(); r.go(6.5f);
    CHECK(r.m.state() == State::Closed, "close state %d", (int)r.m.state());
    for (int a = 0; a < AXES; ++a) CHECK(fabsf(r.p.pos[a] - MotionCore::eval(a, 0.f)) < 1e-3f, "%s not stowed (%.4f)", AXIS_DEFS[a].name, r.p.pos[a]);
    CHECK(r.holds == 0, "holds while closing %d (%s)", r.holds, r.m.lastInterlock());
    std::printf("hyper->closed checked\n"); }
  // 3. user changes their mind mid-opening: smooth reversal, no velocity spikes, ends closed
  { Run r; r.m.requestOpen(); r.go(1.3f); r.m.requestClose(); r.go(3.0f);
    CHECK(r.m.state() == State::Closed, "reversal state %d", (int)r.m.state());
    for (int a = 0; a < AXES; ++a) CHECK(r.maxRatio[a] <= 1.0f, "%s reversal velocity %.2f x vmax", AXIS_DEFS[a].name, r.maxRatio[a]);
    std::printf("reversal      checked\n"); }
  // 4. a hand under the canopy: pinch at 0.55 s -> fault, back-off, hold; no further opening until a new command
  { Run r; r.m.requestOpen(); r.go(0.55f); float before = r.out.target[CANOPY_DEG];
    r.in.pinch = true; r.go(0.02f); r.in.pinch = false; r.go(1.5f);
    CHECK(r.m.fault() == Fault::Pinch, "fault %d", (int)r.m.fault());
    CHECK(r.out.target[CANOPY_DEG] < before, "canopy did not back off (%.2f -> %.2f)", before, r.out.target[CANOPY_DEG]);
    float held = r.out.target[CANOPY_DEG]; r.go(1.0f);
    CHECK(fabsf(r.out.target[CANOPY_DEG] - held) < 1e-4f, "moved while faulted");
    r.m.requestClose(); r.go(3.0f);
    CHECK(r.m.state() == State::Closed, "did not close after pinch, state %d", (int)r.m.state());
    std::printf("pinch         checked backed off %.1f deg\n", before - held); }
  // 5. jammed canopy at 40 deg: following-error fault, and the keyboard tray / panel never move
  { Run r; r.p.stuck[CANOPY_DEG] = true; r.p.stuckAt[CANOPY_DEG] = 40.f; r.m.requestOpen(); r.go(5.0f);
    CHECK(r.m.fault() == Fault::FollowingError || r.m.fault() == Fault::Stall, "fault %d", (int)r.m.fault());
    CHECK(r.p.pos[TRAY_CAM] < 0.002f, "tray moved with canopy jammed (%.4f)", r.p.pos[TRAY_CAM]);
    CHECK(r.p.pos[PANEL_FRONT_MM] < 0.2f, "panel moved with canopy jammed");
    std::printf("jammed canopy checked safe stop at t=%.3f s\n", r.m.time()); }
  // 6. right speaker arm stalls (obstacle) while deploying: fault and retreat
  { Run r; r.m.requestHyper(); r.go(3.9f); r.in.stall[ARMR_LEN_MM] = true; r.go(0.01f); r.in.stall[ARMR_LEN_MM] = false; r.go(1.0f);
    CHECK(r.m.fault() == Fault::Stall, "fault %d", (int)r.m.fault());
    CHECK(r.m.time() < 3.9f, "did not retreat (t=%.3f)", r.m.time());
    std::printf("arm stall     checked\n"); }
  // 7. closing interlocks: canopy can never be commanded below 89 deg while a pod is out or the panel is up
  { int bad = 0; for (float t = 0; t <= SEQ_DURATION; t += 0.001f) {
      if (MotionCore::eval(CANOPY_DEG, t) < 89.f) {
        if (MotionCore::eval(ARML_LEN_MM, t) > 44.5f || MotionCore::eval(ARMR_LEN_MM, t) > 44.5f) ++bad;
        if (MotionCore::eval(PANEL_REAR_MM, t) > 0.5f || MotionCore::eval(TRAY_CAM, t) > 0.002f) ++bad; } }
    CHECK(bad == 0, "choreography violates closing interlocks at %d samples", bad);
    std::printf("plan interlocks checked\n"); }
  // 8. power loss: drivers disabled immediately, sequence frozen (lead screws, worms and canopy brake hold)
  { Run r; r.m.requestOpen(); r.go(2.0f); float t0 = r.m.time(); r.in.powerOk = false; r.go(0.5f);
    CHECK(!r.out.enable, "drivers still enabled"); CHECK(r.m.fault() == Fault::PowerLoss, "fault %d", (int)r.m.fault());
    CHECK(fabsf(r.m.time() - t0) < 0.02f, "sequence kept moving on power loss");
    std::printf("power loss    checked\n"); }
  std::printf(failures ? "\n%d FAILURE(S)\n" : "\nALL MOTION TESTS PASSED\n", failures);
  return failures ? 1 : 0;
}
