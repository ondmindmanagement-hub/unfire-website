# NANO robot — integration contract (Unfire Audio, 24 October 2026)

**Status: pure module and isolated tests, NOT wired into game-engine-v50.js.**
Owner of `audio/maletin/game-engine-v50.js`, `audio/maletin/index.html`,
`audio/index.html`, or `main` must integrate **serially** in PR #112
and rerun the combined CI; don't publish from this PR. No UI rewrite or
second game loop is introduced.

## User-facing behavior

- Normal robot and NANO robot: **1st-person / 2nd-person (over shoulder) /
  3rd-person (behind)** cycle, preserving location, heading and optional flying
  when switching. Existing `3pl` (distant third-person) can map to `3p`.
- Both robots walk, run, turn, jump/fly, hover, descend, land, swim where supported,
  interact with the world and freely cross house-door-island, except missions.
- NANO robot is **0.24 world units tall** (same as minis in briefcase) vs **10.5**
  for the full robot, but travel speed is not reduced by a literal 0.022857
  factor. Use `profile(true).speedScale` (~0.277) for traversable exploration
  while collision capsule, camera optics and gravity adapt separately.
- NANO may enter gaps unavailable to a full avatar. Walls remain solid,
  flying over real solid objects requires footY above collision top, and exit
  from any 3D briefcase orbit or camera inspection mode stays available.
- Robot modes are free exploration and **must not grant mission rewards**,
  increment chapter objectives, auto-start Nimbo or wipe story progress.
- If there is not enough space to return to the full size, keep NANO active,
  show a brief clear warning and let the user move or fly away.

## Required integration points (engine owner ONLY)

1. Load `nano-physics.js` **before** `game-engine-v50.js`, with the same atomic
   cache/version as host + iframe + modules (e.g. normal `<script src>` order,
   no `async` races). In the existing engine capture
   `const NP = window.UnfireNanoPhysics` and fail safely to the prior
   controls if the module is missing. This branch does not change any HTML.
2. Use `const P=NP.profile(ROAMS.mini)` in the **existing** update loop. Scale
   the visual avatar by `P.scale`; camera via
   `NP.cameraPose(ROAMS.mode,{x:ROAMS.p.x,z:ROAMS.p.z,
   footY:-8.9+(ROAMS.h||0),yaw:ROAMS.yaw,pitch:ROAMS.pitch,
   nano:ROAMS.mini},P)`. Make `ROAMS.mode` cycle
   `['3p','2p','1p']`. The **existing branch at line ~2591 has a definite bug**:
   `if (MODE !== '3p' && MODE !== '3pl' && MODE !== '1p')`
   incorrectly sends `1p` through third person; replace with explicit
   1p/2p/3p handling, and hide the visible avatar in 1p.
3. Replace the *physics part* of the existing `roamMove` with
   `NP.move2D({x:ROAMS.p.x,z:ROAMS.p.z},{x:dx,z:dz},
   candidateBoxes,P,{footY:-8.9+(ROAMS.h||0),prePadding:1.1})`,
   preserving existing game yaw/joystick/area boundary behavior. **Only use
   `prePadding:1.1` on boxes generated with 1.1 expansion**. Other raw
   colliders need `prePadding:0`. Avoid using every render mesh as a collider:
   reuse the current obstacle grid/broadphase. NEVER bypass obstacles after
   40 blocked frames (existing `stkN > 40` teleport escape): use physical
   sliding and spawn clearance. Use dt capped at 0.05 in the existing loop
   and 0.08-unit minimum microsteps for NANO to avoid tunnelling.
4. Normalized W/A/S/D/touch-stick direction via
   `NP.updateWalk(state,{x:worldDx,z:worldDz,run,slow},P,dt,
   {obstacles:candidates,footY,prePadding})`. It provides acceleration,
   braking and diagonal speed cap. Preserve hand-held controller bindings
   and target/camera rotation; don't double-apply `ROAMS.p` position.
