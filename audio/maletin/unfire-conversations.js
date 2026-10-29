/* UNFIRE AUDIO — local NPC dialogue + temporary P2P room text chat.
   No external language service, tracking, or persistent conversation storage. */
(() => {
  'use strict';
  if (window.UnfireConversations) return;

  const MAX_TEXT = 180;
  const gi = (id) => document.getElementById(id);
  const tr = (es, en) => window.__LANG === 'en' ? en : es;
  const clean = (text) => String(text == null ? '' : text).replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, MAX_TEXT);
  const memories = new Map();
  // Room chat is between friends, but offensive words are still masked (ES/EN).
  const BAD = /\b(put[ao]s?|mierda|cabr[oó]n(es)?|gilipollas|imb[eé]cil(es)?|idiota|subnormal|maric[oó]n(es)?|zorra|polla|co[ñn]o|follar|joder|hostia|fuck\w*|shit\w*|bitch\w*|cunt|dick|pussy|nigg\w*|fag\w*|retard\w*|whore|slut|bastard|asshole)\b/gi;
  const tidy = (t) => String(t).replace(BAD, (w) => w[0] + '*'.repeat(Math.max(2, w.length - 1)));
  const giantLore = [
    {
      name: 'ECLIPSE, EL TESTIGO DE LAS SOMBRAS',
      origin: 'Antes de que existieran las islas, una estrella dejó de emitir luz. En su silencio nací yo, Umbral. Mi armadura está hecha de aquella última sombra.',
      secret: 'Hay una puerta bajo las mareas que nunca aparece en los mapas. Solo se abre cuando cesa toda música y aún puedes oír tu propio pulso.',
      path: 'Recorrí siete cielos buscando la voz de quien encendió el primer faro. Cada vez que hallaba una respuesta, el firmamento cambiaba de forma.',
      task: 'Cuando encuentres un lugar donde no exista eco, quédate inmóvil unos instantes. Tal vez escuches el nombre olvidado de esta tierra.',
      end: 'No temas a la oscuridad. Una sombra también es prueba de que algo sigue brillando.'
    },
    {
      name: 'ASTRALIA, LA QUE RECUERDA LOS SUEÑOS',
      origin: 'Fui construida en un observatorio que flotaba sobre el tiempo. Mis creadores me confiaron los sueños que los habitantes ya no querían recordar.',
      secret: 'Una constelación desaparece cada vez que alguien olvida una promesa. Guardo sus luces en cámaras de cristal, cerca de mi corazón.',
      path: 'Dormí durante mil inviernos bajo un océano de nubes. Desperté cuando un pequeño robot tocó tres notas equivocadas y abrió un cielo nuevo.',
      task: 'Busca el reflejo de las estrellas en el agua y presta atención a la que no se mueve. No todo lo que ilumina pertenece al cielo.',
      end: 'Los sueños no se pierden. Cambian de hogar, y a veces el hogar eres tú.'
    },
    {
      name: 'CRONOS DEL ÓXIDO, EL ÚLTIMO TESTIGO',
      origin: 'Soy el último reloj de una ciudad que se desmanteló a sí misma para poder seguir viajando. Cada engranaje mío conserva un recuerdo de sus calles.',
      secret: 'El tiempo de este mundo tiene una grieta. Se oculta entre dos latidos del gran bajo y conduce a una habitación que aún no ha sido construida.',
      path: 'Vi caer la torre de los días y salvé su campana. Nunca la he hecho sonar: podría despertar a quienes prefirieron permanecer olvidados.',
      task: 'Si encuentras un reloj detenido, no intentes arreglarlo enseguida. Pregúntate primero qué instante está protegiendo.',
      end: 'Todo final contiene un comienzo, pero no todos los comienzos merecen ser apresurados.'
    }
  ];
  const islandLore={
    name:'BALUARTE, EL SABIO QUE CAMINA',origin:'Mis pasos son lentos porque llevo un recuerdo de cada piedra que he pisado.',
    secret:'Una de mis huellas termina exactamente donde comenzó el primer océano. Todavía no he encontrado la otra.',
    path:'Mi sombra ha cruzado cientos de mapas, aunque ninguno consiguió dibujarme completo.',
    task:'Sigue el agua y escucha la marea antes de competir. La velocidad no compensa un rumbo equivocado.',
    end:'Cuando comprendas el silencio entre las olas, volveremos a hablar.'};
  const oracleOpeners=[
    'Viajero, hay una pregunta que todavía no ha nacido.',
    'Has pasado junto a un secreto que estaba esperándote.',
    'No camines tan deprisa: incluso las sombras guardan memoria.',
    'Las estrellas me piden que te diga algo, pero nunca mencionan tu nombre.',
    'El hierro envejece. Los misterios no conocen esa costumbre.',
    '¿Has oído a una montaña contener la respiración?',
    'Tu sombra acaba de reconocer un lugar al que jamás has ido.',
    'Los relojes mienten cuando están asustados.'
  ];
  const oracleClues=[
    'En el cielo existe una puerta que parece una nota sostenida.',
    'La Luna conserva un eco que aún no ha encontrado su origen.',
    'Hay discos gigantes que recuerdan cada giro aunque nadie los mire.',
    'La isla es mucho más antigua que cualquiera de sus mapas.',
    'Los robots pequeños saben verdades que los gigantes olvidamos.',
    'Debajo de algunas canciones habita un segundo océano.',
    'Una ballena de metal guarda una constelación dentro del vientre.',
    'El gran espejo del pecho contempla el futuro y no el pasado.',
    'La última carrera comenzará justo después del primer silencio.',
    'El universo guarda sus llaves en lugares que parecen ventanas.',
    'A veces la música termina para que una historia pueda empezar.'
  ];
  const oracleClosers=[
    'No me creas todavía: observa.',
    'Guarda esa pista y nunca te faltará camino.',
    'Si lo cuentas muy alto, quizá desaparezca.',
    'Pregúntame cuando las estrellas cambien de lugar.',
    'Hasta un gigante puede equivocarse sobre la eternidad.',
    'Hay respuestas que sólo funcionan dichas en voz baja.',
    'La paciencia también es una forma de viajar.',
    'Algunas puertas sólo se abren al regresar.',
    'El universo parece vacío porque guarda las sorpresas en los bordes.',
    'La verdad espera, pero nunca toca dos veces.'
  ];
  const oracleVisits=new Map(),oracleInside=new Set();
  function oracleText(npc){
    const id=String(npc.id||npc.name||'titan');
    const n=oracleVisits.get(id)||0;oracleVisits.set(id,n+1);
    const seed=hash(id);
    const i=(n+(seed%oracleOpeners.length))%oracleOpeners.length;
    const j=(Math.floor(n/oracleOpeners.length)+(seed%oracleClues.length))%oracleClues.length;
    const k=(Math.floor(n/(oracleOpeners.length*oracleClues.length))+(seed%oracleClosers.length))%oracleClosers.length;
    const E=window.__LANG==='en'&&window.UNFIRE_TALK_EN;
    return (E?E.oracleOpeners:oracleOpeners)[i]+' '+(E?E.oracleClues:oracleClues)[j]+' '+(E?E.oracleClosers:oracleClosers)[k];
  }
  const origins = [
    'Me ensamblaron con las piezas de una radio que solo recibía señales del futuro.',
    'Nací en una cápsula olvidada bajo el suelo de ajedrez de la casa.',
    'Mi primera memoria es el reflejo de dos lunas sobre un casete de cromo.',
    'Desperté en un taller donde todas las herramientas estaban soñando.',
    'Fui construido para vigilar el jardín cuando sus árboles empezaron a cantar.',
    'Aparecí un día en la orilla; nadie sabe qué océano me trajo.',
    'Antes de andar, pasé años descifrando la voz de una vieja gramola.',
    'Mi circuito más antiguo perteneció a un faro en una isla que ya no existe.',
    'Pasé mi infancia mecánica en una biblioteca de cintas sin etiquetas.',
    'Mi corazón es un pequeño metrónomo que a veces late hacia atrás.',
    'Fui la primera chispa de una máquina de caramelos que cobró conciencia.',
    'Salí de una pantalla apagada el día que empezó a llover electricidad.'
  ];
  const secrets = [
    'He visto una luz azul cruzar la pared cuando nadie miraba.',
    'Las paredes cambian de posición un milímetro cada vez que alguien cuenta un secreto.',
    'Bajo la isla hay una melodía que no puede reproducir ningún altavoz normal.',
    'Una de las ventanas refleja un lugar que todavía no hemos descubierto.',
    'Conservo una llave que solo abre recuerdos, nunca puertas.',
    'Sé que la luna nos escucha, porque una vez respondió a mi silbido.',
    'El techo guarda constelaciones que se dibujan con sonidos graves.',
    'En la noche más silenciosa, los cuadros susurran números antiguos.',
    'A veces mis ojos muestran un mapa durante una fracción de segundo.',
    'Los árboles rosados saben el nombre de un robot que aún no ha despertado.',
    'La máquina de bolas ha entregado una cápsula que nadie recuerda haber ganado.',
    'Detrás de cierto espejo hay una habitación hecha de ecos.'
  ];
  const giants = (id) => /^titan-(?:\d+|ship|island)$/.test(id);
  function hash(str) { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return h >>> 0; }
  const EN = () => window.__LANG === 'en' && window.UNFIRE_TALK_EN ? window.UNFIRE_TALK_EN : null;
  const TK = () => window.UNFIRE_TALK || {};
  const lang = () => window.__LANG === 'en' ? 'en' : 'es';
  const BASE = { hello: ['¡Hola!', 'Hi!'], iam: ['Soy', 'I am'], callme: ['Me llaman', 'They call me'], giantHello: ['Has llegado hasta mí, viajero.', 'You have reached me, traveller.'], giantAsk: ['Pregúntame por mi historia o por el secreto de este mundo.', 'Ask me about my story or the secret of this world.'], giantOpen: ['Has llegado hasta mí. Pregunta por mi historia, viajero.', 'You have reached me. Ask me about my story, traveller.'], open: ['¡Hola! Acércate y hablemos.', 'Hi! Come closer and let us talk.'] };
  const tline = (key) => { const v = TK()[key]; if (v) return v[lang()]; const b = BASE[key]; return b ? b[lang() === 'en' ? 1 : 0] : ''; };
  // Pick a line for this robot and topic without repeating until the pool is used up.
  function pick(m, id, topic) {
    const pool = TK()[topic] || [];
    if (!pool.length) return '';
    m.seen = m.seen || {};
    const n = m.seen[topic] = (m.seen[topic] || 0) + 1;
    return pool[(hash(id + topic) + n - 1) % pool.length][lang()];
  }
  // Giants keep their names in the player's language.
  function shown(npc) {
    const id = String(npc && npc.id || ''), E = EN();
    if (!E || !giants(id)) return String(npc && npc.name || 'ROBOT');
    return id.startsWith('titan-island') ? E.islandLore.name : E.giantLore[Number(id.split('-')[1]) % giantLore.length].name;
  }
  function answer(npc, query) {
    const id = String(npc.id || npc.name || 'robot');
    const name = String(npc.name || 'ROBOT').slice(0, 32);
    const q = clean(query).toLocaleLowerCase();
    const m = memories.get(id) || { turn: 0, chapters: 0, last: '' };
    m.turn++;
    const en = EN();
    let reply;
    if (giants(id)) {
      const gi2 = id.startsWith('titan-island') ? -1 : Number(id.split('-')[1]) % giantLore.length;
      const lore = en ? (gi2 < 0 ? en.islandLore : en.giantLore[gi2]) : (gi2 < 0 ? islandLore : giantLore[gi2]);
      if (/nombre|qui[eé]n|who|name|eres/.test(q)) reply = tline('callme') + ' ' + lore.name + '. ' + lore.origin;
      else if (/secret|ocult|mister|clave|puerta|hidden/.test(q)) reply = lore.secret;
      else if (/misi[oó]n|ayuda|pista|busc|qu[eé] hago|help|quest/.test(q)) reply = lore.task;
      else if (/final|desped|adi[oó]s|gracias|bye|thank/.test(q)) reply = lore.end;
      else if (/historia|cu[eé]nt|pasado|record|origen|antes|story|past|legend/.test(q)) {
        reply = [lore.origin, lore.path, lore.secret, lore.end][m.chapters % 4];
        m.chapters++;
      } else if (/hola|salud|hello|hi|hey/.test(q)) reply = tline('giantHello') + ' ' + tline('callme') + ' ' + lore.name + '. ' + tline('giantAsk');
      else {
        reply = [lore.path, lore.secret, lore.task, lore.end][m.chapters % 4];
        m.chapters++;
      }
    } else {
      const idx = hash(id + ':' + name) % origins.length;
      const origin = (en ? en.origins : origins)[idx], secret = (en ? en.secrets : secrets)[(idx + 3 + m.turn) % secrets.length];
      const subject = name.toUpperCase();
      if (/qu[eé] tal|c[oó]mo est[aá]s|how are|how.s it/.test(q)) reply = pick(m, id, 'howareyou');
      else if (/hola|buenas|salud|hello|hey|\bhi\b/.test(q)) reply = tline('hello') + ' ' + tline('iam') + ' ' + subject + '. ' + pick(m, id, 'greet');
      else if (/qui[eé]n|eres|nombre|who|name|origen|historia|pasado|story/.test(q)) reply = tline('iam') + ' ' + subject + '. ' + origin;
      else if (/secret|mister|ocult|extrañ|hidden|mystery/.test(q)) reply = secret;
      else if (/se[nñ]al|antagon|malo|enemig|villain|signal|enemy|fragment/.test(q)) reply = pick(m, id, 'signal');
      else if (/gigante|tit[aá]n|giant|titan/.test(q)) reply = pick(m, id, 'giants');
      else if (/misi[oó]n|ayuda|pista|quest|help|clue|perdid|lost\b|d[oó]nde|where/.test(q)) reply = pick(m, id, 'help');
      else if (/bail|dance/.test(q)) reply = pick(m, id, 'dance');
      else if (/m[uú]sic|bajo|sonido|ritmo|canci[oó]n|radio|music|beat|song/.test(q)) reply = pick(m, id, 'music');
      else if (/isla|pir[aá]mide|haiku|ola|surf|c[uú]pula|lugar|island|pyramid|wave|dome|place/.test(q)) reply = pick(m, id, 'places');
      else if (/chiste|gracioso|r[ií]e|broma|joke|funny|laugh/.test(q)) reply = pick(m, id, 'joke');
      else if (/triste|solo|miedo|sad|afraid|scared|alone/.test(q)) reply = pick(m, id, 'sad');
      else if (/gracias|adi[oó]s|hasta luego|bye|thank|see you/.test(q)) reply = pick(m, id, 'thanks');
      else if (/^(s[ií]|vale|claro|venga|ok|yes|sure|yeah)\b/.test(q)) reply = m.last === 'offer' ? origin : pick(m, id, 'yes') + ' ' + secret;
      else if (/^(no|nah|nope)\b/.test(q)) reply = pick(m, id, 'no');
      else reply = [origin, secret, pick(m, id, 'musing'), pick(m, id, 'giants'), pick(m, id, 'places'), pick(m, id, 'music')][m.turn % 6];
      m.last = /hola|buenas|hello|hey|\bhi\b/.test(q) ? 'offer' : '';
    }
    memories.set(id, m);
    return reply;
  }

  const css = document.createElement('style');
  css.textContent = [
    '#ufNear{position:fixed;right:max(10px,env(safe-area-inset-right));bottom:calc(58px + env(safe-area-inset-bottom));z-index:57;display:none;max-width:min(36vw,168px);padding:9px 11px;border:1px solid #8ccaff;border-radius:18px;background:#0b2036ee;color:#f8fcff;font:700 12px/1.4 system-ui;box-shadow:0 6px 22px #0008;cursor:pointer}',
    '#ufNear.on{display:block}',
    '#ufRoomButton{border:1px solid #9cd9ff;border-radius:11px;background:#123860;color:white;font:700 12px system-ui;padding:8px}',
    '#ufDialogs{position:fixed;inset:0;z-index:94;display:none;align-items:flex-start;justify-content:flex-end;pointer-events:none;padding:max(10px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(10px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left));box-sizing:border-box}',
    '#ufDialogs.on{display:flex}',
    '#ufDialogs .ufCard{pointer-events:auto;width:min(400px,100%);max-height:min(48dvh,360px);display:flex;flex-direction:column;overflow:hidden;background:#09182df2;color:#f1f7ff;border:1px solid #74b8fb;border-radius:20px;box-shadow:0 20px 70px #000c;font:14px/1.45 system-ui,sans-serif}',
    '#ufDialogs header{display:flex;align-items:center;gap:8px;padding:12px 14px;border-bottom:1px solid #79aff344}',
    '#ufDialogs header strong{flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
    '#ufDialogs button{color:#f8fcff;background:#21518a;border:1px solid #547bae;border-radius:10px;padding:7px 10px;cursor:pointer}',
    '#ufDialogs button:focus-visible,#ufNear:focus-visible{outline:2px solid #f9d76e;outline-offset:2px}',
    '#ufDialogs .ufLog{min-height:90px;overflow:auto;overscroll-behavior:contain;padding:10px 14px;flex:1;display:flex;flex-direction:column;gap:7px}',
    '#ufDialogs .ufEntry{align-self:flex-start;max-width:93%;overflow-wrap:anywhere;padding:7px 10px;border-radius:13px;background:#193657}',
    '#ufDialogs .ufMine{align-self:flex-end;background:#245b93}',
    '#ufDialogs .ufEntry b{display:block;font-size:11px;color:#a7d9ff;margin-bottom:2px}',
    '#ufDialogs form{display:flex;gap:6px;padding:10px;border-top:1px solid #79aff344}',
    '#ufDialogs input{flex:1;min-width:0;background:#e9f4ff;color:#102542;border:0;border-radius:9px;padding:10px;font:14px system-ui}',
    '#ufDialogs .ufHint{font-size:11px;opacity:.78;padding:0 14px 8px}',
    '@media(max-height:520px){#ufDialogs .ufCard{max-height:calc(100dvh - 24px)}}',
    '@media(pointer:coarse){#ufNear{display:none!important}#ufDialogs{align-items:flex-end;justify-content:center}#ufDialogs .ufCard{max-height:min(48dvh,360px)}#ufDialogs header{padding:9px}#ufDialogs form{padding:7px}}',
    'body:has(#ufDialogs.on) #unfireFly,body:has(#ufDialogs.on) #unfireDown,body:has(#ufDialogs.on) #unfireTalk,body:has(#ufDialogs.on) #unfireTouchPad,body:has(#ufDialogs.on) #ctlDock,body:has(#ufDialogs.on) #wradio,body:has(#ufDialogs.on) #minimap,body:has(#ufDialogs.on) #unfireCoinHud,body:has(#ufDialogs.on) #onlHud{visibility:hidden!important;pointer-events:none!important}',
    '#ufGiantSubtitle{position:fixed;left:max(10px,env(safe-area-inset-left));top:calc(253px + env(safe-area-inset-top));bottom:auto;z-index:48;display:none;max-width:min(300px,58vw);padding:9px 11px;border:1px solid #83cfff88;border-radius:14px;background:#061a2be8;color:#e8f4ff;pointer-events:none;font:600 12px/1.38 system-ui;box-shadow:0 5px 17px #0008}',
    '@media(max-height:430px) and (orientation:landscape){#ufGiantSubtitle{top:calc(125px + env(safe-area-inset-top));max-height:90px;overflow:hidden}}',
    '@media(pointer:coarse) and (orientation:landscape){#ufDialogs .ufCard{max-height:calc(100dvh - env(safe-area-inset-top) - env(safe-area-inset-bottom) - 16px)}}'
  ].join('\n');
  document.head.appendChild(css);

  const chip = document.createElement('button');
  chip.id = 'ufNear'; chip.type = 'button'; chip.setAttribute('aria-label', tr('Hablar con robot cercano', 'Talk to nearby robot'));
  const panel = document.createElement('div');
  panel.id = 'ufDialogs';
  panel.innerHTML = '<section class="ufCard" role="dialog" aria-modal="true" aria-label="' + tr('Conversaciones de Unfire', 'Unfire conversations') + '"><header><strong id="ufDlgTitle"></strong><button id="ufSpeak" type="button" title="' + tr('Activar o silenciar respuestas habladas', 'Turn spoken replies on or off') + '">🔊</button><button id="ufClose" type="button" aria-label="' + tr('Cerrar', 'Close') + '">✕</button></header><div id="ufLog" class="ufLog" role="log" aria-live="polite"></div><form id="ufForm" autocomplete="off"><input id="ufText" maxlength="180" aria-label="' + tr('Escribir mensaje', 'Write a message') + '" placeholder="' + tr('Escribe un mensaje…', 'Write a message…') + '" required><button id="ufMic" type="button" title="' + tr('Hablar por micrófono', 'Speak with the microphone') + '">🎤</button><button id="ufSend" type="submit">➤</button></form><div id="ufHint" class="ufHint"></div></section>';
  document.body.append(chip, panel);
  const subtitle=document.createElement('div');subtitle.id='ufGiantSubtitle';subtitle.setAttribute('role','status');subtitle.setAttribute('aria-live','polite');
  document.body.appendChild(subtitle);
  let subtitleUntil=0;
  const log = gi('ufLog'), input = gi('ufText'), hint = gi('ufHint');
  let mode = '', selected = null, nearby = null, scene = null, voiceEnabled = true, listening = null, lastSend = 0, lastPeer = new Map();
  const recognize = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!recognize) gi('ufMic').hidden = true;
  function entry(author, message, mine) {
    const el = document.createElement('div'); el.className = 'ufEntry' + (mine ? ' ufMine' : '');
    const who = document.createElement('b'); who.textContent = String(author).slice(0, 30);
    const content = document.createElement('span'); content.textContent = message;
    el.append(who, content); log.appendChild(el);
    while (log.children.length > 45) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  }
  function world() {
    try { return typeof window.__UNFIRE_DIALOGUE_WORLD === 'function' ? window.__UNFIRE_DIALOGUE_WORLD() : null; }
    catch (_) { return null; }
  }
  function close() {
    if (listening) try { listening.abort(); } catch (_) {}
    listening = null; panel.classList.remove('on'); mode = ''; selected = null;
    try { window.speechSynthesis && window.speechSynthesis.cancel(); } catch (_) {}
  }
  function open(kind, target) {
    const w = world();
    if (!w || !w.roaming || (kind === 'players' && !w.online)) return false;
    mode = kind; selected = kind === 'npc' ? target : null;
    log.replaceChildren();
    gi('ufDlgTitle').textContent = kind === 'players' ? tr('💬 Chat de la sala', '💬 Room chat') : '🤖 ' + shown(target);
    hint.textContent = kind === 'players' ? tr('Chat temporal para los jugadores conectados. No se guarda.', 'Temporary chat for connected players. Not saved.') : tr('Conversación local con este robot. Pregunta por su historia o sus secretos.', 'Local conversation with this robot. Ask about its past or secrets.');
    gi('ufMic').style.display = kind === 'players' ? 'none' : '';
    gi('ufSpeak').style.display = kind === 'players' ? 'none' : '';
    panel.classList.add('on'); input.value = ''; input.placeholder = kind === 'players' ? tr('Mensaje a la sala…', 'Message to room…') : tr('Pregunta al robot…', 'Ask the robot…');
    if (kind === 'npc') { const first = giants(target.id) ? tline('giantOpen') : tline('open'); entry(shown(target), first, false); say(first, target.name); }
    if (window.matchMedia && !matchMedia('(pointer:coarse)').matches) input.focus();
    return true;
  }
  function say(text, name) {
    if (!voiceEnabled || !window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    try {
      speechSynthesis.cancel();
      const s = new SpeechSynthesisUtterance(text);
      s.lang = window.__LANG === 'en' ? 'en-US' : 'es-ES';
      const voice = window.__voiceFor && window.__voiceFor(name);
      if (voice && voice.v) { s.voice = voice.v; s.lang = voice.v.lang; }
      s.rate = 0.94; s.pitch = voice && voice.pitch || 1;
      speechSynthesis.speak(s);
    } catch (_) {}
  }
  function send() {
    const text = clean(input.value), w = world(), now = Date.now();
    if (!text || !w || !w.roaming || now - lastSend < 800) return;
    lastSend = now; input.value = '';
    if (mode === 'players') {
      if (!w.online || typeof w.sendChat !== 'function' || !w.sendChat(text)) { entry(tr('Sistema', 'System'), tr('No estás conectado a una sala.', 'You are not connected to a room.'), false); return; }
      entry(w.myName || tr('Tú', 'You'), text, true);
    } else if (mode === 'npc' && selected) {
      const current = w.npcs && w.npcs.find((n) => n.id === selected.id);
      if (!current || distance(current, w.player) > 1.4) { entry(tr('Sistema', 'System'), tr('Acércate otra vez para continuar.', 'Come closer again to continue.'), false); return; }
      entry(tr('Tú', 'You'), text, true);
      const response = answer(current, text);
      entry(shown(current), response, false); say(response, current.name);
    }
  }
  function distance(npc, player) {
    if (!npc || !player) return Infinity;
    const planar = Math.hypot(npc.x - player.x, npc.z - player.z);
    const vertical = npc.giant ? 0 : Math.abs((npc.y || 0) - (player.y || 0)) * .32;
    return Math.hypot(planar, vertical) / Math.max(1, npc.radius || 14);
  }
  function poll() {
    const now=Date.now();
    if(subtitleUntil && now>subtitleUntil){subtitle.style.display='none';subtitleUntil=0;}
    if(window.__UNFIRE_LUNAR && window.__UNFIRE_LUNAR.active){chip.classList.remove('on');return;}
    const w = world();
    if (!w || !w.roaming || !w.player) {
      chip.classList.remove('on'); if (mode) close(); return;
    }
    if (mode === 'players' && !w.online) close();
    if (mode === 'npc' && (!w.npcs || !w.npcs.some((n) => n.id === selected?.id && distance(n, w.player) <= 1.4))) close();
    let best = null, dMin = 1;
    for (const bot of w.npcs || []) {
      const d = distance(bot, w.player);
      if (d < dMin) { best = bot; dMin = d; }
    }

    // Speak spontaneously once on entering each giant's personal radius,
    // without requiring T/HABLAR or covering any touch controls.
    let closestGiant=null,closestDistance=Infinity;
    for(const npc of w.npcs||[])if(giants(npc.id)){
      const d=Math.hypot(npc.x-w.player.x,npc.z-w.player.z);
      const greetRadius=npc.id.startsWith('titan-island')?31:105;
      if(d<greetRadius&&d<closestDistance){closestDistance=d;closestGiant=npc;}
      if(d>greetRadius*1.35)oracleInside.delete(npc.id);
    }
    if(closestGiant && !mode && !oracleInside.has(closestGiant.id)){
      oracleInside.add(closestGiant.id);
      const text=oracleText(closestGiant);
      subtitle.textContent='✧ '+shown(closestGiant)+': '+text;
      subtitle.style.display='block';subtitleUntil=now+6600;
      say(text,closestGiant.name);
    }
    nearby = best;
    chip.classList.toggle('on', !!best && !mode);
    if (best) chip.textContent = '💬 ' + best.name.slice(0, 23);
    const talk = gi('unfireTalk');
    if (talk) {
      // Reuse the existing right-thumb action. Never stack a duplicate speech button.
      const label = tr('💬 HABLAR', '💬 TALK');
      if (talk.textContent !== label) talk.textContent = label;
      talk.title = best ? tr('Hablar con ', 'Talk to ') + best.name : tr('Hablar con un robot cercano', 'Talk to a nearby robot');
      talk.setAttribute('aria-label', talk.title);
    }
    let button = gi('ufRoomButton');
    const hud = gi('onlHud');
    if (!button && hud) {
      button = document.createElement('button'); button.id = 'ufRoomButton'; button.type = 'button'; button.textContent = '💬 CHAT';
      const before = gi('onlQ'); if (before && before.parentNode === hud) hud.insertBefore(button, before); else hud.appendChild(button);
      button.addEventListener('click', (e) => { e.stopPropagation(); open('players'); });
      button.addEventListener('pointerdown', (e) => e.stopPropagation());
    }
    if (button) button.style.display = w.online ? '' : 'none';
  }

  chip.onclick = (e) => { e.stopPropagation(); if (nearby) open('npc', nearby); };
  gi('ufClose').onclick = close;
  gi('ufSpeak').onclick = () => { voiceEnabled = !voiceEnabled; gi('ufSpeak').textContent = voiceEnabled ? '🔊' : '🔇'; if (!voiceEnabled && window.speechSynthesis) speechSynthesis.cancel(); };
  gi('ufForm').onsubmit = (e) => { e.preventDefault(); send(); };
  gi('ufMic').onclick = () => {
    if (!recognize || mode !== 'npc') return;
    if (listening) { try { listening.abort(); } catch (_) {} listening = null; return; }
    try {
      const rec = new recognize(); listening = rec; rec.lang = window.__LANG === 'en' ? 'en-US' : 'es-ES'; rec.interimResults = false; rec.maxAlternatives = 1;
      rec.onresult = (e) => { if (listening !== rec) return; input.value = clean(e.results[0][0].transcript); listening = null; send(); };
      rec.onerror = () => { if (listening === rec) listening = null; hint.textContent = tr('Micrófono no disponible. Puedes escribir.', 'Microphone not available. You can type.'); };
      rec.onend = () => { if (listening === rec) listening = null; };
      rec.start();
    } catch (_) { listening = null; hint.textContent = tr('Micrófono no disponible. Puedes escribir.', 'Microphone not available. You can type.'); }
  };
  panel.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); close(); } });
  panel.addEventListener('pointerdown', (e) => e.stopPropagation());
  window.addEventListener('keydown', (e) => {
    if (e.target && (/^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable)) return;
    if ((e.key === 't' || e.key === 'T') && nearby && !mode) {
      e.preventDefault(); e.stopImmediatePropagation(); open('npc', nearby);
    }
  }, true);
  document.addEventListener('pointerdown', (e) => {
    const talk = e.target && e.target.closest && e.target.closest('#unfireTalk');
    if (talk && nearby && !mode) { e.preventDefault(); e.stopImmediatePropagation(); open('npc', nearby); }
  }, true);
  window.addEventListener('pagehide', () => { close(); memories.clear(); lastPeer.clear(); });
  setInterval(poll, 360);

  window.UnfireConversations = Object.freeze({
    oracleText,
    answer,
    distance,
    receivePeer(packet) {
      if (!packet || packet.kind !== 'chat' || typeof packet.id !== 'string' || typeof packet.text !== 'string') return;
      if (window.__ONL_MUTED && window.__ONL_MUTED.has(packet.id)) return; // muted / reported players are blocked
      const text = tidy(clean(packet.text));
      if (!text || text.length > MAX_TEXT) return;
      const now = Date.now(), prev = lastPeer.get(packet.id) || 0;
      if (now - prev < 700) return;
      lastPeer.set(packet.id, now);
      if (mode === 'players') entry(String(packet.n || 'Jugador').slice(0, 20), text, false);
    },
    openNPC(id) {
      const w = world(), npc = w && w.npcs && w.npcs.find((n) => n.id === id);
      return npc && distance(npc, w.player) < 1 ? open('npc', npc) : false;
    }
  });
})();
