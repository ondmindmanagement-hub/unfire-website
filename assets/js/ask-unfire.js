/* Ask Unfire — minimal site support. Public information only, no tracking or API keys. */
(function () {
  "use strict";
  if (window.__askUnfireLoaded) return;
  window.__askUnfireLoaded = true;

  function init() {
    if (!document.body || document.getElementById("ask-unfire-host")) return;
    var host = document.createElement("div");
    host.id = "ask-unfire-host";
    host.style.visibility = "hidden";
    var root = host.attachShadow({mode:"open"});
    var sheet = document.createElement("link");
    sheet.rel = "stylesheet";
    sheet.href = "/assets/css/ask-unfire.css?v=20261019-4";
    sheet.onload = function () { host.style.visibility = "visible"; };
    sheet.onerror = function () { host.style.visibility = "visible"; host.style.position = "fixed"; host.style.right = "16px"; host.style.bottom = "16px"; host.style.zIndex = "2147483000"; };
    root.appendChild(sheet);

    var face = '<span class="assistant-mark" aria-hidden="true">' +
      '<svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M19.2 15.6a8.8 8.8 0 1 0-3.7 3.6L20.5 21l-1.3-5.4Z"/>' +
      '<path d="M8.5 11.9h7"/><path d="M8.5 15h4.5"/>' +
      '</svg></span>';
    var microphone = '<svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"></rect><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8"></path></svg>';
    var soundOnIcon = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15 9a5 5 0 0 1 0 6"/><path d="M18 6a9 9 0 0 1 0 12"/></svg>';
    var soundOffIcon = '<svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="m17 9 5 6m0-6-5 6"/></svg>';
    var sendIcon = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"></path></svg>';
    var ui = document.createElement("div");
    ui.innerHTML =
      '<button type="button" id="launcher" aria-controls="panel" aria-expanded="false">' +
        face + '<span class="launch-copy"><strong>Ask <span class="notranslate" translate="no">Unfire</span> <span class="online" aria-hidden="true"></span></strong><small id="launch-sub">Talk with <span class="notranslate" translate="no">Unfire</span></small></span>' +
      '</button>' +
      '<section id="panel" role="dialog" aria-label="Ask Unfire — site assistant" hidden>' +
        '<header id="panel-header">' + face +
          '<div class="identity"><strong>Ask <span class="notranslate" translate="no">Unfire</span> <span class="online" aria-hidden="true"></span></strong><small id="subtitle"><span class="notranslate" translate="no">Unfire</span> site support</small></div>' +
          '<div class="actions">' +
            '<button type="button" id="lang" class="ghost" aria-label="Change language">ES</button>' +
            '<button type="button" id="voice" class="ghost" aria-label="Enable spoken answers" aria-pressed="false">' + soundOffIcon + '</button>' +
            '<button type="button" id="close" class="ghost" aria-label="Close assistant">×</button>' +
          '</div>' +
        '</header>' +
        '<div id="messages" role="log" aria-live="polite" aria-relevant="additions text"></div>' +
        '<div id="quick">' +
          '<button type="button" data-topic="control">Unfire Control</button>' +
          '<button type="button" data-topic="apps">Apps</button>' +
          '<button type="button" data-topic="contact">Contact</button>' +
        '</div>' +
        '<div id="status" role="status" aria-live="polite"></div>' +
        '<form id="composer">' +
          '<input id="message-input" type="text" maxlength="500" autocomplete="off" aria-label="Your question for Unfire" placeholder="Ask me about Unfire…" />' +
          '<button id="mic" type="button" aria-pressed="false" aria-label="Ask with your voice" title="Ask with your voice">' + microphone + '</button>' +
          '<button id="send" type="submit" aria-label="Send message" title="Send message">' + sendIcon + '</button>' +
        '</form>' +
        '<div id="disclosure">Voice recognition is provided by your browser and may use its provider. Microphone only starts when you tap it. <a href="/privacy.html" target="_blank" rel="noopener noreferrer">Privacy</a></div>' +
      '</section>';
    while (ui.firstChild) root.appendChild(ui.firstChild);
    document.body.appendChild(host);
    var $ = function (id) { return root.getElementById(id); };
    // Preserve the Unfire brand in the assistant's dynamic replies and labels.
    // Run only when rendering/updating text; no DOM observers or polling.
    function brandText(target, text) {
      var value = String(text == null ? "" : text);
      var re = /\bUnfire\b/gi;
      var match, last = 0;
      target.textContent = "";
      while ((match = re.exec(value))) {
        if (match.index > last) target.appendChild(document.createTextNode(value.slice(last, match.index)));
        var brand = document.createElement("span");
        brand.textContent = match[0];
        brand.className = "notranslate";
        brand.setAttribute("translate", "no");
        target.appendChild(brand);
        last = re.lastIndex;
      }
      if (last < value.length) target.appendChild(document.createTextNode(value.slice(last)));
    }
    var launcher = $("launcher"), panel = $("panel"), messages = $("messages"), input = $("message-input");
    var mic = $("mic"), status = $("status"), voice = $("voice"), langButton = $("lang");
    var Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    var recognition = null, listening = false, opened = false, voiceEnabled = false, pendingSpeechText = "", lastAssistantText = "";
    var lang = /^es\b/i.test(navigator.language || "") ? "es" : "en";
    var copy = {
      es: {
        sub:"Información y ayuda", teaser:"¿En qué podemos ayudarte?", placeholder:"Escribe tu pregunta…",
        welcome:"Hola. Puedo ayudarte con preguntas frecuentes sobre las aplicaciones, compatibilidad y contacto de Unfire. ¿Qué necesitas saber?",
        privacy:"El reconocimiento de voz depende de tu navegador y puede utilizar el servicio de su proveedor. El micrófono solo se activa cuando lo pulsas.",
        speaking:"Escuchando… Habla ahora.", unsupported:"Este navegador no permite el reconocimiento de voz. Puedes escribirme aquí.",
        denied:"No tengo permiso para usar el micrófono. Revisa los permisos del navegador o escribe tu pregunta.",
        silent:"No he podido escuchar la pregunta. Pulsa el micrófono e inténtalo de nuevo.",
        neterr:"El servicio de voz del navegador no está disponible ahora. Usa el chat escrito.",
        online:"Listo para ayudarte", contact:"Contacto", you:"Tú", mute:"Silenciar respuestas", unmute:"Activar respuestas",
        questions:["Unfire Control","Aplicaciones","Contacto"]
      },
      en: {
        sub:"Information and support", teaser:"How can we help?", placeholder:"Ask a question…",
        welcome:"Hello. I can help with common questions about Unfire apps, compatibility and contact information. What would you like to know?",
        privacy:"Voice recognition is provided by your browser and may use its provider's service. The microphone only starts when you tap it.",
        speaking:"Listening… Speak now.", unsupported:"Speech recognition is unavailable in this browser. You can type your question here.",
        denied:"Microphone access was denied. Check your browser permissions or type your question.",
        silent:"I couldn't hear the question. Tap the microphone and try again.",
        neterr:"Your browser's speech service is unavailable right now. Please use text chat.",
        online:"Ready to help", contact:"Contact", you:"You", mute:"Mute spoken answers", unmute:"Enable spoken answers",
        questions:["Unfire Control","Applications","Contact"]
      }
    };
    var answers = {
      es:{
        identity:"Soy el asistente de ayuda de la web de Unfire. Respondo preguntas frecuentes sobre información pública; no accedo a tu Mac, archivos ni datos privados.",
        about:"Unfire es una iniciativa tecnológica independiente fundada por Omar Baró. Desarrolla software, herramientas de audio, sistemas de IA y tecnología de interacción. Puedes conocerla en unfire.technology/about/.",
        control:"Unfire Control es el proyecto de interacción con Mac mediante gestos de las manos y comandos de voz. Necesita una cámara y micrófono compatibles, y los permisos que autorices. La versión Mac figura actualmente en revisión; consulta /apps/unfire-control/ para conocer su disponibilidad.",
        mac:"Este asistente de la web no puede mover el cursor ni abrir aplicaciones del ordenador. Esas funciones pertenecen a Unfire Control para Mac, según disponibilidad y permisos.",
        apps:"Puedes explorar los productos en unfire.technology/apps/. Entre ellos están ARCHER (procesamiento de audio), BOLT (flujos de trabajo de IA con aprobación humana), Unfire Control, Pocket Capture y Power. Las características y la disponibilidad dependen de cada plataforma.",
        archer:"ARCHER es una herramienta de clipping de audio de Unfire para creadores y productores, con controles de ganancia, umbral y carácter. Hay información y enlaces de descarga en /apps/ y /archer/.",
        bolt:"BOLT ayuda a revisar propuestas de cambios asistidos por IA en el Mac, con controles locales y una aprobación explícita antes de ejecutar. Consulta las condiciones y compatibilidad en /bolt/.",
        mobile:"Algunas aplicaciones de Unfire están disponibles para iPhone o iPad. No todas las funciones del Mac se pueden ofrecer en esos dispositivos. Comprueba cada ficha en /apps/.",
        windows:"Unfire investiga soluciones multiplataforma, pero la disponibilidad de cada app para Windows no está garantizada. Consulta las páginas oficiales para ver las plataformas compatibles.",
        price:"Los precios y la disponibilidad pueden cambiar según la app, la región y la plataforma. Comprueba la ficha oficial de la aplicación en /apps/ o en su tienda antes de descargarla.",
        privacy:"Aquí no solicito contraseñas ni claves y no puedo consultar información privada. Las preguntas escritas se procesan en esta página; el reconocimiento de voz puede depender del servicio del navegador. Puedes leer /privacy.html.",
        contact:"Puedes escribir a hello@unfire.technology o visitar unfire.technology/contact/. Unfire gestiona las consultas por escrito: soporte, colaboraciones, acceso anticipado y propuestas.",
        thanks:"Encantado de ayudarte. ¿Quieres saber algo más sobre Unfire?",
        stop:"De acuerdo. He detenido la voz.",
        greeting:"¡Hola! Escribe tu pregunta o pulsa el micrófono para hablar. La voz de las respuestas se activa por separado.",
        unknown:"Puedo ayudarte con Unfire Control, ARCHER, BOLT, otras aplicaciones y las vías de contacto. Para cuestiones técnicas o particulares, escríbenos a hello@unfire.technology. No quiero darte información que no pueda confirmar."
      },
      en:{
        identity:"I am Unfire's website help assistant. I answer common questions about public information, and cannot access your Mac, files or private data.",
        about:"Unfire is an independent technology initiative founded by Omar Baró. It develops software, audio tools, AI systems and interaction technology. Learn more at unfire.technology/about/.",
        control:"Unfire Control is a Mac interaction project using hand gestures and voice commands. It needs a compatible camera and microphone and permissions you choose to grant. The Mac version is currently listed as under review; see /apps/unfire-control/ for availability.",
        mac:"This website assistant cannot move your cursor or launch apps on your computer. Those functions belong to Unfire Control for Mac, subject to availability and permissions.",
        apps:"Explore products at unfire.technology/apps/. They include ARCHER (audio processing), BOLT (human-approved AI workflows), Unfire Control, Pocket Capture and Power. Features and availability vary by platform.",
        archer:"ARCHER is an audio-clipping tool for creators and producers, with gain, threshold and sound-character controls. Find details and download links at /apps/ and /archer/.",
        bolt:"BOLT helps you review AI-proposed file changes on Mac, with local checks and explicit human approval before execution. See compatibility and terms at /bolt/.",
        mobile:"Some Unfire apps are available for iPhone and iPad. Not every Mac feature is available on mobile devices. Please check the individual product pages at /apps/.",
        windows:"Unfire is exploring cross-platform solutions, but Windows availability is not guaranteed for every app. Check individual official product pages for supported platforms.",
        price:"Pricing and availability can vary by app, region and platform. Check the product's official listing through /apps/ or the relevant store.",
        privacy:"I do not ask for passwords or API keys, and cannot access private data. Typed questions are handled on this page; speech recognition may use your browser provider's service. See /privacy.html.",
        contact:"Email hello@unfire.technology or visit unfire.technology/contact/. Unfire handles support, partnerships, early access and proposals in writing.",
        thanks:"Happy to help. What else would you like to know about Unfire?",
        stop:"Understood. I've stopped speaking.",
        greeting:"Hello! Type a question or tap the microphone to speak. Spoken answers can be enabled separately.",
        unknown:"I can help with Unfire Control, ARCHER, BOLT, other apps and contact information. For technical or individual questions, email hello@unfire.technology. I don't want to give you an unverified answer."
      }
    };

    function normalize(value) {
      return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLowerCase().trim();
    }
    function match(text, pattern) { return pattern.test(text); }
    function reply(text) {
      var q = normalize(text), a = answers[lang];
      if (match(q,/^(callate|silencio|para de hablar|stop talking|stop speaking|be quiet|mute)\b/)) return {text:a.stop,quiet:true};
      if (match(q,/(quien eres|quien te creo|who are you|who made you|who created you|tu nombre|your name|ask unfire)/)) return {text:a.identity};
      if (match(q,/(privacidad|privacy|microfono|microphone|datos personales|personal data|seguridad|security)/)) return {text:a.privacy};
      if (match(q,/(correo|contacto|contact|escribir|email|soporte|support|colaborac|partnership)/)) return {text:a.contact};
      if (match(q,/(windows|linux|cross.platform|multiplataforma)/)) return {text:a.windows};
      if (match(q,/(controlar (el |mi )?(mac|ordenador|computador)|control my mac|move (the |my )?cursor|open apps|abrir aplicaciones|manejar el mac)/)) return {text:a.mac};
      if (match(q,/(unfire control|kinect|kinekt|gestos|gestures|hands|hand tracking|cursor|camara|camera)/)) return {text:a.control};
      if (match(q,/(archer|clipping|clipper|logic pro|audio|musica|music)/)) return {text:a.archer};
      if (match(q,/(bolt|automati|workflow|approval|aprobacion)/)) return {text:a.bolt};
      if (match(q,/(iphone|ipad|ios|mobile|movil|tablet)/)) return {text:a.mobile};
      if (match(q,/(precio|coste|cuesta|gratis|gratuit|pricing|price|free|download|descarg)/)) return {text:a.price};
      if (match(q,/(aplicac|apps|software|productos|products|portfolio)/)) return {text:a.apps};
      if (match(q,/(unfire|fundador|founder|empresa|company|omar baro|tecnologia|technology)/)) return {text:a.about};
      if (match(q,/(gracias|thank|perfecto|great|genial)/)) return {text:a.thanks};
      if (match(q,/^(hola|buenos dias|buenas tardes|buenas noches|hello|hi|hey)\b/)) return {text:a.greeting};
      return {text:a.unknown};
    }
    function addMessage(text, who) {
      var node = document.createElement("div"); node.className = "message " + who;
      var sender = document.createElement("span"); sender.className = "sender";
      brandText(sender, who === "agent" ? "Unfire" : copy[lang].you);
      var content = document.createElement("span"); brandText(content, text);
      if (who === "agent") lastAssistantText = text;
      node.appendChild(sender); node.appendChild(content); messages.appendChild(node);
      messages.scrollTop = messages.scrollHeight;
    }
    function setStatus(text,error) { status.textContent = text || ""; status.dataset.error = error ? "true" : "false"; }
    function silence() { if ("speechSynthesis" in window) { try { window.speechSynthesis.cancel(); } catch (e) {} } }
    function speak(text) {
      if (!voiceEnabled || !("speechSynthesis" in window) || !window.SpeechSynthesisUtterance) return;
      silence();
      try {
        var s = new SpeechSynthesisUtterance(text);
        s.lang = lang === "es" ? "es-ES" : "en-US";
        // Prefer natural, language-matched installed voices. Voices vary by browser.
        s.rate = 0.96; s.pitch = 0.97;
        var locale = lang === "es" ? "es-es" : "en-us";
        var voices = window.speechSynthesis.getVoices();
        var candidates = voices.filter(function(v) {
          return v.lang && v.lang.toLowerCase().replace("_", "-").indexOf(lang) === 0;
        });
        function score(v) {
          var name = (v.name || "").toLowerCase();
          var speechLocale = (v.lang || "").toLowerCase().replace("_", "-");
          var value = speechLocale === locale ? 30 : 0;
          if (/\beddy\b/.test(name)) value += 110;
          else if (lang === "es" && /\bjorge\b/.test(name)) value += 90;
          else if (lang === "en" && /\bdaniel\b|\balex\b|\baaron\b/.test(name)) value += 90;
          else if (/\breed\b|\bgrandpa\b/.test(name)) value += 65;
          if (/enhanced|premium|natural|neural/.test(name)) value += 12;
          if (/grandma|samantha|monica|mónica|paulina|flo\b|sandy|shelley|victoria|siri/.test(name)) value -= 80;
          return value;
        }
        candidates.sort(function(a,b) { return score(b)-score(a) || a.name.localeCompare(b.name); });
        if (candidates.length) s.voice = candidates[0];
        // If the browser has not loaded its voice list, let it use its
        // system default for the selected language, rather than failing.
        window.speechSynthesis.speak(s);
      } catch (e) { setStatus(copy[lang].neterr,true); }
    }
    function refresh() {
      var c = copy[lang];
      $("launch-sub").textContent = c.teaser; $("subtitle").textContent = c.sub;
      $("disclosure").firstChild.textContent = c.privacy + " ";
      input.placeholder = c.placeholder; input.setAttribute("aria-label",c.placeholder);
      langButton.textContent = lang === "es" ? "EN" : "ES";
      voice.setAttribute("aria-label",voiceEnabled ? c.mute : c.unmute);
      voice.setAttribute("aria-pressed",String(voiceEnabled));
      voice.innerHTML = voiceEnabled ? soundOnIcon : soundOffIcon;
      root.querySelectorAll("[data-topic]").forEach(function(b,i) { brandText(b, c.questions[i]); });
      if (!Recognition) mic.title = c.unsupported;
    }
    function stopListen() {
      pendingSpeechText = "";
      if (recognition) { try { recognition.abort(); } catch (e) {} }
      listening = false; mic.setAttribute("aria-pressed","false");
    }
    function send(text) {
      var q = String(text || "").trim().slice(0,500);
      if (!q) return;
      addMessage(q,"visitor"); input.value = "";
      var response = reply(q);
      addMessage(response.text,"agent");
      setStatus("");
      if (response.quiet) { silence(); voiceEnabled = false; refresh(); }
      else speak(response.text);
    }
    function close() {
      panel.hidden = true; launcher.setAttribute("aria-expanded","false");
      stopListen(); silence(); launcher.focus();
    }
    launcher.addEventListener("click",function () {
      panel.hidden = false; launcher.setAttribute("aria-expanded","true");
      if (!opened) {
        opened = true;
        addMessage(copy[lang].welcome,"agent");
      }
      input.focus({preventScroll:true});
    });
    $("close").addEventListener("click",close);
    $("composer").addEventListener("submit",function(e) { e.preventDefault(); send(input.value); });
    $("quick").addEventListener("click",function(e) {
      var b = e.target.closest("button[data-topic]"); if (!b) return;
      var topic = b.dataset.topic;
      send(topic === "control" ? "Unfire Control" : topic === "apps" ? (lang === "es" ? "Aplicaciones" : "Applications") : (lang === "es" ? "Contacto" : "Contact"));
    });
    langButton.addEventListener("click",function() {
      stopListen(); silence(); lang = lang === "es" ? "en" : "es"; refresh();
      addMessage(lang === "es" ? "Idioma cambiado a español." : "Language changed to English.","agent");
    });
    voice.addEventListener("click",function() {
      voiceEnabled = !voiceEnabled;
      if (!voiceEnabled) silence();
      refresh();
      if (voiceEnabled) speak(lastAssistantText || copy[lang].welcome);
    });
    mic.addEventListener("click",function() {
      if (!Recognition) { setStatus(copy[lang].unsupported,true); return; }
      if (listening) { stopListen(); setStatus(""); return; }
      silence();
      try {
        recognition = new Recognition();
        recognition.lang = lang === "es" ? "es-ES" : "en-US";
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        recognition.onresult = function(event) {
          var text = event.results && event.results[0] && event.results[0][0] && event.results[0][0].transcript;
          if (text) pendingSpeechText = text; else setStatus(copy[lang].silent,true);
        };
        recognition.onerror = function(event) {
          if (event.error === "aborted") return;
          setStatus((event.error === "not-allowed" || event.error === "service-not-allowed") ? copy[lang].denied :
                    event.error === "no-speech" ? copy[lang].silent : copy[lang].neterr,true);
        };
        recognition.onend = function() {
          listening = false; mic.setAttribute("aria-pressed","false");
          if (status.textContent === copy[lang].speaking) setStatus("");
          var captured = pendingSpeechText;
          pendingSpeechText = "";
          if (captured) send(captured);
        };
        recognition.start();
        listening = true; mic.setAttribute("aria-pressed","true");
        setStatus(copy[lang].speaking);
      } catch (e) {
        listening = false; mic.setAttribute("aria-pressed","false");
        setStatus(copy[lang].neterr,true);
      }
    });
    document.addEventListener("visibilitychange",function() { if (document.hidden) { stopListen(); silence(); } });
    root.addEventListener("keydown",function(e) { if (e.key === "Escape") close(); });
    refresh();
    if (!("speechSynthesis" in window)) { voiceEnabled = false; voice.disabled = true; refresh(); }
    if (!Recognition) mic.setAttribute("aria-label",copy[lang].unsupported);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded",init,{once:true});
  else init();
})();
