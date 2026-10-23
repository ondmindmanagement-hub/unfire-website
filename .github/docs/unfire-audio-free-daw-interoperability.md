# Unfire Audio — juego gratuito, tienda opcional y plugin DAW interoperable

Fecha: 2026-10-23. **Plan de arquitectura, NO plugin AU/VST3 publicado.**

## Compromiso de producto

1. **Juego gratuito:** el mundo web `https://unfire.technology/audio/` debe seguir siendo plenamente jugable sin comprar un producto, registrarse o introducir tarjeta. El contenido de misión principal, guardar partida, maletín, transporte y exploración no quedan detrás de compras.
2. **Plugin del propio juego gratuito:** preparar producto separable `UNFIRE Audio World` para DAWs (macOS AUv3/VST3, Windows VST3 posteriormente), sin prometer compatibilidad hasta crear binarios, firmarlos y probarlos.
3. **Compras opcionales:** objetos y previews cosméticos, plugins DSP, instrumentos y aplicaciones comerciales se diferencian claramente. No vender demos como archivos de producción, no cobrar por contenido que aún no puede entregarse, no usar mecánicas de azar pagadas.
4. **Interoperabilidad gradual:** juego ⇄ DAW ⇄ artilugios ⇄ robots ⇄ instrumentos, con protocolos públicos versionados, consentimiento del usuario, sincronización y mecanismos de recuperación ante fallos.
5. **Monetización legítima:** si una versión se distribuye en App Store y desbloquea contenido digital dentro de la app, evaluar StoreKit y las reglas App Review 3.1 según región/entitlement; NO suponer que una tienda web externa puede sustituir siempre a IAP. Para plugin desktop fuera de App Store, futura venta directa exige merchant verificado, fiscalidad, consentimiento, entrega y pruebas según `.github/audio-commerce-release.json`.

## Productos y estado el 23/10/2026

| Canal | Producto | Estado de disponibilidad | Acción comercial permitida hoy |
| --- | --- | --- | --- |
| Web | Juego `Unfire Audio` | Público y gratuito | Enlazar a juego sin pago |
| Mac App Store | `Archer by Unfire`, 6812968924 | Ficha oficial publicada | Enlace a tienda externa |
| iPhone/iPad App Store | `Archer for iPhone & iPad`, 6822109610 | Ficha oficial publicada | Enlace a tienda externa |
| Mac App Store | `BOLT: Trusted AI Bridge`, 6814615903 | Ficha oficial publicada | Enlace a tienda externa |
| iPhone/iPad App Store | `Power Energy Prices`, 6815880143 | Gratuito, publicado | Enlace a tienda externa |
| Web | FX20/synth/armazones/robots | Demos y builds parciales; release no certificada | Mostrar demostraciones, NO activar checkout |
| DAW | `Unfire Audio World` AU/VST3 | Diseño propuesto, sin binario publicable | Mostrar como «en desarrollo», no descargar ni reservar |

Verificar URLs y precios por país con el catálogo de Apple antes de campañas. Las Apps del catálogo son productos distintos: no afirmar que BOLT o Power son plugins de audio.

## Propuesta técnica por capas

```text
[Juego Web/3D]             [Plugin AUv3 macOS]    [Plugin VST3 macOS/Windows]
      |                          |                         |
      +------ [Unfire Scene Protocol v1: mensajes JSON validados] ------+
                                 |
                    [Local Bridge: eventos/tempo/MIDI/estado]
                                 |
           [Audio/MIDI engine real-time seguro + DSP por SKU]
                                 |
       [DAW transport | tempo | playhead | presets | automatización]
```

### Fase A — Contrato de datos (sin modificar audio ni motor actual)

- Protocolo de mensajes con `version`, `source`, `session`, `kind`, `seq`, `timestamp`, `payload`, límites de tamaño, tipos permitidos y validación estricta; no ejecutar código que llegue del juego.
- Eventos: `transport.play`, `transport.stop`, `transport.tempo`, `note.on`, `note.off`, `parameter.set`, `preset.load`, `scene.object`, `scene.robot`, `host.capabilities`, `host.disconnected`.
- Modo lectura por defecto, control de permisos claro para enviar MIDI o automatización al DAW. Todo evento requiere origen/sesión conocidos y límites de tasa.
- Al salir del plugin/DAW, el juego web sigue jugando sin depender de la instalación ni del bridge. Los robots y artilugios sin capacidades DAW usan fallbacks no destructivos.

