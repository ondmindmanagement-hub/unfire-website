/* Y2K ROBOTS · opening sequence
 * UNFIRE GAMES → UNFIRE AUDIO + butterfly → Y2K ROBOTS title → language (English, Español) → game.
 * Tap/click/key skips a stage. Plays once per session; the language step only when no language is saved.
 */
(() => {
  'use strict';
  if (window.UNFIRE_INTRO) return;
  const q = new URLSearchParams(location.search);
  const KEY = 'unfire_lang', SEEN = 'unfire_intro_seen';
  const get = (s, k) => { try { return s.getItem(k); } catch (_) { return null; } };
  const set = (s, k, v) => { try { s.setItem(k, v); } catch (_) {} };
  const hasLang = () => ['es', 'en'].includes(get(localStorage, KEY)) || ['es', 'en'].includes(q.get('lang'));
  const automated = navigator.webdriver && q.get('introQA') !== '1';
  const seen = get(sessionStorage, SEEN) === '1' || q.get('langChosen') === '1';
  window.UNFIRE_INTRO = { active: false };
  if (automated || (seen && hasLang())) return;
  window.UNFIRE_INTRO.active = true; // language-onboarding.js defers to this sequence

  const css = `
  #y2kIntro{position:fixed;inset:0;z-index:2147000001;background:#02020a;color:#fff;overflow:hidden;font-family:'Orbitron','Arial Black',Arial,sans-serif;touch-action:manipulation;user-select:none;-webkit-user-select:none}
  #y2kIntro .st{position:absolute;inset:0;display:grid;place-items:center;opacity:0;transform:scale(1.04);transition:opacity .7s ease,transform 1.6s cubic-bezier(.2,.7,.2,1);pointer-events:none}
  #y2kIntro .st.on{opacity:1;transform:none;pointer-events:auto}
  #y2kIntro .bg{position:absolute;inset:-10%;background:radial-gradient(ellipse at 50% 45%,rgba(90,40,200,.35),rgba(2,2,10,0) 60%),radial-gradient(circle at 20% 80%,rgba(255,63,180,.18),transparent 40%),radial-gradient(circle at 80% 20%,rgba(57,243,255,.15),transparent 40%);animation:y2kdrift 9s ease-in-out infinite alternate}
  @keyframes y2kdrift{to{transform:translate(2%,-2%) scale(1.05)}}
  #y2kIntro .stars{position:absolute;inset:0;background-image:radial-gradient(1px 1px at 10% 20%,#fff,transparent),radial-gradient(1px 1px at 30% 70%,#fff,transparent),radial-gradient(1.5px 1.5px at 70% 30%,#cfe,transparent),radial-gradient(1px 1px at 85% 80%,#fff,transparent),radial-gradient(1px 1px at 50% 50%,#fdf,transparent),radial-gradient(1px 1px at 60% 90%,#fff,transparent);background-size:340px 340px;opacity:.55}
  #y2kIntro .studio{font-weight:900;letter-spacing:.42em;font-size:clamp(20px,5.2vw,54px);text-indent:.42em;text-shadow:0 0 30px rgba(140,120,255,.55)}
  #y2kIntro .studio .ug{display:block;width:min(70vw,52vh,520px);height:auto;margin:0 auto}
  #y2kIntro .studio small{display:block;margin-top:.9em;font-size:.32em;letter-spacing:.6em;opacity:.65;text-align:center}
  #y2kIntro .logos{display:flex;align-items:center;gap:clamp(22px,6vw,70px)}
  #y2kIntro .logos img{width:clamp(84px,19vw,190px);height:auto;filter:drop-shadow(0 0 26px rgba(130,110,255,.7))}
  #y2kIntro .logos .sep{width:2px;height:clamp(70px,14vw,150px);background:linear-gradient(#0000,#8af,#0000)}
  #y2kIntro .logos figure{margin:0;text-align:center}
  #y2kIntro .logos figcaption{margin-top:12px;font-size:clamp(10px,1.6vw,15px);letter-spacing:.35em;opacity:.8}
  #y2kIntro .title{text-align:center}
  #y2kIntro .title h1{margin:0;font-weight:900;line-height:.92;font-size:clamp(54px,15vw,190px);letter-spacing:.02em;
    background:linear-gradient(180deg,#ffffff 0%,#d9e4ff 38%,#7d8db8 50%,#f4f7ff 56%,#9fe9ff 78%,#ff7ad9 100%);-webkit-background-clip:text;background-clip:text;color:transparent;
    filter:drop-shadow(0 4px 0 #2a0b6e) drop-shadow(0 0 28px rgba(255,63,180,.45));font-style:italic;transform:skewX(-6deg)}
  #y2kIntro .title p{margin:.7em 0 0;font-size:clamp(12px,2.4vw,24px);letter-spacing:.5em;text-indent:.5em;color:#bff8ff}
  #y2kIntro .shine{position:absolute;inset:0;background:linear-gradient(105deg,transparent 40%,rgba(255,255,255,.35) 50%,transparent 60%);transform:translateX(-120%);mix-blend-mode:screen}
  #y2kIntro .st.on .shine{animation:y2kshine 1.6s .5s ease-out forwards}
  @keyframes y2kshine{to{transform:translateX(120%)}}
  #y2kIntro .lang{display:grid;gap:18px;justify-items:center;width:min(88vw,520px);text-align:center}
  #y2kIntro .lang h2{margin:0;font-size:clamp(18px,3.6vw,30px);letter-spacing:.18em}
  #y2kIntro .lang .opts{display:grid;gap:12px;width:100%}
  #y2kIntro .lang button{all:unset;box-sizing:border-box;width:100%;padding:16px 20px;border-radius:16px;cursor:pointer;font:800 clamp(16px,3.2vw,22px) Arial,sans-serif;letter-spacing:.06em;display:flex;align-items:center;justify-content:space-between;
    background:linear-gradient(180deg,rgba(60,40,160,.85),rgba(20,10,70,.9));border:2px solid rgba(160,200,255,.45);box-shadow:0 0 24px rgba(90,60,255,.35)}
  #y2kIntro .lang button:hover,#y2kIntro .lang button:focus-visible{border-color:#7ff3ff;box-shadow:0 0 30px rgba(57,243,255,.6);outline:none}
  #y2kIntro .lang button span{font-size:.7em;opacity:.7;letter-spacing:.2em}
  #y2kIntro .tap{position:absolute;bottom:max(28px,env(safe-area-inset-bottom));left:0;right:0;text-align:center;font:700 12px Arial;letter-spacing:.35em;opacity:.5}
  @media (orientation:landscape) and (max-height:500px){#y2kIntro .title h1{font-size:clamp(44px,19vh,120px)}#y2kIntro .logos img{width:clamp(70px,26vh,150px)}#y2kIntro .lang{gap:10px}#y2kIntro .lang .opts{grid-template-columns:1fr 1fr}#y2kIntro .lang button{padding:12px 16px}#y2kIntro .tap{bottom:12px}}
  @media (prefers-reduced-motion:reduce){#y2kIntro .st{transition:opacity .2s}#y2kIntro .bg{animation:none}}`;
  const st = document.createElement('style'); st.textContent = css;
  const font = document.createElement('link'); font.rel = 'stylesheet'; font.href = 'https://fonts.googleapis.com/css2?family=Orbitron:wght@800;900&display=swap';
  const el = document.createElement('div'); el.id = 'y2kIntro'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-label', 'Y2K Robots');
  el.innerHTML = `<div class="bg"></div><div class="stars"></div>
    <div class="st" data-s="studio"><div class="studio" translate="no"><img class="ug" src="../img/unfire-games-logo.svg" alt="UNFIRE GAMES"><small>PRESENTS</small></div></div>
    <div class="st" data-s="logos"><div class="logos">
      <figure><img src="../img/logo-unfire-256.webp" alt="UNFIRE AUDIO"><figcaption translate="no">UNFIRE AUDIO</figcaption></figure>
      <div class="sep"></div>
      <figure><img src="../img/emblem-butterfly.webp" alt=""><figcaption>&nbsp;</figcaption></figure></div></div>
    <div class="st" data-s="title"><div class="title" translate="no"><h1>Y2K<br>ROBOTS</h1><p>ISLAND ADVENTURE</p></div><div class="shine"></div></div>
    <div class="st" data-s="lang"><div class="lang"><h2>CHOOSE LANGUAGE</h2>
      <div class="opts"><button type="button" data-lang="en">English <span>EN</span></button><button type="button" data-lang="es">Español <span>ES · ESPAÑA</span></button></div></div></div>
    <div class="tap">TAP TO CONTINUE</div>`;
  const stages = ['studio', 'logos', 'title'].concat(hasLang() ? [] : ['lang']);
  const DUR = { studio: 2000, logos: 2300, title: 2600 };
  let i = -1, timer = 0, canSkip = 0;
  const show = (name) => el.querySelectorAll('.st').forEach((s) => s.classList.toggle('on', s.dataset.s === name));
  const finish = () => {
    clearTimeout(timer);
    set(sessionStorage, SEEN, '1');
    window.UNFIRE_INTRO.active = false;
    el.style.transition = 'opacity .8s'; el.style.opacity = '0';
    setTimeout(() => el.remove(), 850);
  };
  const choose = (l) => {
    set(localStorage, KEY, l); set(sessionStorage, SEEN, '1');
    if (window.__LANG === l) { finish(); return; }
    const u = new URL(location.href); u.searchParams.set('lang', l); u.searchParams.set('langChosen', '1');
    el.style.transition = 'opacity .5s'; el.style.opacity = '0';
    setTimeout(() => location.replace(u.href), 450);
  };
  const next = () => {
    clearTimeout(timer); i++;
    if (i >= stages.length) { finish(); return; }
    const s = stages[i]; show(s); canSkip = Date.now() + 550;
    el.querySelector('.tap').style.display = s === 'lang' ? 'none' : '';
    if (s === 'lang') { setTimeout(() => { try { el.querySelector('[data-lang="en"]').focus({ preventScroll: true }); } catch (_) {} }, 300); return; }
    timer = setTimeout(next, DUR[s]);
  };
  el.addEventListener('click', (e) => {
    const b = e.target.closest('[data-lang]'); if (b) { choose(b.dataset.lang); return; }
    if (Date.now() > canSkip && stages[i] !== 'lang') next();
  });
  addEventListener('keydown', (e) => { if (!el.isConnected) return; if (stages[i] !== 'lang' && Date.now() > canSkip && (e.key === ' ' || e.key === 'Enter' || e.key === 'Escape')) { e.preventDefault(); e.stopPropagation(); next(); } }, true);
  const start = () => { document.head.appendChild(font); document.head.appendChild(st); document.body.appendChild(el); requestAnimationFrame(() => next()); };
  if (document.body) start(); else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
