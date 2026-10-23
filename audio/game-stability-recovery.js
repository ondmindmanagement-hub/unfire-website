/* Unfire Audio: fail-safe for silent frame stalls, independent of the WebGL engine.
   A stalled renderer is not the same as a slow GPU; never reload a live game.
   This runs in the host page, not in the potentially stalled iframe. */
(() => {
  'use strict';
  const frame = document.getElementById('malFrame');
  const pin = document.getElementById('heroPin');
  if (!frame || !pin) return;

  const STARTUP_GRACE_MS = 20000;
  const STALL_MS = 13000;
  let activeSince = 0;
  let lastProgress = 0;
  let lastFrame = null;
  let warning = null;
  let retries = 0;

  function hide() {
    if (warning) warning.style.display = 'none';
  }
  function reset() {
    activeSince = 0;
    lastProgress = 0;
    lastFrame = null;
    hide();
  }
  function active() {
    // Background throttling, navigation, scene loading and the corporate site
    // are NOT evidence of a freeze.
    return !document.hidden && !!frame.src &&
      pin.classList.contains('imm') && pin.classList.contains('scene-ready');
  }
  function counter() {
    try {
      const v = frame.contentWindow?.__perf?.f;
      return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;
    } catch (_) {
      return null;
    }
  }
  function recover() {
    if (retries >= 2) return;
    retries++;
    reset();
    // An explicit user action, never an unattended loop. The normal game
    // loader also preserves the coordinated frame / engine cache version.
    try {
      if (typeof UNFIRE_SCENE === 'object' &&
          typeof UNFIRE_SCENE.start === 'function') {
        UNFIRE_SCENE.start(true); // compact quality + fresh iframe
        return;
      }
    } catch (_) {}
    // Fail closed; do not navigate away and lose an in-memory session.
    show('No se pudo iniciar la recuperación. Puedes volver a la web y reabrir el juego.');
  }
  function show(message) {
    if (!warning) {
      const box = document.createElement('section');
      box.id = 'unfireStallRecovery';
      box.setAttribute('role', 'alert');
      box.setAttribute('aria-live', 'assertive');
      box.style.cssText = 'position:fixed;z-index:2147483000;left:50%;bottom:max(18px,env(safe-area-inset-bottom));transform:translateX(-50%);width:min(92vw,380px);box-sizing:border-box;padding:16px;border-radius:16px;border:1px solid #7bdcff;background:#071629f5;color:#fff;font:500 14px/1.5 system-ui;text-align:center;box-shadow:0 12px 34px #000b';
      const p = document.createElement('p');
      p.textContent = 'Los gráficos han dejado de actualizarse. Puedes intentar reabrirlos en modo ligero. Es posible que se reinicie la escena actual.';
      p.style.margin = '0 0 10px';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = 'RECUPERAR GRÁFICOS';
      btn.style.cssText = 'min-height:44px;border:1px solid #a6eaff;border-radius:12px;background:#135089;color:white;font:700 13px system-ui;padding:10px 16px;cursor:pointer';
      btn.addEventListener('click', recover);
      box.appendChild(p);
      box.appendChild(btn);
      document.body.appendChild(box);
      warning = box;
    }
    warning.style.display = 'block';
    if (message) {
      warning.firstChild.textContent = message;
      warning.lastChild.disabled = true;
      warning.lastChild.style.display = 'none';
    } else if (retries >= 2) {
      warning.firstChild.textContent = 'El modo ligero también se ha detenido. Para proteger tu sesión, no se volverá a recargar automáticamente.';
      warning.lastChild.disabled = true;
      warning.lastChild.style.display = 'none';
    }
  }
  function tick() {
    if (!active()) { reset(); return; }
    const now = performance.now();
    const frameCount = counter();
    if (!activeSince) {
      activeSince = now;
      lastProgress = now;
      lastFrame = frameCount;
      return;
    }
    if (frameCount !== null && frameCount !== lastFrame) {
      lastFrame = frameCount;
      lastProgress = now;
      hide();
      return;
    }
    if (now - activeSince >= STARTUP_GRACE_MS &&
        now - lastProgress >= STALL_MS) show();
  }

  frame.addEventListener('load', reset);
  document.addEventListener('visibilitychange', () => { if (document.hidden) reset(); });
  addEventListener('pagehide', reset);
  addEventListener('pageshow', reset);
  // The watchdog does no work per rendered frame. No new WebGL context is created.
  setInterval(tick, 2500);
})();