### Fase B — Primer AUv3 macOS gratuito

- Plugin AUv3 de utilidad real, primero MIDI/estado/tempo con UI ligera (no forzar 3D completo dentro de un hilo de audio). Al activarse puede abrir una vista del mundo en un proceso/UI separado; nunca cargar WebGL dentro del render callback.
- Todos los callbacks de audio son deterministas y de tiempo real; sin red, disco, bloqueos, asignaciones dinámicas ni autenticación en el hilo de audio. Modo silencioso/bypass explícito y de latencia documentada cuando el plugin no genere audio.
- Permitir sincronización host → juego del BPM, posición musical y play/stop. Contratipo juego → host: MIDI con opt-in; no controlar otras pistas/apps del usuario sin permiso.
- Guardar `projectState` compatible con restauración de sesión y cambios de DAW. QA Logic Pro/Ableton/Reaper/Cubase según disponibilidad; no anunciar soporte sin pruebas.

### Fase C — VST3 macOS/Windows

- Reutilizar el mismo contrato de mensajes y DSP; wrapper propio VST3 para DAWs no AU. Compilar Windows en CI o hardware Windows real, empaquetar x64/ARM cuando se valide, firmar con los certificados correspondientes.
- La disponibilidad del DAW y permisos de host varían; si WebView/3D no funciona en un host, ofrecer interfaz ligera compatible sin bloquear el audio.
- Test de carga, CPU, buffer 32/64/128/256/512 samples, cambios de sample rate, crash/reload, cambios de proyecto y estrés de 8+ instancias.

### Fase D — Instrumentos, robots y persistencia

- Componentes del mundo mapean a `deviceId`/`parameterId` estables; los instrumentos reales indican si son demo, gratis o comprados. Estado de escena y preset recuperable incluso sin conexión.
- Importación/exportación de presets, patrones MIDI y parámetros autorizados (sin prometer audio stems o control directo de otras apps hasta implementarlos).
- Futuro entitlement portátil entre plugin desktop y web, con firma servidor y cache local limitada; si el servicio cae, se mantienen funciones gratuitas y contenidos ya permitidos por su licencia.
- Los contenidos de terceros (samples, fotos, vídeo, marcas, modelos 3D) requieren permisos de explotación comercial verificables. Los frameworks de audio, JUCE cuando se use, y cualquier librería de código deben tener licencias de distribución apropiadas para cada SKU antes de venderlo.

## Puertas de publicación y riesgos

- Guard legal comercial `.github/audio-commerce-release.json` sigue con `direct_web_checkout_authorized:false`; nunca activarlo por esta hoja de ruta.
- No exponer botones de compra en DAW o apps App Store que incumplan sus normas de IAP; evitar ventas incrustadas engañosas.
- Establecer licencia exacta de plugins gratuitos, política de privacidad y permisos micro/MIDI/local network antes de distribución. Sin telemetría de escucha ni envíos ocultos.
- Medir rendimiento en dispositivos reales (CPU/RAM/WebGL, audio xruns, 32–1024 frames), interoperabilidad en hosts, orientaciones móviles, accesibilidad, bloqueo y recuperación.
- Mantener backups/restauración; PRs aisladas; preservar la versión pública del juego y las primeras tres misiones; no sobrescribir PRs heredadas.
- Requisitos legales previos de comercio: SEPE, AEAT/036, TGSS/RETA, vendedor, impuestos, licencias, desistimiento digital, entregas y soporte. Incluso canales externos exigen comprobar situación del titular: no hay garantía de elegibilidad automática.

## Fuentes

- [AUv3 Apple](https://developer.apple.com/documentation/audiotoolbox/audio-unit-v3-plug-ins)
- [Render en tiempo real Apple](https://developer.apple.com/documentation/audiotoolbox/auaudiounit/renderblock)
- [App Review: monetización digital](https://developer.apple.com/app-store/review/guidelines/)
- [SEPE: compatibilidades](https://www.sepe.es/HomeSepe/prestaciones-desempleo/quiero-cobrar-el-paro/incompatibilidad_compatibilidades)
- [AEAT alta actividad 036](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/guia-practica-cumplimentacion-modelo-censal-036/capitulo-01-cuestiones-generales/plazos-presentacion/declaracion-alta/alta-censo-empresarios-profesionales-retenedores-036.html)
