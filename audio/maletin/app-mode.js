/* Native app mode (App Store build): no purchases, no external links, no exit-to-web.
   Enabled with ?app=1 or when the WKWebView user agent contains "Y2KRobotsApp". */
(function () {
  var on = false;
  try { on = /[?&]app=1\b/.test(location.search) || /Y2KRobotsApp/.test(navigator.userAgent) || sessionStorage.getItem('unfire_app') === '1'; } catch (e) {}
  window.UNFIRE_APP = on;
  if (!on) return;
  try { sessionStorage.setItem('unfire_app', '1'); } catch (e) {}
  document.documentElement.classList.add('unfire-app');
  var st = document.createElement('style');
  st.textContent = '#unfireExitGame,#buy,#tubeK,[data-yt],a[href^="http"]:not([href*="youtube-nocookie"]){display:none!important}';
  (document.head || document.documentElement).appendChild(st);
  window.open = function () { return null; };
  document.addEventListener('click', function (e) {
    var a = e.target && e.target.closest && e.target.closest('a[href]');
    if (a && /^https?:/i.test(a.getAttribute('href') || '')) { e.preventDefault(); e.stopPropagation(); }
  }, true);
})();
