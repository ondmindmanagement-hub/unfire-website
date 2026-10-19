(function () {
  "use strict";
  if (window.__unfireDanteMounted) return;
  window.__unfireDanteMounted = true;

  var lang = /^es\b/i.test(navigator.language || "") ? "es" : "en";
  var voiceOn = false;
  var started = false;
  var standalone = document.body.dataset.danteMode === "standalone";
  var facts = Array.isArray(window.DANTE_PUBLIC_KNOWLEDGE) ? window.DANTE_PUBLIC_KNOWLEDGE : [];
  var root = document.createElement("div");
  root.className = "ufd-root";
  var css = document.querySelector('link[href="/dante/dante.css"]');
  if (!css) {
    css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = "/dante/dante.css";
    document.head.appendChild(css);
  }
  function robotMarkup() {
    return '<span class="ufd-bot" aria-hidden="true"><span class="ufd-bot-antenna"></span><span class="ufd-bot-ear"></span><span class="ufd-bot-head"><span class="ufd-bot-face"><span class="ufd-bot-eye"></span><span class="ufd-bot-eye"></span></span></span><span class="ufd-bot-ear"></span></span>';
  }
  var launch = null;
  if (!standalone) {
    launch = document.createElement("button");
    launch.type = "button";
    launch.className = "ufd-launch";
    launch.setAttribute("aria-label", "Ask Dante, Unfire's site guide");
    launch.setAttribute("aria-expanded", "false");
    launch.innerHTML = robotMarkup() + '<span class="ufd-launch-label">Ask Dante<small>UNFIRE SITE GUIDE</small></span>';
    root.appendChild(launch);
  }
  var windowEl = document.createElement("section");
  windowEl.className = standalone ? "ufd-window" : "ufd-window ufd-popup";
  windowEl.hidden = !standalone;
  windowEl.setAttribute("aria-label", "Dante, Unfire's public site guide");
  windowEl.innerHTML = [
    '<div class="ufd-header">',
       robotMarkup(),
       '<div class="ufd-header-copy"><div class="ufd-title">Dante</div><div class="ufd-caption">UNFIRE · PUBLIC SITE GUIDE</div></div>',
       '<div class="ufd-actions">',
         '<button class="ufd-iconbtn ufd-lang" type="button" aria-label="Switch language">ES</button>',
         '<button class="ufd-iconbtn ufd-voice" type="button" aria-pressed="false" aria-label="Enable spoken replies" title="Spoken replies are off">♫</button>',
         (!standalone ? '<button class="ufd-iconbtn ufd-close" type="button" aria-label="Close Dante">✕</button>' : ''),
       '</div>',
    '</div>',
    '<div class="ufd-intro">',
      '<h3>Meet Dante.</h3>',
      '<p class="ufd-intro-copy">Explore Unfire through a small, interactive guide to our publicly available products and projects.</p>',
      '<div class="ufd-notice ufd-notice-copy">Private by design: replies are generated locally from approved public information. No microphone, account, cookies or chat history. Do not enter private information. This is not a general-purpose AI chatbot.</div>',
      '<a href="/dante/#demo-information" class="ufd-source ufd-terms-link">How this demo works · Privacy & terms ↗</a>',
      '<button type="button" class="ufd-primary ufd-start">Start conversation →</button>',
    '</div>',
    '<div class="ufd-conversation ufd-hide">',
      '<div class="ufd-messages" role="log" aria-live="polite" aria-relevant="additions" aria-label="Conversation"></div>',
      '<div class="ufd-suggestions">',
        '<button type="button" class="ufd-suggestion" data-question-en="What is Unfire?" data-question-es="¿Qué es Unfire?">What is Unfire?</button>',
        '<button type="button" class="ufd-suggestion" data-question-en="Tell me about BOLT" data-question-es="Háblame de BOLT">Tell me about BOLT</button>',
        '<button type="button" class="ufd-suggestion" data-question-en="What is Unfire Control?" data-question-es="¿Qué es Unfire Control?">Unfire Control</button>',
      '</div>',
      '<form class="ufd-compose">',
        '<input class="ufd-input" type="text" maxlength="400" autocomplete="off" spellcheck="true" aria-label="Your question about Unfire" placeholder="Ask about Unfire…" required>',
        '<button class="ufd-send" type="submit" aria-label="Send message">Send</button>',
      '</form>',
      '<div class="ufd-fineprint">Public information only · No message storage · <a href="/dante/#demo-information">Demo privacy</a></div>',
    '</div>'
  ].join("");
  root.appendChild(windowEl);

  if (standalone) {
    var target = document.getElementById("danteMount");
    if (!target) target = document.body;
    target.appendChild(root);
    root.classList.add("ufd-standalone");
  } else document.body.appendChild(root);

  var closeBtn = windowEl.querySelector(".ufd-close");
  var startBtn = windowEl.querySelector(".ufd-start");
  var langBtn = windowEl.querySelector(".ufd-lang");
  var voiceBtn = windowEl.querySelector(".ufd-voice");
  var intro = windowEl.querySelector(".ufd-intro");
  var introCopy = windowEl.querySelector(".ufd-intro-copy");
  var notice = windowEl.querySelector(".ufd-notice-copy");
  var termsLink = windowEl.querySelector(".ufd-terms-link");
  var dialog = windowEl.querySelector(".ufd-conversation");
  var messages = windowEl.querySelector(".ufd-messages");
  var input = windowEl.querySelector(".ufd-input");
  var form = windowEl.querySelector(".ufd-compose");
  var sendBtn = windowEl.querySelector(".ufd-send");
  var suggestions = Array.from(windowEl.querySelectorAll(".ufd-suggestion"));

  var stop = new Set(("a an the what where who which is are can do does of for to and or in on with about i you your me it how please tell " +
    "de del la el los las un una uno y o en para que qué como cómo quien quién puede puedo se con sobre me tu su este esta es son hay cuál " +
    "this that from by use we our esta app application aplicacion aplicación")
    .split(/\s+/));
  function normal(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
  }
  function words(s) {
    return normal(s).split(" ").filter(function (x) { return x.length > 1 && !stop.has(x); });
  }
  function fact(id) { return facts.find(function (x) { return x.id === id; }); }
  function answer(text) {
    var q = normal(text).slice(0, 400);
    if (!q) return null;
    if (/\b(password|contrase|secret|secretos|credentials|credenciales|internal|internos|confidential|confidencial|api key|private files|archivo privado|codigo fuente|source code|private keys|claves privadas)\b/i.test(q)) return fact("security");
    if (/\b(price|pricing|cost|fee|precio|precios|gratis|free|buy|comprar|cuanto cuesta|how much)\b/i.test(q)) return fact("cost");
    if (/\b(windows|linux|android|compatibility|compatible|sistemas operativos|operating system)\b/i.test(q)) return fact("platform");
    if (/\b(download|release|published|available|app store|descargar|disponible|lanzamiento|publicado)\b/i.test(q)) return fact("availability");
    if (/\b(privacidad|privacy|cookies|tracking|chat history|personal data)\b/i.test(q)) return fact("privacy");

    var qwords = words(q);
    var best = null, bestScore = 0;
    facts.forEach(function (entry) {
      var score = 0;
      entry.terms.forEach(function (term) {
        var t = normal(term);
        if (!t) return;
        if ((" " + q + " ").includes(" " + t + " ")) {
          score += t.includes(" ") ? 9 + Math.min(3, t.split(" ").length) : (t.length > 3 ? 5 : 2);
        }
      });
      var termWords = new Set(entry.terms.flatMap(function (term) { return words(term); }));
      qwords.forEach(function (word) { if (termWords.has(word)) score += 1.2; });
      if (score > bestScore) { bestScore = score; best = entry; }
    });
    return bestScore >= 4.1 ? best : null;
  }
  function translated(en, es) { return lang === "es" ? es : en; }
  function addMessage(author, content, source) {
    var block = document.createElement("div");
    block.className = "ufd-msg ufd-msg-" + (author === "user" ? "user" : "dante");
    var bubble = document.createElement("div");
    bubble.className = "ufd-bubble";
    bubble.textContent = content;
    block.appendChild(bubble);
    if (source && /^\/[a-z0-9/#.-]*$/i.test(source)) {
      var a = document.createElement("a");
      a.className = "ufd-source";
      a.href = source;
      a.textContent = translated("Read verified source ↗", "Ver fuente pública ↗");
      block.appendChild(a);
    }
    messages.appendChild(block);
    messages.scrollTop = messages.scrollHeight;
  }
  function speak(text) {
    if (!voiceOn || !("speechSynthesis" in window) || !("SpeechSynthesisUtterance" in window)) return;
    window.speechSynthesis.cancel();
    var utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang === "es" ? "es-ES" : "en-US";
    utterance.rate = 0.96;
    utterance.pitch = 1.0;
    window.speechSynthesis.speak(utterance);
  }
  function ask(q) {
    q = String(q || "").trim().slice(0, 400);
    if (!q) return;
    addMessage("user", q);
    var match = answer(q);
    var response = match
      ? match[lang]
      : translated(
          "I don't have a verified answer to that in this public demo. Explore Unfire's product pages or send a written question to hello@unfire.technology. I won't guess or disclose unverified information.",
          "No tengo una respuesta verificada para eso en esta demo pública. Consulta los productos de Unfire o envía una pregunta por escrito a hello@unfire.technology. No voy a inventar ni revelar información no verificada.");
    addMessage("dante", response, match ? match.url : "/contact/");
    speak(response);
    input.value = "";
    input.focus();
  }
  function refreshLanguage() {
    langBtn.textContent = lang === "es" ? "EN" : "ES";
    langBtn.setAttribute("aria-label", lang === "es" ? "Change to English" : "Cambiar a español");
    intro.querySelector("h3").textContent = translated("Meet Dante.", "Conoce a Dante.");
    introCopy.textContent = translated(
      "Explore Unfire through a small, interactive guide to our publicly available products and projects.",
      "Descubre Unfire con un pequeño guía interactivo de nuestros productos y proyectos públicos.");
    notice.textContent = translated(
      "Private by design: replies are generated locally from approved public information. No microphone, account, cookies or chat history. Do not enter private information. This is not a general-purpose AI chatbot.",
      "Privacidad desde el diseño: las respuestas se generan en tu navegador a partir de información pública aprobada. Sin micrófono, cuenta, cookies ni historial. No introduzcas información privada. No es un chatbot de IA general.");
    termsLink.textContent = translated("How this demo works · Privacy & terms ↗", "Funcionamiento · Privacidad y condiciones ↗");
    startBtn.textContent = translated("Start conversation →", "Empezar conversación →");
    input.placeholder = translated("Ask about Unfire…", "Pregunta sobre Unfire…");
    input.setAttribute("aria-label", translated("Your question about Unfire", "Tu pregunta sobre Unfire"));
    sendBtn.textContent = translated("Send", "Enviar");
    suggestions.forEach(function (b) { b.textContent = lang === "es" ? b.dataset.questionEs : b.dataset.questionEn; });
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
  }
  function open() {
    if (!launch) return;
    windowEl.hidden = false;
    launch.hidden = true;
    launch.setAttribute("aria-expanded", "true");
    (started ? input : startBtn).focus();
  }
  function close() {
    if (!launch) return;
    windowEl.hidden = true;
    launch.hidden = false;
    launch.setAttribute("aria-expanded", "false");
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    launch.focus();
  }
  if (launch) launch.addEventListener("click", open);
  if (closeBtn) closeBtn.addEventListener("click", close);
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !windowEl.hidden && !standalone) close();
  });
  startBtn.addEventListener("click", function () {
    started = true;
    intro.classList.add("ufd-hide");
    dialog.classList.remove("ufd-hide");
    addMessage("dante", translated(
      "Hello. I'm Dante, the public Unfire guide. Ask me about our apps, technology, accessibility research, collaborations or support. I only answer from verified public information.",
      "Hola. Soy Dante, el guía público de Unfire. Pregúntame por nuestras apps, tecnología, accesibilidad, colaboraciones o soporte. Solo respondo con información pública verificada."
    ));
    input.focus();
  });
  langBtn.addEventListener("click", function () { lang = lang === "en" ? "es" : "en"; refreshLanguage(); });
  voiceBtn.addEventListener("click", function () {
    if (!("speechSynthesis" in window)) { voiceBtn.disabled = true; return; }
    voiceOn = !voiceOn;
    voiceBtn.setAttribute("aria-pressed", String(voiceOn));
    voiceBtn.setAttribute("aria-label", translated(voiceOn ? "Disable spoken replies" : "Enable spoken replies", voiceOn ? "Desactivar respuestas habladas" : "Activar respuestas habladas"));
    voiceBtn.title = translated(voiceOn ? "Spoken replies are on" : "Spoken replies are off", voiceOn ? "Voz activada" : "Voz desactivada");
    if (!voiceOn) window.speechSynthesis.cancel();
  });
  if (!("speechSynthesis" in window)) {
    voiceBtn.disabled = true;
    voiceBtn.title = "Spoken replies unavailable in this browser";
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    ask(input.value);
  });
  suggestions.forEach(function (button) {
    button.addEventListener("click", function () { ask(lang === "es" ? button.dataset.questionEs : button.dataset.questionEn); });
  });
  refreshLanguage();
}());