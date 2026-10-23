# Unfire Audio · Medición real y respetuosa (propuesta, NO publicada)

**Estado:** módulo y backend en rama independiente. Los contadores NO están activos; no existen cifras históricas verificadas de jugadores. No fusionar ni desplegar hasta integración y QA.

## Definiciones sin confusiones

| Evento | Significado preciso | No significa |
|---|---|---|
| page_view | Visita consentida a la página /audio/ | Jugador |
| game_enter | Entrada confirmada al juego tras la escena cargada | Persona única |
| match_start | Inicio confirmado de partida online desde su motor | Jugador distinto |
| briefcase_open | Maletín realmente abierto | Compra |
| checkout_click | Clic hacia el checkout del proveedor | Pago realizado |

GET /admin/summary, protegido con secreto, devolverá contadores diarios y **cargas de página anónimas**, no personas únicas, usuarios registrados ni MAU verificados. Facturación/ventas requieren fuentes oficiales de la plataforma de cobro y ajustes por devoluciones.

## Privacidad

- Envío solo después de 'unfire-cookie-consent=accepted'. Rechazo o error de almacenamiento o endpoint ausente => ningún evento.
- UUID aleatorio en memoria por carga de página; no persiste al recargar. Nada de IP, email, identidad, cookies, fingerprint, URLs, parámetros, checkout ni pedidos en D1.
- El Worker ve la conexión HTTPS pero no persiste la IP. Auditoría independiente de logs/retención Cloudflare necesaria antes de publicar.
- Se conservan resúmenes diarios y UUIDs de carga hasta 35 días, con purga programada. No interpretar sesiones como usuarios únicos.
- Medición aproximada: bloqueadores, bots, red y límites gratuitos afectan resultados. Origin/CORS no evitan tráfico falsificado; esto NO certifica una venta.

## Pasos para habilitarla, solo por el integrador

1. Provisionar cuenta Cloudflare Worker + D1 y comprobar límites de cuota y condiciones vigentes, **primero en staging**. No se ha configurado ninguna cuenta automáticamente.
2. Copiar wrangler.toml.example a wrangler.toml, sustituir el ID de D1 real y configurar ADMIN_TOKEN exclusivamente como secreto mediante wrangler secret put ADMIN_TOKEN. Nunca guardar tokens en HTML, JS público ni git. Ejecutar schema.sql contra DB de staging.
3. Ejecutar desde raíz: node --test tests/unfire-audio-metrics.test.mjs. Probar CORS, consentimiento, 401, errores y purga antes de producción.
4. **Solo propietario de audio/index.html/iframe**, una vez integrados cambios #64/#69/#71 y demás reservas: enlazar /assets/js/unfire-audio-metrics.js e inicializar window.UnfireAudioMetrics.create({ endpoint: 'https://COLLECTOR_APROBADO/v1/event' }). Emitir page_view en página de audio después del consentimiento, game_enter al entrar con juego listo, match_start al crear/entrar a sala real, briefcase_open al abrir realmente y checkout_click al salir al proveedor. Para hechos únicos por pestaña usar track('game_enter',{once:true}) si es la semántica acordada.
5. Verificar aviso de privacidad/cookies, consentimiento revocable y variaciones Safari/Chrome/móvil, offline, bloqueo de analíticas, FPS sin coste, SQL de cuentas y cuota gratuita.
6. PR de integración separada + QA + CI + verificación de Pages por integrador único. Solo entonces fijar fecha de inicio de la medición y reportar cifras.

No incorporar compra confirmada como evento de JavaScript público: solo el proveedor de pagos mediante webhooks firmados y datos financieros verificados.

## Ficheros

- assets/js/unfire-audio-metrics.js — módulo cliente sin dependencia ni efecto al cargarse.
- assets/js/unfire-audio-metrics-bridge.js — conexión segura con escena del anfitrión y estado del maletín.
- scripts/unfire-audio-metrics-report.mjs — lectura privada de conteos diarios, sin credenciales persistidas.
- analytics/unfire-audio/worker.mjs + schema.sql — colector opcional de agregados sin nombres ni IP.
- analytics/unfire-audio/wrangler.toml.example — configuración incompleta, NO desplegar sin provisión.
- tests/unfire-audio-metrics.test.mjs — QA ligero sin navegador.

Coordinación de reservas en https://github.com/ondmindmanagement-hub/unfire-website/issues/13 y registro global #78.

## Bridge funcional e informe (pendientes del host y backend)

El cliente se complementa con assets/js/unfire-audio-metrics-bridge.js (15 pruebas).
El puente escucha la clase inmersiva real del anfitrión y confirma escena lista
para game_enter, y exige message de ventana iframe + origen idéntico para contar
caseState=open como briefcase_open. No interpone WebGL, no hace polling ni crea
cookies. Los eventos match_start y checkout_click requieren que su propietario
despache un CustomEvent explícito tras cada acto confirmado:

    window.dispatchEvent(new CustomEvent('unfire:metrics',
      {detail:{event:'match_start'}}));

