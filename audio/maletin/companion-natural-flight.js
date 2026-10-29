/* UNFIRE — delayed autonomous follower flight. No timers, physics loops or network calls. */
(() => {
  'use strict';
  function step(s, o) {
    const dt = Math.min(0.08, Math.max(0, Number(o.dt) || 0));
    const id = Math.max(0, Number(o.index) || 0);
    const fly = !!o.flying;
    const nano = !!o.nano;
    s.t = (s.t || 0) + dt;
    if (s.intent !== fly) {
      s.intent = fly;
      // Each robot reacts at a different moment, never in lockstep with the player.
      s.wait = (fly ? 0.75 : 0.55) + (id % 5) * 0.41 + (nano ? 0.7 : 0);
    }
    s.wait = Math.max(0, (s.wait || 0) - dt);
    if (s.wait === 0) s.active = fly;
    const alt = Math.max(0, Math.min(8000, Number(o.height) || 0));
    const fraction = Math.max(0.05, Math.min(0.75, Number(o.follow) || 0.36));
    const maxLift = Math.max(0, Number(o.maxLift) || 10);
    const offset = 0.5 + (id % 4) * 0.8;
    const target = s.active ? Math.min(maxLift, Math.max(1.3, alt * fraction + offset) * (nano ? 0.26 : 1)) : 0;
    const speed = target > (s.lift || 0) ? 3.8 + id % 3 : 2.2 + id % 2;
    const response = 1 - Math.exp(-dt * (target > (s.lift || 0) ? 1.1 : 0.82));
    const diff = (target - (s.lift || 0)) * response;
    s.lift = Math.max(0, (s.lift || 0) + Math.max(-speed * dt, Math.min(speed * dt, diff)));
    // Their own idle flight cycle, not a time-locked copy of the player.
    const bob = s.lift > 0.08 ? Math.sin(s.t * (0.8 + (id % 4) * 0.12) + id * 1.91) * Math.min(0.3, s.lift * 0.14) : 0;
    return { height: Math.max(0, s.lift + bob), flying: s.lift > 0.3 };
  }
  window.UNFIRE_COMPANION_FLIGHT = Object.freeze({ step });
})();
