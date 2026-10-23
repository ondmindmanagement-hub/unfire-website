/* UNFIRE Audio — lightweight cinematic doorway transition.
 * Visual feedback only: never changes game physics, saves, or navigation.
 * The existing scene remains interactive; no fake progress or blocking overlay.
 */
(function initUnfireDoorCinema(root) {
  'use strict';
  if (root.UNFIRE_DOOR_CINEMA) return;
  const DUR = 580;
  let surface = null, cleanupTimer = null, sequence = 0;

  function actualDoorCross(a) {
    if (!a || typeof a !== 'object') return false;
    if (!a.on || a.mini || a.fly || !!a.next === !!a.previous) return false;
    if (![a.x, a.z].every(Number.isFinite)) return false;
    // Real walking doorway is at x=-30, z=93. Teleportation, dome/flight,
    // developer outside switch and scripted mission jumps must not trigger FX.
    return Math.abs(a.x + 30) < 5.5 && a.z > 88 && a.z < 99;
  }

  function createSurface() {
    if (surface && surface.isConnected) return surface;
    if (!root.document || !root.document.body || !root.document.head) return null;
    if (!root.document.getElementById('unfireDoorCinemaStyles')) {
      const css = root.document.createElement('style');
      css.id = 'unfireDoorCinemaStyles';
      css.textContent = [
        '#unfireDoorCinema{position:fixed;inset:0;z-index:59;pointer-events:none;',
        'overflow:hidden;contain:layout paint style;visibility:hidden;opacity:0}',
        '#unfireDoorCinema .doorPanel{position:absolute;top:-2%;bottom:-2%;width:51%;',
        'opacity:0;background:linear-gradient(90deg,',
        'rgba(4,11,23,.92),rgba(15,37,60,.72));}',
        '#unfireDoorCinema .doorPanel.left{left:0;transform:translate3d(-103%,0,0);',
        'border-right:1px solid rgba(159,214,255,.23)}',
        '#unfireDoorCinema .doorPanel.right{right:0;transform:translate3d(103%,0,0);',
        'background:linear-gradient(270deg,rgba(4,11,23,.92),rgba(15,37,60,.72));',
        'border-left:1px solid rgba(159,214,255,.23)}',
        '#unfireDoorCinema .doorLight{position:absolute;inset:0;opacity:0;',
        'background:linear-gradient(90deg,transparent 39%,rgba(140,219,255,.28) 50%,transparent 61%);',
        'transform:translateZ(0)}',
        '#unfireDoorCinema.play .doorPanel,#unfireDoorCinema.play .doorLight{will-change:transform,opacity}',
        '#unfireDoorCinema.play{visibility:visible;opacity:1}',
        '#unfireDoorCinema.play .left{animation:unfireDoorLeft 560ms cubic-bezier(.24,.8,.31,1) both}',
        '#unfireDoorCinema.play .right{animation:unfireDoorRight 560ms cubic-bezier(.24,.8,.31,1) both}',
        '#unfireDoorCinema.play .doorLight{animation:unfireDoorLight 560ms ease-out both}',
        '#unfireDoorCinema[data-direction="inside"] .doorLight{transform:scaleX(-1)}',
        '@keyframes unfireDoorLeft{0%{opacity:0;transform:translate3d(-103%,0,0)}',
        '25%{opacity:.85}49%{opacity:1;transform:translate3d(0,0,0)}',
        '76%{opacity:.55}100%{opacity:0;transform:translate3d(-103%,0,0)}}',
        '@keyframes unfireDoorRight{0%{opacity:0;transform:translate3d(103%,0,0)}',
        '25%{opacity:.85}49%{opacity:1;transform:translate3d(0,0,0)}',
        '76%{opacity:.55}100%{opacity:0;transform:translate3d(103%,0,0)}}',
        '@keyframes unfireDoorLight{0%,28%,100%{opacity:0}48%{opacity:1}65%{opacity:.2}}',
        '@media(prefers-reduced-motion:reduce){#unfireDoorCinema.play .doorPanel{animation:none;opacity:0}',
        '#unfireDoorCinema.play .doorLight{animation:unfireDoorGentle 120ms ease-out both}',
        '@keyframes unfireDoorGentle{0%,100%{opacity:0}50%{opacity:.16}}}'
      ].join('');
      root.document.head.appendChild(css);
    }
    surface = root.document.createElement('div');
    surface.id = 'unfireDoorCinema';
    surface.setAttribute('aria-hidden', 'true');
    surface.innerHTML = '<span class="doorPanel left"></span><span class="doorPanel right"></span><span class="doorLight"></span>';
    root.document.body.appendChild(surface);
    return surface;
  }

  function reset() {
    sequence++;
    if (cleanupTimer !== null) { root.clearTimeout(cleanupTimer); cleanupTimer = null; }
    if (surface) {
      surface.classList.remove('play');
      surface.removeAttribute('data-direction');
    }
  }
  function cross(a) {
    if (!actualDoorCross(a) || root.document?.hidden) return false;
    const el = createSurface();
    if (!el) return false;
    reset();
    el.dataset.direction = a.next ? 'outside' : 'inside';
    // Tiny overlay-only layout flush restarts the same GPU-composited animation
    // when the player quickly crosses both ways, never reflowing the 3D canvas.
    void el.offsetWidth;
    el.classList.add('play');
    const ticket = sequence;
    cleanupTimer = root.setTimeout(function() {
      if (ticket === sequence) reset();
    }, DUR);
    return true;
  }
  if (root.document) root.document.addEventListener('visibilitychange', function() {
    if (root.document.hidden) reset();
  }, {passive:true});
  if (root.addEventListener) root.addEventListener('pagehide', reset, {passive:true});
  root.UNFIRE_DOOR_CINEMA = Object.freeze({cross, reset, actualDoorCross, duration:DUR});
})(window);
