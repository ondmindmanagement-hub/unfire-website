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

GET /admin/summary, protegido con secreto, devolverá contadores diarios y **sesiones de pestaña anónimas**, no personas únicas, usuarios registrados ni MAU verificados. Facturación/ventas requieren fuentes oficiales de la plataforma de cobro y ajustes por devoluciones.

## Privacidad

- Envío solo después de 'unfire-cookie-consent=accepted'. Rechazo o error de almacenamiento o endpoint ausente => ningún evento.
- UUID aleatorio en memoria por pestaña; no persiste al recargar. Nada de IP, email, identidad, cookies, fingerprint, URLs, parámetros, checkout ni pedidos en D1.
- El Worker ve la conexión HTTPS pero no persiste la IP. Auditoría independiente de logs/retención Cloudflare necesaria antes de publicar.
- Se conservan resúmenes diarios y UUIDs de pestaña hasta 35 días, con purga programada. No interpretar sesiones como usuarios únicos.
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
- analytics/unfire-audio/worker.mjs + schema.sql — colector opcional de agregados sin nombres ni IP.
- analytics/unfire-audio/wrangler.toml.example — configuración incompleta, NO desplegar sin provisión.
- tests/unfire-audio-metrics.test.mjs — QA ligero sin navegador.

Coordinación de reservas en https://github.com/ondmindmanagement-hub/unfire-website/issues/13 y registro global #78.
