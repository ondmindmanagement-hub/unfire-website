#include "motion_core.h"
#include <math.h>

namespace hw {

constexpr float MotionCore::FOLLOW_TOL[AXES];

static float profile(Profile p, float u) {
  if (u <= 0.f) return 0.f;
  if (u >= 1.f) return 1.f;
  switch (p) {
    case MJ:  return u * u * u * (u * (u * 6.f - 15.f) + 10.f);   // minimum jerk: zero vel & acc at both ends
    case DEC: { float v = 1.f - u; return 1.f - v * v * v; }       // decelerating, zero end velocity
    default:  return u;
  }
}

float MotionCore::eval(int axis, float t) {
  const AxisDef& d = AXIS_DEFS[axis];
  if (d.seg) {
    float v = d.seg[0].a;
    for (int i = 0; i < d.nseg; ++i) {
      const Seg& s = d.seg[i];
      if (t <= s.t0) return v;
      if (t < s.t1) return s.a + (s.b - s.a) * profile(s.p, (t - s.t0) / (s.t1 - s.t0));
      v = s.b;
    }
    return v;
  }
  if (t <= d.tab[0].t) return d.tab[0].v;
  for (int i = 1; i < d.ntab; ++i)
    if (t <= d.tab[i].t) { const Pt& a = d.tab[i - 1]; const Pt& b = d.tab[i]; return a.v + (b.v - a.v) * (t - a.t) / (b.t - a.t); }
  return d.tab[d.ntab - 1].v;
}

void MotionCore::requestOpen()  { if (fault_ != Fault::None) fault_ = Fault::None; goal_ = T_OPEN; state_ = t_ < goal_ ? State::Opening : State::Closing; }
void MotionCore::requestHyper() { if (fault_ != Fault::None) fault_ = Fault::None; goal_ = SEQ_DURATION; state_ = State::Opening; }
void MotionCore::requestClose() { if (fault_ != Fault::None) fault_ = Fault::None; goal_ = 0.f; state_ = State::Closing; }

static bool cmp(float v, char op, float thr) {
  switch (op) { case '>': return v > thr; case '<': return v < thr; default: return false; }
}
static bool gcmp(float v, char op, float thr) { return op == '>' ? v >= thr - 1e-4f : v <= thr + 1e-4f; }

// Every interlock: if the guarded axis is commanded beyond its threshold, the guard axis must be
// MEASURED at a safe position. Using measured guards means a jammed canopy can never let the panel rise.
bool MotionCore::interlocksOk(float t, const char** why) const {
  for (int i = 0; i < NINTERLOCKS; ++i) {
    const Interlock& k = INTERLOCKS[i];
    if (cmp(eval(k.axis, t), k.op, k.thr) && !gcmp(measuredCache_[k.guard], k.gop, k.gthr)) { *why = k.why; return false; }
  }
  return true;
}

void MotionCore::tick(float dt, const Inputs& in, Outputs& out) {
  for (int a = 0; a < AXES; ++a) measuredCache_[a] = in.measured[a];
  out.enable = in.powerOk;
  out.latchRelease = (state_ == State::Opening && t_ < 0.4f);

  // --- fault detection ---------------------------------------------------------------
  if (fault_ == Fault::None) {
    if (!in.powerOk) fault_ = Fault::PowerLoss;
    else if (!in.watchdogOk) fault_ = Fault::Watchdog;
    else if (in.pinch) fault_ = Fault::Pinch;
    else for (int a = 0; a < AXES; ++a) {
      if (in.stall[a]) { fault_ = Fault::Stall; break; }
      if (fabsf(in.measured[a] - eval(a, t_)) > FOLLOW_TOL[a]) { fault_ = Fault::FollowingError; break; }
    }
    if (fault_ == Fault::PowerLoss) rate_ = 0.f;  // drives are off: freeze the time base at once
    if (fault_ != Fault::None) { backoff_ = (fault_ == Fault::Pinch || fault_ == Fault::Stall) ? 0.35f : 0.f; backDir_ = rate_ >= 0.f ? -1.f : 1.f; state_ = State::Fault; }
  }

  float desired;
  if (fault_ != Fault::None) {
    // pinch/stall: reverse gently for 0.35 s to release whatever is caught, then hold and wait for a new command
    if (backoff_ > 0.f) { desired = backDir_ * 0.6f; backoff_ -= dt; } else desired = 0.f;
  } else {
    const float dist = goal_ - t_;
    const float stop = rate_ * rate_ / (2.f * RATE_ACCEL);           // distance needed to stop smoothly
    desired = fabsf(dist) < 1e-4f ? 0.f : (dist > 0.f ? 1.f : -1.f);
    if (desired != 0.f && fabsf(dist) <= stop && rate_ * desired > 0.f) desired = 0.f;  // start braking in time
  }
  // rate-limited time base: no velocity steps on any axis, even on an instant reversal
  const float maxd = (fault_ != Fault::None ? RATE_ACCEL_FAULT : RATE_ACCEL) * dt;
  float nr = rate_ + fmaxf(-maxd, fminf(maxd, desired - rate_));
  float nt = t_ + nr * dt;
  if (nt < 0.f) { nt = 0.f; nr = 0.f; }
  if (nt > SEQ_DURATION) { nt = SEQ_DURATION; nr = 0.f; }

  const char* why = "";
  if (fault_ == Fault::None && !interlocksOk(nt, &why)) {  // hold position until the guard axis catches up
    why_ = why; nr = 0.f; nt = t_; state_ = State::Holding;
  } else {
    rate_ = nr; t_ = nt;
    if (fault_ == Fault::None) {
      if (fabsf(goal_ - t_) < 2e-3f && fabsf(rate_) < 0.05f) { t_ = goal_; rate_ = 0.f; state_ = goal_ == 0.f ? State::Closed : (goal_ >= SEQ_DURATION ? State::Hyper : State::Open); }
      else state_ = rate_ >= 0.f ? State::Opening : State::Closing;
    }
  }
  for (int a = 0; a < AXES; ++a) out.target[a] = eval(a, t_);
}

}  // namespace hw
