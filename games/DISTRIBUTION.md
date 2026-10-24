# Unfire Games — distribución gratuita

Estado: **propuesta en PR; sin publicación nueva en producción hasta merge, CI y comprobación de GitHub Pages**.

## Una entrada canónica sin duplicar el motor

- Futuro catálogo/hub: https://unfire.technology/games/ — games/index.html.
- Juego web actual: https://unfire.technology/audio/ — no se copia ni cambia audio/** en esta rama.
- La web se aloja en GitHub Pages sobre main; publicar esta ruta requiere integración aprobada y despliegue verificado.
- Navegación corporativa: pendiente de que el integrador de index.html (trabajo de #64/#83) añada un enlace a /games/. No modificar ese archivo desde esta rama.
- Unfire y UNFIRE Mutants son nombres propios y no deben traducirse.
- Imagen destacada: recurso ya incluido en audio/img/unfire-mutants-share.webp; no se genera ninguna imagen externa.

## Tres experiencias distintas (no confundir)

1. **Navegador:** abrir /audio/; es el producto jugable, no requiere descarga.
2. **Instalación web:** /audio/game.webmanifest existe y declara aplicación independiente, pero el botón/menú de instalación depende del navegador. No dar por garantizada la opción, el funcionamiento sin conexión, ni equivalencia con app nativa. En Chrome/Edge, usar instalación si aparece; en Safari para macOS, comprobar “Añadir al Dock”.
3. **Descargas nativas:** no hay .dmg/.exe/.AppImage verificadas. Mantenerlas sin enlace ni etiqueta “disponible” hasta tener builds probadas, firmadas o correctamente identificadas, y canal de actualización/soporte.

## Multijugador

El online actual se basa en salas **PeerJS P2P temporales**: necesita host, participantes y red compatibles; no hay servidor persistente verificado. Aún faltan pruebas reales con dos dispositivos, creación/invitación, host desconectado, reconexión, NAT y recuperación de estado. El portal puede enlazar al juego y explicar el estado, pero no garantizar que siempre se encontrará partida o que el host queda online. No introducir trackers ni credenciales en esta landing.

## Ruta de distribución (siempre gratuita para jugar)

| Canal | Siguiente paso | Estado |
|---|---|---|
| Web Unfire | QA cruzada y Pages tras integración | Ya existe ruta /audio/; /games/ propuesta |
| itch.io | Preparar HTML5 ZIP autocontenido con index.html en raíz y assets permitidos; QA embebida | No consta ficha publicada |
| Newgrounds | Adaptar empaquetado HTML5, controles, formato y derechos | No consta publicación |
| Poki | Verificar requisitos/SDK, enviar build/video/capturas originales por portal y esperar aceptación | Sin aceptación verificada |
| CrazyGames | Verificar SDK, políticas y QA de integración | Sin aceptación verificada |
| Descarga Windows/macOS/Linux | Diseñar empaquetado reproducible y builds de plataforma, probar binarios y actualización | No existe release certificada |

**Importante:** copiar solo /audio/ en un ZIP puede romper rutas relativas a ../, dependencias de red, CSP, PeerJS y ficheros. Crear **export separado de portal** sin alterar la web live; registrar licencias de muestras, fuentes, música, imágenes y vídeos antes de redistribuir. Si un portal exige SDK, anuncios o condiciones incompatibles, no publicar a ciegas.

Para una app de escritorio se puede evaluar Tauri/Electron u otro contenedor con motor web soportado en destino. Esto no convierte automáticamente un juego WebGL online en juego offline. No generar descargas sin validar arquitectura, tamaño, WebGL, sandbox, persistencia, controles, certificados, firmas, notarización cuando corresponda, malware screening, dependencia de un servidor online y requisitos de plataforma. Evitar gastos o registros de pago sin aprobación.

## Gates de publicación (ninguno se omite)

- [ ] Integrador único confirma que PR no colisiona con reservas de index.html, audio/** ni motor.
- [ ] node --test tests/unfire-games-landing.test.cjs OK sobre SHA exacto y GitHub Actions PASS.
- [ ] Verificar visualmente /games/ en escritorio y móvil, idiomas ES/EN, enlaces y accesibilidad.
- [ ] Verificar el juego /audio/ tras cambios de la release integrada; primera entrada, cápsulas, maletín, misiones, audio y controles no se ven alterados por este hub.
- [ ] Probar multijugador con dos equipos reales + reconexión y documentar limitaciones, antes de publicidad fuerte.
- [ ] Confirmar despliegue HTTPS de /games/ y enlace en navegación por dueño de la home; revertir si regresión.
- [ ] Cada portal externo: ficha real publicada y URL comprobada antes de mostrar botón de plataforma.
- [ ] Cada instalador: fichero existente, hashes, tamaño, pruebas en SO destino, revisión legal y compatibilidad antes de permitir descarga.

Fuentes de coordinación: GitHub issues #13 (juego), #44 (distribución), #78 (índice global); integración #83, no modificada aquí.
