/* Accessible Unfire navigation on small screens. Normal link list remains usable without JS. */
(function () {
  "use strict";
  function init() {
    var header = document.getElementById("unfire-clean-header-v2");
    if (!header) return;
    var toggle = header.querySelector(".unfire-mobile-menu-toggle");
    var nav = document.getElementById("unfire-mobile-site-nav");
    if (!toggle || !nav) return;
    document.documentElement.classList.add("unfire-mobile-nav-ready");
    function closeMenu() {
      nav.classList.remove("is-open");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", "Open navigation menu");
    }
    toggle.addEventListener("click", function () {
      var open = !nav.classList.contains("is-open");
      nav.classList.toggle("is-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "Close navigation menu" : "Open navigation menu");
    });
    nav.addEventListener("click", function (event) {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && nav.classList.contains("is-open")) {
        closeMenu();
        toggle.focus();
      }
    });
    document.addEventListener("click", function (event) {
      if (!header.contains(event.target)) closeMenu();
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 1000) closeMenu();
    }, {passive:true});
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, {once:true});
  else init();
})();