5. For flight integrate `NP.updateVertical({h:ROAMS.h,vy:ROAMS.vy},
   {fly:ROAMS.fly,up:upPressed,down:downPressed,floor:groundHeight,
   ceiling:zoneCeiling},P,dt)`. Update `ROAMS.h`, `ROAMS.vy` from result.
   Floor/ceiling are **height above world baseline** matching the current
   `ROAMS.h` contract; the current game computes `fl` separately. When
   leaving the controls, flight hovers; when descending, it lands without
   crossing floor. Test regular/mini outside and indoors. Integrate real
   top surfaces and overhead clearance after conversion.
6. In `robotMode`, when activating NANO from the briefcase, first exit
   `CASE_VIEW.on` (call existing `showRobotView()`) and close any blocking
   panel; otherwise `CASE_VIEW.on` makes `K={}` in tick and movement is
   disabled. Keep the **same current world position**, don't reset to table
   coordinates. When growing to normal,
   `NP.safeMorphPosition(pos,NP.profile(false),boxes,{footY,prePadding})`
   must be safe; if not, defer growth rather than spawn through walls.
7. The current inside/outside door logic in `roamMove` must remain reachable
   in **both** sizes, including flying. Use the existing `ATM.setOut`
   transition and its portal, not teleport the robot to the maletín table.
   Existing `window.__RB` is expanded for the house in the room builder and
   outside on entering the island; don't reinstate old fallback `x:19.5`
   boundary while playing indoors.
8. Gate all `STORY` / `SIDE` objectives, per-quest timers and reward callbacks
   on free-play forms: `!ROAMS.mini` is not by itself sufficient when normal
   robot also is sandbox. Set a clear form flag and use
   `NP.missionsEnabled(form)`. Don't delete any saved mission progress.
   Existing Nimbo optional onboarding and chapter start remain unchanged.
9. Keep accessible controls for keyboard/touch/gamepad, label the current
   camera state, reset held keys on form toggle/blur, and prevent joysticks,
   map and camera buttons overlapping on phone in portrait or landscape.

## Existing bugs confirmed by static review of PR #112 at 2026-10-24 10:05 CEST

- `MODE === '1p'` does not actually take the first-person camera branch.
- `ROAMS.mode` offers 3p, 3pl and 1p, but lacks actual shoulder 2p.
- `roamMove` uses fixed-padded boxes, does not consider NANO radius, and
  contains `stkN > 40` collision bypass (possible wall tunnelling).
- `ROAMS.mini` is excluded from one indoor floor-top calculation and
  the mini speed multiplier `0.24/10.5` is too small for smooth traversal.
- `robotMode` doesn't clear briefcase `CASE_VIEW.on`, so the tick loop can
  have `K={}` and the camera remains in suitcase orbit.
- Several flight/camera clamps use full-sized assumptions; physics, zone
  bounds and camera need consistent world/local altitude units.
- Story reward guard for robot free-play requires explicit integration.

## Acceptance / release gate

- Desktop and phone/tablet portrait and landscape: click NANO in settings,
  enter free play immediately, walk outside the table and reach house door;
  traverse interior, tiny crevices and island; return to full size safely.
- Cycle **3p -> 2p -> 1p -> 3p** in each form, keyboard C and mobile button;
  verify actual pose/visibility/camera no wall penetration or shaking.
- Walk/run with acceleration, diagonal input normalization and stable frame
  delta; sprint along walls and through a micro-door without ghosting.
- Hold flight, release hover, descend/land; fly through a high passage; never
  leave island/collision bounds, spawn below floors or clip ceilings.
- Leave/return to briefcase and main UI; reload/restore camera+form state;
  no mission progression in free-play, but normal story missions unaffected.
- Validate frame time, FPS and collision tolerance after scale changes, P2P
  connections, device rotation, release SHA/CI and **physical** mobile devices.
- **No merge to main / no GitHub Pages release** unless all mandatory checks pass.
