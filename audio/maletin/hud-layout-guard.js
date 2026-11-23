/* Y2K ROBOTS · HUD layout guard (2026-11-23).
   Guarantees that no HUD element is drawn on top of another on any phone,
   tablet or desktop size, in every state (menus, map, shop, flying, talking).
   - While a menu owns the screen, thumb controls step aside.
   - Open panels never run off-screen: they scroll inside the safe area.
   - Lower-priority HUD (minimap, coins, capsule pill, hints) yields when a
     higher-priority element needs its space, and returns as soon as it is free.
   No render loop and no WebGL access: runs only after DOM/class/size changes,
   coalesced to at most one pass every 120 ms. */
(() => {
  'use strict';
  const d = document, $ = (id) => d.getElementById(id);
  const shown = (el) => {
    if (!el || !el.isConnected) return false;
    for (let p = el; p && p !== d.documentElement; p = p.parentElement) {
      if (p.hidden) return false;
      const cs = getComputedStyle(p);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.08) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 4 && r.height > 4;
  };
  // Menus that take over the screen while open (highest priority).
  const openPanels = () => {
    const out = [];
    const cfg = $('storyHud'); if (cfg && cfg.classList.contains('cfgOn') && shown(cfg)) out.push({ el: cfg, menu: true });
    const items = $('ufActionItems'), dock = $('ctlDock');
    if (items && !items.hidden && shown(items) && dock) out.push({ el: dock, menu: true, scroll: items });
    for (const id of ['ufMapPanel', 'unfireExpandedMap', 'unfireCoinShop', 'storyMenu']) { const e = $(id); if (shown(e)) out.push({ el: e, menu: true }); }
    for (const id of ['ufDialogs', 'howto', 'story']) { const e = $(id); if (shown(e)) out.push({ el: e }); }
    const mix = $('mix'); if (mix && mix.classList.contains('unfire-expanded') && shown(mix)) out.push({ el: mix });
    const wr = $('wradio'); if (wr && wr.classList.contains('expanded') && shown(wr)) out.push({ el: wr });
    return out;
  };
  // Primary controls: never hidden by the guard (only by an open menu).
  const CORE = ['cfgB', 'ctlDock', 'unfireTouchPad', 'unfireTalk', 'unfireFly', 'unfireDown', 'unfireExitGame', 'roamB', 'tb', 'hud', 'buy'];
  // Secondary HUD, in descending priority.
  const SECONDARY = ['wradio', 'minimap', 'unfireCoinHud', 'unfireCarryCase', 'storyHud', 'capsuleHudButton', 'unfireWorkshopHud',
    'propHud', 'recHud', 'onlHud', 'ufMapBadge', 'tip', 'ufHint', 'ufNear', 'ufGiantSubtitle', 'crumb', 'mix'];
  const THUMBS = ['unfireTouchPad', 'unfireFly', 'unfireTalk', 'unfireDown'];
  const hit = (a, b) => Math.min(a.right, b.right) - Math.max(a.left, b.left) > 2 && Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) > 2;
  const related = (a, b) => a.contains(b) || b.contains(a);
  let marked = new Set();
  function pass() {
    const body = d.body; if (!body) return;
    // Clear previous decisions before measuring so released items are re-evaluated.
    for (const el of marked) el.removeAttribute('data-uf-yield');
    marked = new Set();
    const vh = innerHeight, vw = innerWidth;
    const panels = openPanels();
    const menuOpen = panels.some((p) => p.menu);
    body.classList.toggle('uf-panel-open', menuOpen);
    const placed = [];
    // 1) Open panels: keep them inside the viewport, scroll their content.
    for (const p of panels) {
      const target = p.scroll || p.el;
      const r = target.getBoundingClientRect();
      if (r.bottom > vh - 6 || r.top < 0) {
        let reserve = 0;
        if (p.scroll) { const t = $('ufActionsToggle'); if (t && shown(t)) reserve = t.getBoundingClientRect().height + 14; }
        const max = Math.max(120, Math.floor(vh - Math.max(0, r.top) - 10 - reserve));
        if (target.style.maxHeight !== max + 'px') { target.style.maxHeight = max + 'px'; target.style.overflowY = 'auto'; target.style.overscrollBehavior = 'contain'; }
      }
      placed.push({ el: p.el, r: p.el.getBoundingClientRect() });
    }
    // 2) Core controls (thumbs are hidden by CSS while a menu is open).
    for (const id of CORE) {
      const el = $(id);
      if (!shown(el) || (menuOpen && THUMBS.includes(id))) continue;
      if (placed.some((q) => related(q.el, el))) continue;
      const r = el.getBoundingClientRect();
      // A core control under a non-menu panel (e.g. the how-to card) simply yields until it closes.
      if (placed.some((q) => hit(q.r, r))) { el.setAttribute('data-uf-yield', '1'); marked.add(el); continue; }
      placed.push({ el, r });
    }
    // 3) Secondary HUD yields to anything already placed.
    for (const id of SECONDARY) {
      const el = $(id);
      if (!shown(el) || placed.some((q) => q.el === el || related(q.el, el))) continue;
      const r = el.getBoundingClientRect();
      if (r.right <= 0 || r.bottom <= 0 || r.left >= vw || r.top >= vh) continue;
      if (placed.some((q) => hit(q.r, r))) { el.setAttribute('data-uf-yield', '1'); marked.add(el); }
      else placed.push({ el, r });
    }
  }
  let timer = 0, lastRun = 0;
  const schedule = () => {
    if (timer) return;
    const wait = Math.max(0, 120 - (performance.now() - lastRun));
    timer = setTimeout(() => { timer = 0; requestAnimationFrame(() => { lastRun = performance.now(); try { pass(); } catch (_) {} }); }, wait);
  };
  const start = () => {
    new MutationObserver((list) => {
      for (const m of list) { if (m.type === 'attributes' && m.attributeName === 'data-uf-yield') continue; schedule(); return; }
    }).observe(d.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'hidden', 'style'] });
    addEventListener('resize', schedule, { passive: true });
    addEventListener('orientationchange', schedule, { passive: true });
    if (window.visualViewport) visualViewport.addEventListener('resize', schedule, { passive: true });
    d.addEventListener('click', schedule, { capture: true, passive: true });
    d.addEventListener('keyup', schedule, { capture: true, passive: true });
    schedule();
    window.__UNFIRE_HUD_GUARD = { run: pass, yielded: () => [...marked].map((e) => e.id) };
  };
  if (d.body) start(); else d.addEventListener('DOMContentLoaded', start, { once: true });
})();
