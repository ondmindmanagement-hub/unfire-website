/* Consent controls for direct /audio/ visitors. No third-party calls, no
   essential gameplay interference and no storage before a choice is made. */
(function (root) {
  'use strict';
  if (!root || !root.document) return;
  const doc = root.document;
  const KEY = 'unfire-cookie-consent';
  const es = (doc.documentElement && doc.documentElement.lang || '').toLowerCase().startsWith('es');
  const copy = es ? {
    manage: 'Privacidad', title: 'Tu privacidad',
    body: '¿Permites estadísticas básicas de uso de Unfire Audio? No guardamos tu nombre ni correo en estas métricas. Puedes cambiar tu elección cuando quieras.',
    accept: 'Aceptar estadísticas', reject: 'Rechazar', link: 'Política de cookies'
  } : {
    manage: 'Privacy', title: 'Your privacy',
    body: 'Allow basic Unfire Audio usage statistics? We do not store your name or email in these metrics. You can change your choice at any time.',
    accept: 'Accept analytics', reject: 'Reject', link: 'Cookie policy'
  };
  function choice() {
    try {
      const value = root.localStorage.getItem(KEY);
      return value === 'accepted' || value === 'rejected' ? value : null;
    } catch (_) { return null; }
  }
  let box;
  let manage;
  let panel;

  function style(el, value) { el.style.cssText = value; return el; }
  function text(tag, value) {
    const el = doc.createElement(tag);
    el.textContent = value;
    return el;
  }
  function refresh(showPanel) {
    if (!box) return;
    const decided = choice() !== null;
    panel.hidden = decided && !showPanel;
    manage.hidden = !decided;
    manage.setAttribute('aria-expanded', panel.hidden ? 'false' : 'true');
  }
  function decide(value) {
    try { root.localStorage.setItem(KEY, value); }
    catch (_) { return; } // Never emit acceptance on inaccessible storage.
    refresh(false);
    root.dispatchEvent(new root.Event('unfire:consent-updated'));
  }
  function init() {
    if (doc.getElementById('unfire-audio-privacy')) return;
    box = style(doc.createElement('aside'),
      'position:fixed;right:max(10px,env(safe-area-inset-right));bottom:max(10px,env(safe-area-inset-bottom));z-index:2147481000;max-width:min(360px,calc(100vw - 20px));font:12px/1.45 system-ui,-apple-system,sans-serif;color:#f3f6fd;pointer-events:none;text-align:right;');
    box.id = 'unfire-audio-privacy';
    box.setAttribute('aria-label', copy.title);

    panel = style(doc.createElement('section'),
      'box-sizing:border-box;background:#0c1424f5;border:1px solid #60799c;border-radius:15px;padding:14px;box-shadow:0 10px 36px #0009;pointer-events:auto;text-align:left;');
    panel.setAttribute('role','region');
    panel.setAttribute('aria-label', copy.title);
    panel.appendChild(style(text('strong',copy.title),'display:block;font-size:13px;margin-bottom:5px;'));
    panel.appendChild(style(text('p',copy.body),'margin:0 0 10px;color:#d7e0ed;'));
    const policy = text('a',copy.link);
    policy.href = '/cookies.html';
    policy.style.cssText = 'color:#8bc5ff;text-decoration:underline;display:inline-block;margin-bottom:10px;';
    panel.appendChild(policy);

    const actions = style(doc.createElement('div'),'display:flex;gap:8px;flex-wrap:wrap;');
    function action(label, handler, primary) {
      const button = style(text('button',label),
        'border:1px solid #7d94b1;border-radius:999px;padding:9px 12px;cursor:pointer;font:600 11px/1.3 system-ui;color:' +
        (primary ? '#061020' : '#f0f6ff') + ';background:' + (primary ? '#92d3ff' : '#223249') + ';');
      button.type = 'button';
      button.addEventListener('click',handler);
      return button;
    }
    actions.appendChild(action(copy.reject, () => decide('rejected'), false));
    actions.appendChild(action(copy.accept, () => decide('accepted'), true));
    panel.appendChild(actions);
    box.appendChild(panel);

    manage = style(action(copy.manage, () => refresh(panel.hidden), false),
      'margin-left:auto;margin-top:6px;border:1px solid #8ca0b7;border-radius:999px;padding:5px 9px;cursor:pointer;font:500 10px/1.25 system-ui;color:#e3edfb;background:#0b1424d9;opacity:.84;pointer-events:auto;');
    manage.setAttribute('aria-controls','unfire-audio-privacy-preferences');
    panel.id = 'unfire-audio-privacy-preferences';
    box.appendChild(manage);
    doc.body.appendChild(box);
    refresh(false);
  }

  root.UnfireAudioConsent = Object.freeze({
    choice: choice,
    open: () => { if (box) refresh(true); },
    // Exposed as a user-choice action; never changes preference automatically.
    revoke: () => decide('rejected')
  });
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded',init,{once:true});
  else init();
})(typeof window !== 'undefined' ? window : undefined);
