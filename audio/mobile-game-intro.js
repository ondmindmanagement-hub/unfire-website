/* Unfire Games mobile opening. Real project art only; no console trademarks or samples. */
(() => {
  'use strict';
  if (window.UNFIRE_GAME_INTRO) return;
  const DURATION = 3650, FIRST_STAGE = 1650, SKIP_AFTER = 900;
  let hasPlayed = false, active = false;
  const media = (query) => { try { return matchMedia(query).matches; } catch (_) { return false; } };
  const isMobile = () => media('(pointer:coarse)') || navigator.maxTouchPoints > 0;
  const reduced = () => media('(prefers-reduced-motion:reduce)');
  const installStyle = () => {
    if (document.getElementById('unfireGamesIntroStyle')) return;
    const style = document.createElement('style');
    style.id = 'unfireGamesIntroStyle';
    style.textContent = "\n#unfireGamesStart{position:absolute;inset:0;z-index:112;display:grid;place-items:center;overflow:hidden;isolation:isolate;background:#02040b;color:#f4f8ff;font-family:Arial,sans-serif;touch-action:manipulation}\n#unfireGamesStart *,#unfireGamesStart *::before,#unfireGamesStart *::after{box-sizing:border-box}\n#unfireGamesStart .ugs-panel{position:absolute;inset:0;display:grid;place-items:center;opacity:0;visibility:hidden;transition:opacity .5s ease}\n#unfireGamesStart[data-stage=\"studio\"] .ugs-studio,#unfireGamesStart[data-stage=\"game\"] .ugs-game{opacity:1;visibility:visible}\n#unfireGamesStart .ugs-studio{background:radial-gradient(ellipse at 50% 49%,#101d37,#02040b 68%)}\n#unfireGamesStart .ugs-brand{display:flex;flex-direction:column;align-items:center;gap:clamp(12px,4vmin,20px);width:min(90%,450px);padding:24px;text-align:center;animation:ugs-reveal 1s ease-out both}\n#unfireGamesStart .ugs-brand img{display:block;width:clamp(64px,20vmin,112px);height:clamp(64px,20vmin,112px);object-fit:contain;filter:drop-shadow(0 4px 22px #7695d33d)}\n#unfireGamesStart .ugs-brand strong{font-size:clamp(23px,6.2vmin,42px);letter-spacing:.15em;font-weight:800;line-height:1.25}\n#unfireGamesStart .ugs-brand small{display:block;margin-top:5px;font-size:10px;letter-spacing:.38em;color:#9cb4d5}\n#unfireGamesStart .ugs-game{background:#030510}\n#unfireGamesStart .ugs-game img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:center;filter:brightness(.43) saturate(.85)}\n#unfireGamesStart .ugs-game::after{content:'';position:absolute;inset:0;background:linear-gradient(180deg,#02040b80,#02040b20 36%,#02040bd9)}\n#unfireGamesStart .ugs-title{position:relative;z-index:1;text-align:center;width:min(93vw,840px);padding:20px 12px;text-shadow:0 4px 18px #000;animation:ugs-reveal .8s ease-out both}\n#unfireGamesStart .ugs-title h2{margin:0;font-family:'Orbitron',Arial,sans-serif;font-size:clamp(31px,9vmin,80px);font-weight:900;line-height:1.12;letter-spacing:.12em;color:#fff;white-space:nowrap}\n#unfireGamesStart .ugs-title h2 span{color:#c7d5f9}\n#unfireGamesStart .ugs-title p{margin:14px 0 0;letter-spacing:.2em;font-size:clamp(9px,2.2vmin,12px);font-weight:700;color:#dae6ff}\n#unfireGamesStart .ugs-skip{position:absolute;z-index:3;right:max(14px,env(safe-area-inset-right));top:max(14px,env(safe-area-inset-top));background:#071027cc;color:#f4f8ff;border:1px solid #9aaed2a8;border-radius:999px;padding:10px 14px;font:700 12px Arial,sans-serif;cursor:pointer;touch-action:manipulation;opacity:0;pointer-events:none}\n#unfireGamesStart[data-skippable=\"yes\"] .ugs-skip{opacity:1;pointer-events:auto}\n#unfireGamesStart .ugs-skip:focus-visible{outline:3px solid #cbe5ff;outline-offset:3px}\n@keyframes ugs-reveal{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}\n@media(prefers-reduced-motion:reduce){#unfireGamesStart .ugs-panel,#unfireGamesStart .ugs-brand,#unfireGamesStart .ugs-title{animation:none!important;transition:none!important}}\n@media(max-width:370px){#unfireGamesStart .ugs-title h2{font-size:clamp(23px,8.5vmin,34px);letter-spacing:.05em}}\n";
    document.head.appendChild(style);
  };
  // Gentle original two-note synthesizer cues. Browsers may block playback;
  // sound is optional, and no sound fetch/network wait can delay gameplay.
  function audioCues() {
    let context = null;
    try {
      const soundEnabled = document.getElementById('sndBtn')?.getAttribute('aria-pressed') === 'true';
      if (!soundEnabled || document.hidden) return { cue() {}, close() {} };
      const AudioConstructor = window.AudioContext || window.webkitAudioContext;
      if (!AudioConstructor) return { cue() {}, close() {} };
      context = new AudioConstructor();
      if (context.state === 'suspended') {
        const pending = context.resume(); if (pending?.catch) pending.catch(() => {});
      }
    } catch (_) { return { cue() {}, close() {} }; }
    const cue = (second, retried = false) => {
      if (!context) return;
      if (context.state !== 'running') {
        // Safari may briefly suspend AudioContext even during a valid tap.
        // Resume once and play the ident cue only if permission is granted.
        if (!retried) {
          try {
            const p = context.resume();
            if (p?.then) p.then(() => cue(second, true), () => {});
          } catch (_) {}
        }
        return;
      }
      try {
        const time = context.currentTime + .02;
        const notes = second ? [[293.66,0,.23],[440,.20,.39]] : [[174.61,0,.19],[261.63,.17,.34]];
        notes.forEach(([frequency,delay,duration]) => {
          const oscillator = context.createOscillator(), gain = context.createGain();
          oscillator.type = 'sine';
          oscillator.frequency.setValueAtTime(frequency,time+delay);
          gain.gain.setValueAtTime(.0001,time+delay);
          gain.gain.exponentialRampToValueAtTime(.022,time+delay+.035);
          gain.gain.exponentialRampToValueAtTime(.0001,time+delay+duration);
          oscillator.connect(gain);gain.connect(context.destination);
          oscillator.start(time+delay);oscillator.stop(time+delay+duration+.02);
        });
      } catch (_) {}
    };
    const close = () => {
      try { const p=context?.close(); if(p?.catch)p.catch(()=>{}); }catch(_){}
      context=null;
    };
    return { cue, close };
  }
  function overlay(parent) {
    installStyle();
    const el = document.createElement('section');
    el.id = 'unfireGamesStart';
    el.setAttribute('role','dialog');
    el.setAttribute('aria-label','Presentación de Unfire Games');
    el.setAttribute('aria-modal','true');
    el.dataset.stage='studio';
    el.dataset.skippable='no';
    el.innerHTML = [
      '<div class="ugs-panel ugs-studio" aria-hidden="false"><div class="ugs-brand">',
      '<img src="img/logo-unfire-256.webp" alt="" width="112" height="112" decoding="async">',
      '<div><strong translate="no">UNFIRE GAMES</strong><small>ORIGINAL GAMES</small></div>',
      '</div></div>',
      '<div class="ugs-panel ugs-game" aria-hidden="true">',
      '<img src="press/captures/06-sky-flight-sunset.jpg" alt="" decoding="async">',
      '<div class="ugs-title"><h2 translate="no">Y2K <span>ROBOTS</span></h2>',
      '<p>ADVENTURE · EXPLORE · FLY</p></div></div>',
      '<button type="button" class="ugs-skip" aria-label="Saltar presentación">SALTAR ▸</button>'
    ].join('');
    parent.appendChild(el);
    return el;
  }
  function play(parent) {
    if (hasPlayed || !isMobile() || !parent?.appendChild) return Promise.resolve();
    hasPlayed=true;active=true;
    const quiet = reduced();
    return new Promise((resolve) => {
      let node, sound, ended=false;
      const timers=[];
      const later=(fn,ms)=>timers.push(setTimeout(fn,ms));
      const finish=()=>{
        if(ended)return;
        ended=true;active=false;
        timers.forEach(clearTimeout);
        document.removeEventListener('visibilitychange',onHide);
        window.removeEventListener('pagehide',finish);
        try{sound?.close();node?.remove();}catch(_){}
        resolve();
      };
      const onHide=()=>{if(document.hidden)finish();};
      try {
        node=overlay(parent);
        const skip=node.querySelector('.ugs-skip');
        skip.addEventListener('click',(e)=>{
          e.preventDefault();e.stopPropagation();
          if(node.dataset.skippable==='yes')finish();
        });
        const studio=node.querySelector('.ugs-studio'),game=node.querySelector('.ugs-game');
        sound=audioCues();
        sound.cue(false);
        later(()=>{if(node)node.dataset.skippable='yes';},quiet?0:SKIP_AFTER);
        later(()=>{
          if(!node)return;
          node.dataset.stage='game';
          studio.setAttribute('aria-hidden','true');
          game.setAttribute('aria-hidden','false');
          sound.cue(true);
        },quiet?300:FIRST_STAGE);
        later(finish,quiet?900:DURATION);
        later(finish,6800); // fail-open: no overlay is allowed to trap the player
        document.addEventListener('visibilitychange',onHide);
        window.addEventListener('pagehide',finish,{once:true});
      } catch (_) { finish(); }
    });
  }
  window.UNFIRE_GAME_INTRO={
    play,isMobile,
    get active(){return active;},
    get hasPlayed(){return hasPlayed;}
  };
})();
