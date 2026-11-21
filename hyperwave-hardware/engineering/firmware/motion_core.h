// Hyperwave 2000 — motion core (hardware-independent).
// Plays the 12-axis choreography forwards (open) or backwards (close), can reverse at any instant,
// enforces interlocks on every tick and reacts to faults (stall, pinch, following error, watchdog).
// Hardware glue (TMC5160 SPI drivers, encoders, pinch strips) lives outside this file.
#pragma once
#include "choreography.h"

namespace hw {

enum class State : uint8_t { Closed, Opening, Open, Hyper, Closing, Holding, Fault };
enum class Fault : uint8_t { None, Stall, Pinch, FollowingError, Interlock, Watchdog, PowerLoss };

struct Inputs {
  float measured[AXES];   // encoder positions in axis units
  bool stall[AXES];       // driver StallGuard flags
  bool pinch;             // capacitive / force pinch strip on canopy and panel edges
  bool watchdogOk;        // heartbeat from the audio host
  bool powerOk;           // supply above brown-out threshold
};

struct Outputs {
  float target[AXES];     // position set-points for this tick
  bool enable;            // drivers enabled
  bool latchRelease;      // canopy latch solenoid
};

class MotionCore {
 public:
  static float eval(int axis, float t);           // commanded position of an axis at sequence time t
  void requestOpen();                              // to "Open" (T = 3)
  void requestHyper();                             // to "Hyper" (T = 4, full sequence)
  void requestClose();                             // back to closed (t = 0)
  void tick(float dt, const Inputs& in, Outputs& out);
  State state() const { return state_; }
  Fault fault() const { return fault_; }
  float time() const { return t_; }
  const char* lastInterlock() const { return why_; }

  static constexpr float T_OPEN = 3.0f / 0.85f;   // sequence time of the "open" pose
  static constexpr float FOLLOW_TOL[AXES] = {6.0f, 0.04f, 14.0f, 4.5f, 4.0f, 1.5f, 4.0f, 2.0f, 8.0f, 4.0f, 2.0f, 8.0f};  // ≈ 1.5 × (15 ms × vmax) + margin
  static constexpr float RATE_ACCEL = 4.0f;       // normal |d(rate)/dt|: a reversal takes 0.5 s, no velocity steps
  static constexpr float RATE_ACCEL_FAULT = 24.0f; // pinch / stall: stop within ~45 ms, then back off

 private:
  bool interlocksOk(float t, const char** why) const;
  float t_ = 0.f, rate_ = 0.f, goal_ = 0.f;
  State state_ = State::Closed;
  Fault fault_ = Fault::None;
  const char* why_ = "";
  float measuredCache_[AXES] = {};
  float backoff_ = 0.f, backDir_ = 0.f;
};

}  // namespace hw
