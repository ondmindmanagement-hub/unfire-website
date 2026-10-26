/* UNFIRE — Bailes del robot (J), baile automático al estar quieto y frases ambientales al estilo GTA.
 * - J abre/cierra el selector de bailes (1–7 o clic). Moverte, volar o saltar detiene el baile.
 * - Si tu robot lleva 19 s quieto, se pone a bailar solo y suelta una frase que insinúa algo del mundo.
 * - Cuando bailas un rato, ARI, GEMI y LEO se acercan y bailan contigo (y luego vuelven a lo suyo).
 * Sin bucles de red, sin estado guardado salvo el último baile elegido. Funciona también en NANO ROBOT.
 */
(() => {
  'use strict';
  if (window.UnfireIdleDance) return;
  const IDLE_SECONDS = 19;
  const STYLES = [
    { id: 'clasico', name: 'CLÁSICO', icon: '🕺', act: 'dance' },
    { id: 'robot', name: 'ROBOT', icon: '🤖', act: 'dance', snap: true },
    { id: 'dj', name: 'DJ', icon: '🎧', act: 'play', nod: true },
    { id: 'fiesta', name: 'FIESTA', icon: '🎉', act: 'cheer', hop: true },
    { id: 'giro', name: 'GIRO', icon: '🌀', act: 'dance', spin: true },
    { id: 'saludo', name: 'OLA', icon: '👋', act: 'wave', sway: true },
    { id: 'boxeo', name: 'BOXEO', icon: '🥊', act: 'fight', bounce: true },
  ];
  const S = { on: false, auto: false, style: 0, t: 0, idle: 0, picker: false, joinT: 0, bubble: null, lastLine: -1, said: 0, joined: [], lastInput: 0 };
  try { const s = +localStorage.getItem('unfire_dance_style'); if (Number.isInteger(s) && s >= 0 && s < STYLES.length) S.style = s; } catch (_) {}

  const R = () => window.__roamAPI && window.__roamAPI.ROAMS;
  const REC = () => window.__REC;
  const THREE = () => window.THREE;

  // ---------- frases ambientales (sutiles, como en GTA) ----------
  const LINES = {
    inside: [
      'Dicen que la cúpula se abre si vuelas justo por debajo… habrá que comprobarlo.',
      'Ese maletín de la mesa no para de vibrar. Algo quiere salir de ahí.',
      'Ari ha vuelto a contar los cuadros. Dice que hay uno más que ayer.',
      'Si me hiciera pequeño, igual cabía por sitios donde nadie mira…',
      'La radio está rara hoy. Como si quisiera que alguien la escuchara.',
      '¿Y si invito a alguien? En el modo online seguro que hay fiesta.',
      'Esa máquina de cápsulas me mira. Creo que me debe una sorpresa.',
      'Nimbo dice que fuera, en la isla, pasan cosas que aquí no se oyen.',
    ],
    outside: [
      'El mar hoy está para surfear… con tabla, claro.',
      'Esos titanes del horizonte… ¿se están acercando o me lo parece?',
      'Desde las nubes se tiene que ver toda la isla.',
      'Huele a tormenta. Y a un bajo de 808 muy lejos.',
      'Alguien ha montado un escenario por ahí. Se oye desde aquí.',
      'Las ballenas vuelan bajo hoy. Eso es que va a pasar algo.',
    ],
    nano: [
      'Desde aquí abajo, la casa parece una ciudad entera.',
      'Ni las motas de polvo me toman en serio.',
      'Si alguien pisa fuerte, salgo volando. Literalmente.',
      'Seguro que hay secretos que solo se ven desde este tamaño.',
    ],
    join: ['¡Fiesta sin avisar! Me apunto.', 'Si bailas tú, bailamos todos.', 'Esto en la azotea sonaría el doble de bien.', 'Vale, pero yo llevo el ritmo.'],
  };
  const LINES_EN = {
    inside: ['They say the dome opens if you fly right under it… worth checking.', "That case on the table won't stop buzzing. Something wants out.", 'Ari counted the paintings again. She says there is one more than yesterday.', 'If I got tiny, maybe I could fit where nobody looks…', 'The radio is acting strange today. Like it wants someone to listen.', 'What if I invite someone? Online mode is bound to be a party.', 'That capsule machine keeps staring at me. I think it owes me a surprise.', 'Nimbo says that out on the island, things happen that you cannot hear in here.'],
    outside: ['The sea is perfect for surfing today… with a board, of course.', 'Those titans on the horizon… are they getting closer, or is it just me?', 'From the clouds you must be able to see the whole island.', 'Smells like a storm. And an 808 bass far, far away.', 'Someone has built a stage out there. You can hear it from here.', 'The whales are flying low today. Something is about to happen.'],
    nano: ['From down here, the house looks like an entire city.', 'Not even the dust specks take me seriously.', 'If anyone stomps, I go flying. Literally.', 'I bet there are secrets you can only see at this size.'],
    join: ['Surprise party! Count me in.', 'If you dance, we all dance.', 'This would sound twice as good on the roof.', 'Fine, but I keep the beat.'],
  };
  const EN = window.__LANG === 'en';
  if (EN) { Object.assign(LINES, LINES_EN); const NM = { clasico: 'CLASSIC', fiesta: 'PARTY', giro: 'SPIN', saludo: 'WAVE', boxeo: 'BOXING' }; STYLES.forEach((s) => { if (NM[s.id]) s.name = NM[s.id]; }); }
  const pick = (arr) => { let i = Math.floor(Math.random() * arr.length); if (arr.length > 1 && i === S.lastLine) i = (i + 1) % arr.length; S.lastLine = i; return arr[i]; };

  // ---------- burbuja de texto sobre tu robot ----------
  function bubble() {
    if (S.bubble) return S.bubble;
    const T = THREE(); if (!T) return null;
    const c = document.createElement('canvas'); c.width = 640; c.height = 170;
    const tx = new T.CanvasTexture(c);
    const sp = new T.Sprite(new T.SpriteMaterial({ map: tx, transparent: true, depthWrite: false, depthTest: false }));
    sp.renderOrder = 30; sp.visible = false;
    S.bubble = { c, tx, sp, t: 0, added: false };
    return S.bubble;
  }
  function speak(text) {
    const B = bubble(); const r = R(); if (!B || !r || !r.av || !r.av.w) return;
    if (!B.added) { let sc = r.av.w; while (sc.parent) sc = sc.parent; sc.add(B.sp); B.added = true; }
    const g = B.c.getContext('2d'); g.clearRect(0, 0, 640, 170);
    g.fillStyle = 'rgba(255,255,255,.95)'; g.strokeStyle = '#6a5cff'; g.lineWidth = 6;
    g.beginPath(); g.roundRect ? g.roundRect(4, 4, 632, 150, 26) : g.rect(4, 4, 632, 150); g.fill(); g.stroke();
    g.fillStyle = '#6a5cff'; g.font = '900 22px Orbitron, Arial';
    let me = 'TÚ'; try { me = (window.__STORYNAME && window.__STORYNAME()) || 'TÚ'; } catch (_) {}
    g.fillText(String(me).toUpperCase(), 22, 34);
    g.fillStyle = '#0a1a3a'; g.font = 'italic 600 23px Arial';
    let line = '', y = 68; for (const w of text.split(' ')) { if (g.measureText(line + w).width > 590) { g.fillText(line, 22, y); line = ''; y += 28; } line += w + ' '; } g.fillText(line, 22, y);
    B.tx.needsUpdate = true; B.sp.visible = true; B.t = Math.min(7, 2.4 + text.length * 0.055);
    // voz (si el juego tiene voces disponibles), como hacen Ari, Gemi y Leo
    try {
      if (window.speechSynthesis && !document.hidden) {
        const u = new SpeechSynthesisUtterance(text); const VR = window.__voiceFor && window.__voiceFor('27');
        if (VR && VR.v) { u.voice = VR.v; u.lang = VR.v.lang; u.pitch = VR.pitch; u.rate = VR.rate; } else u.lang = 'es-ES';
        u.volume = 0.9; speechSynthesis.cancel(); speechSynthesis.speak(u);
      }
    } catch (_) {}
  }

  // ---------- selector de bailes ----------
  let ui = null, btn = null;
  function mkUI() {
    if (ui) return;
    const st = document.createElement('style');
    st.textContent = `#ufDance{position:fixed;left:50%;bottom:calc(9vh + 70px);transform:translateX(-50%);z-index:60;display:none;gap:6px;flex-wrap:wrap;justify-content:center;max-width:min(92vw,720px);padding:10px 12px;border-radius:16px;background:rgba(14,10,40,.82);border:1px solid rgba(160,140,255,.55);box-shadow:0 10px 30px rgba(0,0,0,.35);font:800 12px system-ui;color:#fff}
#ufDance.on{display:flex}#ufDance b{width:100%;text-align:center;letter-spacing:.12em;font-size:11px;color:#c9c0ff;margin-bottom:2px}
#ufDance button{border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.08);color:#fff;border-radius:11px;padding:8px 10px;font:800 12px system-ui;cursor:pointer;min-width:74px}
#ufDance button.sel{background:linear-gradient(180deg,#8f7bff,#5b45ff);border-color:#cfc6ff}
#ufDanceBtn{position:fixed;right:14px;bottom:calc(9vh + 198px);z-index:55;display:none;border:1px solid #c9b8ff;background:linear-gradient(180deg,#8f7bff,#4b35d6);color:#fff;border-radius:10px;padding:7px 11px;font:700 11px system-ui;cursor:pointer}`;
    document.head.appendChild(st);
    ui = document.createElement('div'); ui.id = 'ufDance';
    ui.innerHTML = (EN ? '<b>DANCES · 1–7 · J to close</b>' : '<b>BAILES · 1–7 · J para cerrar</b>') + STYLES.map((s, i) => `<button data-i="${i}">${s.icon} ${i + 1} · ${s.name}</button>`).join('');
    ui.addEventListener('pointerdown', (e) => e.stopPropagation());
    ui.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; choose(+b.dataset.i); });
    document.body.appendChild(ui);
    btn = document.createElement('button'); btn.id = 'ufDanceBtn'; btn.type = 'button'; btn.textContent = EN ? '💃 DANCE (J)' : '💃 BAILAR (J)';
    btn.addEventListener('pointerdown', (e) => e.stopPropagation());
    btn.onclick = (e) => { e.stopPropagation(); togglePicker(); };
    document.body.appendChild(btn);
  }
  function refreshUI() { if (!ui) return; ui.querySelectorAll('button').forEach((b) => b.classList.toggle('sel', +b.dataset.i === S.style && S.on)); }
  function togglePicker(force) { mkUI(); S.picker = force != null ? force : !S.picker; ui.classList.toggle('on', S.picker); if (S.picker && !S.on) start(false); if (!S.picker && S.on && !S.auto) {} refreshUI(); }
  function choose(i) { S.style = i; try { localStorage.setItem('unfire_dance_style', String(i)); } catch (_) {} start(false); refreshUI(); }

  // ---------- control del baile ----------
  function canDance() { const r = R(); return !!(r && r.on && r.av && r.av.w && !(REC() && REC().on) && !r.fly && !r.wet && !r.air); }
  function start(auto) { if (!canDance()) return false; S.on = true; S.auto = !!auto; S.t = 0; S.joinT = 0; S.said = 0; refreshUI(); return true; }
  function stop() { if (!S.on) return; S.on = false; S.auto = false; S.t = 0; release(); refreshUI(); if (S.picker) togglePicker(false); }

  // input → reinicia el contador de inactividad
  const touch = () => { S.idle = 0; S.lastInput = performance.now(); };
  addEventListener('pointerdown', touch, true); addEventListener('wheel', touch, { passive: true, capture: true });
  addEventListener('keydown', (e) => {
    const tag = e.target && e.target.tagName; if (tag === 'INPUT' || tag === 'TEXTAREA' || (e.target && e.target.isContentEditable)) return;
    const r = R(); const k = (e.key || '').toLowerCase();
    if (k === 'j' && !e.repeat && r && r.on && !(window.__hwOpen && window.__hwOpen())) { touch(); togglePicker(); e.preventDefault(); return; }
    if (S.picker && /^[1-7]$/.test(e.key)) { choose(+e.key - 1); e.preventDefault(); e.stopImmediatePropagation(); return; }
    if (S.on && (k === 'escape')) { stop(); return; }
    touch();
  }, true);

  // ---------- amigos que vienen a bailar contigo ----------
  function friends() { return Array.isArray(window.__FRIENDS) ? window.__FRIENDS : []; }
  function wrap(f) {
    if (!f || !f.r0 || f.__dwrap) return; const o = f.r0.update.bind(f.r0);
    f.r0.update = (T, dt, st) => o(T, dt, f.__dance ? Object.assign({}, st, f.__dance) : st); f.__dwrap = 1;
  }
  function join(r) {
    const FR = friends(); if (!FR.length || r.mini) return; // en NANO serían gigantes pisándote: miran desde lejos
    // siempre delante de ti (en el lado opuesto a la cámara), en abanico, para que se vean bailando contigo
    const yaw = r.yaw || 0, fwd = Math.atan2(-Math.cos(yaw), Math.sin(yaw)); // la cámara se coloca detrás según ROAMS.yaw
    const ARC = [-0.95, 0, 0.95];
    FR.forEach((f, i) => {
      if (S.joined.includes(f)) return; wrap(f);
      f.__home = f.w.position.clone(); f.__st0 = f.st; f.st = 'dancejoin'; f.t = 1e9;
      const a = fwd + ARC[i % ARC.length] + (i >= ARC.length ? 0.45 : 0); f.__slot = { a, r: i % 3 === 1 ? 11 : 9 };
      f.__dance = { act: 'walk', mood: 'happy' }; S.joined.push(f);
    });
    const f0 = FR[Math.floor(Math.random() * FR.length)];
    setTimeout(() => { try { if (S.on && window.__FRIENDSAY) window.__FRIENDSAY(f0, pick(LINES.join)); } catch (_) {} }, 1600);
  }
  function release() {
    S.joined.forEach((f) => { f.__leaving = 1.6; f.__dance = { act: 'walk', mood: 'happy' }; });
  }
  function tickFriends(dt, r) {
    const p = r.p, T = THREE();
    for (let i = S.joined.length - 1; i >= 0; i--) {
      const f = S.joined[i], w = f.w.position;
      if (f.__leaving != null) { // vuelve a casa y suelta el control a su IA
        const h = f.__home; const dx = h.x - w.x, dz = h.z - w.z, d = Math.hypot(dx, dz);
        f.__leaving -= dt; const sp = Math.min(d, 14 * dt);
        if (d > 0.6) { w.x += dx / d * sp; w.z += dz / d * sp; f.w.rotation.y = Math.atan2(dx, dz); f.__dance = { act: 'walk', ph: performance.now() / 160, mood: 'happy' }; }
        if (d <= 0.6 || f.__leaving < -6) { f.__dance = null; f.st = 'idle'; f.t = 1 + Math.random() * 2; delete f.__leaving; S.joined.splice(i, 1); }
        continue;
      }
      const sl = f.__slot; const tx = p.x + Math.cos(sl.a) * sl.r, tz = p.z + Math.sin(sl.a) * sl.r;
      const dx = tx - w.x, dz = tz - w.z, d = Math.hypot(dx, dz);
      if (d > 0.8) { const far = d > 70, sp = Math.min(d, (far ? 80 : d > 30 ? 22 : 11) * dt); w.x += dx / d * sp; w.z += dz / d * sp; f.w.rotation.y = Math.atan2(dx, dz); f.__dance = { act: far ? 'fly' : d > 30 ? 'run' : 'walk', ph: performance.now() / (d > 30 ? 110 : 160), mood: 'happy' }; }
      else { f.w.rotation.y = Math.atan2(p.x - w.x, p.z - w.z) + Math.sin(performance.now() / 700 + i) * 0.35; const st = STYLES[(S.style + i + 1) % STYLES.length]; f.__dance = { act: st.act, mood: i % 2 ? 'star' : 'happy', beatPhase: performance.now() / 500 }; }
      if (f.bub && f.bub.sp && T) { /* las burbujas siguen funcionando en su anim */ }
    }
  }

  // ---------- override de la animación de tu robot ----------
  let lastAV = null;
  function wrapAvatar(r) {
    const AV = r.av; if (!AV || !AV.r0 || AV === lastAV) return; lastAV = AV;
    const o = AV.r0.update.bind(AV.r0);
    AV.r0.update = (T, dt, st) => {
      if (S.on && AV.w) {
        const s = STYLES[S.style], tt = S.t, beat = tt * 2.1;
        const base = AV.w.position, rot = AV.w.rotation;
        const k = r.mini ? (0.24 / 10.5) : 1;
        if (s.hop) base.y += Math.abs(Math.sin(beat * Math.PI)) * 0.9 * k;
        if (s.bounce) base.y += Math.abs(Math.sin(beat * Math.PI * 2)) * 0.25 * k;
        if (s.spin) rot.y += tt * 3.2;
        if (s.snap) rot.y += Math.round(Math.sin(beat * 0.5) * 2) * (Math.PI / 4);
        if (s.sway) rot.z += Math.sin(beat * Math.PI) * 0.12;
        if (s.nod) rot.x += Math.sin(beat * Math.PI * 2) * 0.05;
        return o(T, dt, Object.assign({}, st, { act: s.act, ph: tt * 1.4, mood: S.t < 1.5 && S.auto ? 'star' : 'happy', beatPhase: beat, playing: true }));
      }
      return o(T, dt, st);
    };
  }

  // ---------- bucle propio (ligero) ----------
  let last = performance.now();
  function frame() {
    requestAnimationFrame(frame);
    const now = performance.now(); const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
    const r = R(); if (!r || !r.on) { if (S.on) stop(); if (btn) btn.style.display = 'none'; return; }
    mkUI(); btn.style.display = (REC() && REC().on) ? 'none' : 'block';
    wrapAvatar(r);
    const busy = r.moving || r.fly || r.wet || r.air || (REC() && REC().on) || (window.__hwOpen && window.__hwOpen());
    if (busy) { S.idle = 0; if (S.on) stop(); }
    else if (!S.on) { S.idle += dt; if (S.idle >= IDLE_SECONDS && canDance()) { if (start(true)) S.idle = 0; } }
    if (S.on) {
      S.t += dt; S.joinT += dt;
      if (S.auto && !S.said && S.t > 0.8) { S.said = 1; speak(pick(r.mini ? LINES.nano : window.ATM_OUT ? LINES.outside : LINES.inside)); }
      if (S.auto && S.t > 11 && S.said === 1 && Math.random() < dt * 0.15) { S.said = 2; speak(pick(r.mini ? LINES.nano : window.ATM_OUT ? LINES.outside : LINES.inside)); }
      if (S.joinT > 2.5 && !S.joined.length && !r.mini && (r.h || 0) < 1.5) join(r);
    }
    if (S.joined.length) tickFriends(dt, r);
    const B = S.bubble; if (B && B.sp.visible && r.av && r.av.w) { B.t -= dt; const k = r.mini ? (0.24 / 10.5) : 1; const p = r.av.w.position; B.sp.position.set(p.x, p.y + 14.5 * k, p.z); B.sp.scale.set(18 * k, 4.8 * k, 1); if (B.t <= 0) B.sp.visible = false; }
  }
  requestAnimationFrame(frame);
  window.UnfireIdleDance = Object.freeze({ STYLES, start: (i) => { if (Number.isInteger(i)) S.style = i; return start(false); }, stop, get state() { return { on: S.on, auto: S.auto, style: STYLES[S.style].id, idle: S.idle, joined: S.joined.length }; } });
})();
