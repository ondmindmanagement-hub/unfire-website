/* Native app mode (App Store build): no purchases, no external links, no exit-to-web.
   Enabled with ?app=1 or when the WKWebView user agent contains "Y2KRobotsApp". */
(function () {
  var on = false;
  try { on = /[?&]app=1\b/.test(location.search) || /Y2KRobotsApp/.test(navigator.userAgent) || sessionStorage.getItem('unfire_app') === '1'; } catch (e) {}
  window.UNFIRE_APP = on;
  // Credits (licences of photos, music samples and voices) one tap away, on the web and in the app.
  const addCredits = () => {
    const hud = document.getElementById('storyHud');
    if (!hud) { setTimeout(addCredits, 1500); return; }
    if (document.getElementById('ufCredits')) return;
    const b = document.createElement('button'); b.id = 'ufCredits'; b.type = 'button'; b.textContent = 'ⓘ';
    b.title = window.__LANG === 'en' ? 'Credits and licences' : 'Créditos y licencias'; b.setAttribute('aria-label', b.title);
    b.onclick = (e) => { e.stopPropagation(); location.href = '../media-credits.html'; };
    hud.appendChild(b);
  };
  addCredits();
  if (!on) return;
  try { sessionStorage.setItem('unfire_app', '1'); } catch (e) {}
  document.documentElement.classList.add('unfire-app');
  var st = document.createElement('style');
  // Inside the App Store build the web view is not a secure origin, so camera/microphone
  // features cannot work there: hide them instead of showing buttons that do nothing.
  st.textContent = '#unfireExitGame,#buy,#tubeK,[data-yt],a[href^="http"]:not([href*="youtube-nocookie"]),#handBtn,#onlMic,#onlMute,#onlVM,#ufMic{display:none!important}';
  (document.head || document.documentElement).appendChild(st);
  window.open = function () { return null; };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (a && /^https?:/i.test(a.getAttribute('href') || '')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
})();