checkout_click debe enviarse SOLO antes de redirigir a un checkout habilitado.
Nunca notificar purchase_completed desde código cliente. Cuando el usuario
acepte analíticas en audio/, el consentimiento necesita notificación explícita:

    window.dispatchEvent(new Event('unfire:consent-updated'));

Tras configurar servicio y verificar cookies, el propietario de audio/index.html
incorpora en el host, en orden y con URL HTTPS aprobada:

    <script>window.__UNFIRE_AUDIO_METRICS_ENDPOINT='https://<ENDPOINT_REAL>/v1/event';</script>
    <script defer src="/assets/js/unfire-audio-metrics.js"></script>
    <script defer src="/assets/js/unfire-audio-metrics-bridge.js"></script>

No insertar endpoint ficticio. El host está RESERVADO por otros equipos y esta
PR solo añade archivos independientes. El endpoint vive fuera de GitHub Pages.
El bridge no se activa por sí solo. El cliente sigue sin enviar eventos mientras
no exista consentimiento o endpoint válido.

Al existir backend real se pueden consultar agregados desde terminal sin pegar
secreto en el chat ni en un enlace:

    UNFIRE_METRICS_ADMIN_URL="https://<ENDPOINT_REAL>/admin/summary" \
    UNFIRE_METRICS_ADMIN_TOKEN="<SECRET_SÓLO_EN_EL_ENTORNO>" \
    node scripts/unfire-audio-metrics-report.mjs

El informe distingue expresamente entradas (eventos) y cargas de página
(consentidas) de PERSONAS ÚNICAS y VENTAS PAGADAS. No colocar tokens reales
en comandos visibles, repositorios, tickets ni capturas.

## Seguridad de cuotas gratuitas (revisión 23/10/2026)

Cloudflare Workers Free incluye 100.000 solicitudes/día. Cloudflare D1 Free
incluye 100.000 filas escritas/día, 5 millones leídas/día y 5 GB de datos
(documentación oficial revisada el 23/10/2026). Al agotar el cupo, Cloudflare
interrumpe las operaciones hasta que se renueva. El juego no debe depender de
la disponibilidad de métricas.

NO desplegar la API sin ambos rate-limit bindings de wrangler.toml.example.
El Worker falla cerrado (503) si alguno falta o falla. Límites aproximados:
150 eventos/minuto por centro de datos y 20/minuto por UUID de carga de
página; los atacantes pueden forjar Origin y UUIDs, así que no equivale a
autenticación, prevención completa de bots ni conteo fiable de personas.
La API de limitación es aproximada por región. La API descarta cuerpos
de más de 512 bytes antes de escribir D1, también en chunked.

No instalar este Worker en rutas de WebGL ni usar métricas como registros de
pagos o premios. Cloudflare Wrangler requiere versión >=4.36 para el binding.
Antes de publicar, verificar cuotas, seguridad, logs, roles y costes reales.

## Controles visibles de consentimiento de audio

El módulo opcional assets/js/unfire-audio-metrics-consent.js muestra en
/audio/ un cuadro ES/EN con Aceptar estadísticas y Rechazar, enlace a
política y botón discreto Privacidad para cambiarlo posteriormente.
Utiliza la misma preferencia unfire-cookie-consent que la web corporativa
y despacha unfire:consent-updated al decidir. Si localStorage está bloqueado,
no se activa el seguimiento. No usar cookies para este módulo ni forzar
aceptación para jugar.

En integración host única, cargar además del cliente y del bridge:

    <script defer src="/assets/js/unfire-audio-metrics-consent.js"></script>

Revisar superposición del cuadro con HUD, orientación y accesibilidad real
antes de publicar. No editar host ni motor reservados en la PR de analíticas.

En la configuración real, asignar namespace_id únicos en tu cuenta para
ambos limitadores, sin reutilizar los de otras apps. Valores 1101/1102 del
ejemplo son orientativos y deben validarse antes del despliegue.

Rendimiento de red: el cliente envía JSON codificado en un cuerpo text/plain
(CORS simple) para reducir peticiones OPTIONS preflight. El Worker valida
estrictamente el JSON, el origen y los campos antes de escribir. No se envían
datos si hay rechazo del consentimiento, ni se bloquea el render/WebGL.
Compatibilidad móvil: el identificador efímero usa crypto.randomUUID cuando
está disponible y crypto.getRandomValues como fallback criptográfico en
Safari más antiguo. Sin RNG seguro, se desactiva analítica sin afectar juego.
