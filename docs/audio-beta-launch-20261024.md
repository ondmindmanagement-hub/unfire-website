# UNFIRE Mutants · beta PC: plan orgánico sin coste (24-10-2026)

## Estado y fuentes canónicas
- Juego público: https://unfire.technology/audio/ (sin afirmar FPS, compatibilidad universal ni número de jugadores)
- Candidato de mejora y QA de juego: issue #13 / PR #112 / PR #118. No tocar engine ni publicar beta como release estable mientras sigan gates.
- Métricas privadas opcionales existentes: PR #81. No duplicar tracker. Requiere Cloudflare Worker/D1, consentimiento legal, endpoint real y QA antes de contar nada. Los `page_load` no son jugadores únicos. Sin backend: usuarios únicos y partidas = **desconocidos**; no interpretar 0.
- Portal general Unfire Games: PR #92, coordinación #44. La ruta `/audio/beta/` es un **enlace de campaña especializado en PC**, no reemplazo de `/games/`.
- Shorts de robots reales: issue #39; kit de vídeos existe pero NO hay publicación al canal autorizada ni revisión final completa de derechos. No usar voces macOS `say`.
- El marketing no debe emplear nombre/foto del fundador, supuestos testimonios, cifras falsas, gasto en anuncios ni afiliaciones inventadas.

## El gancho elegido
**Un juego 3D raro y gratuito que puedes probar ahora mismo desde el navegador de tu PC.** Curiosidad y prueba inmediata, sin registro obligatorio, launcher ni instalador.

Mensajes:
- ES título: `Tu mundo. Tus robots. — UNFIRE Mutants (beta gratuita)`
- ES subtítulo: `Explora, transfórmate y descubre los secretos de Unfire. Juega gratis en tu navegador.`
- EN título: `Your world. Your robots. — UNFIRE Mutants (free beta)`
- EN subtítulo: `Explore, transform and find the unexpected. Free to play in your browser.`
- CTA: `▶ ENTRAR A JUGAR GRATIS` / `▶ PLAY FREE IN YOUR BROWSER`
- Aviso honesto: beta en desarrollo, bugs posibles, algunas funciones todavía cambiando. Nunca insinuar que todo funciona ya en todos los dispositivos.

## Recorrido: 1 clic al juego
1. Llega por URL directa `https://unfire.technology/audio/` (preferida para máxima conversión) o por la futura `/audio/beta/` si un Short necesita explicar el juego y controles PC.
2. Acción principal única: jugar en `/audio/`. La gateway no aloja segundo WebGL ni carga el motor hasta elegir entrar.
3. Teclado PC: WASD, ratón arrastrar, Shift, Espacio, M; verificar en navegador real tras integración y adaptar instrucciones si cambia el motor.
4. El jugador prueba exploración/robots. Feedback voluntario vía `hello@unfire.technology`; no pedir datos sensibles.
5. Beta disclaimer visible. Si una función no está probada, no anunciarla en la pieza promocional.

## Plan de captación (orden y dependencias)
**Fase A: calidad y datos**
- Probar en PC Windows/Linux vía Chrome/Edge/Firefox y en Mac Safari/Chrome de manera real. Acceso, teclado, ratón, giro de cámara, entrar/salir maletín, transformaciones, misiones 1–3, carga y memoria. No inferir compatibilidad por CI emulada.
- Resolver #112/#118: regresiones desktop de WebGL, overlays, performance, integraciones y CI SHA final. No fusionar desde este PR.
- Activar PR #81 solo tras backend HTTPS y consentimiento verificado, una sola instrumentación y políticas legales. Seguimiento deseado: visitas consentidas → entrada real confirmada → interacción inicial → sesión repetida (solo si diseñada y autorizada legalmente).
- Inicio de medición = fecha de activación. No recuperar histórico ni confundir pageviews con usuarios.

**Fase B: 20–50 testers voluntarios**
- Compartir enlace directo con comunidades interesadas en indies, juegos de navegador y música, respetando reglas y evitando autopromoción no permitida. Pedir feedback específico (rendimiento, facilidad de empezar, robots).
- Objetivos orientativos, no resultados: tasa clic→juego, porcentaje que logra entrar sin bloqueo, errores por navegador, duración y retorno cuando haya instrumentación válida.
- Priorizar arreglar cualquier fricción que impida jugar antes de incrementar volumen.

**Fase C: vídeo y descubrimiento**
- Publicar solo Shorts reales del juego ya auditados (#39), verticales 9:16, con hook visual del robot en primeros 2 segundos, texto `Free browser beta · Play on PC`, CTA y enlace a /audio/. No fabricar imágenes ni utilizar voces macOS restringidas.
- Descripción EN: `A tiny robot in a world much bigger than it expected. 🤖 Explore UNFIRE Mutants — free browser beta on PC: https://unfire.technology/audio/ #IndieGame #BrowserGame #RobotGame`
- ES: `Un robot diminuto. Un mundo enorme. 🤖 Prueba la beta gratuita de UNFIRE Mutants en tu PC: https://unfire.technology/audio/ #JuegoIndie #JuegoGratis #Robots`
- Publicar primero 2 variantes, comparar entrada real a juego (si hay telemetría consentida) y optimizar el hook, no hacer spam.

**Fase D: portales**
- itch.io admite HTML5 empaquetado en ZIP con `index.html` raíz, archivos relativos, límites publicados de tamaño/archivos y modo click-to-play. Requiere build autónoma verificada: https://itch.io/docs/creators/html5
- Newgrounds admite HTML5 ZIP con `index.html` raíz: https://www.newgrounds.com/wiki/help-information/content-submission/games-and-movies
- Ninguna ficha/publicación externa confirmada a 24-10-2026; no declarar lanzamientos anticipados. Si el juego requiere rutas absolutas de GitHub Pages o recursos CDN externos, corregir/legalizar antes de subir ZIP.
- No empezar pagos, anuncios de pago, instaladores Windows o cuentas nuevas sin autorización y QA.

## Lanzamiento seguro de esta página
`audio/beta/index.html` es estática, sin cookies ni llamadas de tracking, bilingüe ES/EN, sin login, usa imagen existente `/audio/img/unfire-mutants-share.webp`. `robots=noindex,follow` evita que compita por SEO con la ruta canónica del juego; retirar noindex solo si hay estrategia SEO acordada.

**Estado al crear el PR:** nueva página y tests en rama aislada. NO publicados. Requiere CI PASS, revisión visual PC/móvil, aprobación del integrador de #13, merge y verificación de `https://unfire.technology/audio/beta/` por HTTPS y enlace a `/audio/`. Mientras tanto compartir solo el enlace ya publicado `https://unfire.technology/audio/`.
