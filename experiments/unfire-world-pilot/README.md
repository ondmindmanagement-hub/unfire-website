# UNFIRE WORLD LAB — piloto experimental aislado

**Estado: prototipo técnico; NO publicado como tienda, NO conectado a pagos y NO integrado en el motor de Unfire Audio.**

La rama fue creada específicamente para el primer experimento del [issue #43](https://github.com/ondmindmanagement-hub/unfire-website/issues/43). No modifica `audio/`, rutas de producción ni datos de otros proyectos.

## Qué funciona

- Página semántica y adaptable; vista 2D utilizable desde el primer HTML.
- Objeto tridimensional original calculado como una malla de seis caras subdivididas; shader WebGL 1 interpola **vértices y normales** de cubo a esfera en tiempo real.
- Control de rango con teclado/táctil, botón con transición de 700 ms y giro horizontal con puntero.
- `prefers-reduced-motion`: botón transforma sin interpolación temporal.
- Sin librerías externas, descargas remotas, telemetría, formularios, cookies ni checkout.
- Un primer escaparate informativo de **Unfire Audio**, con fotografía auténtica del maletín almacenada en este repositorio (`audio/img/maletin-real-first-frame-desktop.webp`, 1100×635, aproximadamente 31 KB), y enlace a la demostración pública y REAL: https://unfire.technology/audio/. No se ofrecen compras.
- Si WebGL no existe o falla, se muestra una alternativa 2D **interactiva** que responde al slider y mantiene la navegación; también se ha probado restauración del contexto gráfico tras pérdida simulada.
- Dos zonas navegables por enlaces HTML normales; salida sin registro hacia el juego verdadero.
- Dibujado por demanda; no hay renderizado continuo cuando el visitante no interactúa.
- Límite de densidad de render del dispositivo para contener la carga de GPU.

La geometría de ejemplo **no es un modelo comercial ni una captura real de Unfire Audio**. No hay tienda ajena ni productos con licencia de terceros. No anunciarlo como centro comercial funcional.

## Cómo probar localmente

Desde raíz de repositorio (en una copia o worktree separado):

```bash
python3 -m http.server 48763
```

Abrir `http://127.0.0.1:48763/experiments/unfire-world-pilot/`.

**Prueba de sintaxis:**

```bash
node --check experiments/unfire-world-pilot/world.js
node experiments/unfire-world-pilot/world.static.test.cjs
```

**Prueba real navegador:** usar Chromium/Chrome con Puppeteer instalado en entorno de QA, servidor HTTP local y `world.browser.test.cjs`. No se instala una dependencia en el proyecto de producción. Ejemplo:

```bash
UNFIRE_WORLD_TEST_URL=http://127.0.0.1:48763 \
PUPPETEER_MODULE=/ruta/absoluta/a/puppeteer \
node experiments/unfire-world-pilot/world.browser.test.cjs
```

## Primer resultado local documentado — 23 octubre 2026

Mac autorizado + Chrome headless (WebGL SwiftShader, **no** dispositivo físico); rama verificada tras arreglar un problema de precisión GLSL:

- **5 tamaños de viewport:** 1280×800, 844×390, 390×844, 320×568, 280×653.
- Documento local HTTP 200 o revalidación legítima de caché 304; `drawElements` WebGL real ejecutado, `gl.getError() == 0`, scroll horizontal 0 y sin excepciones de página.
- Slider actualiza valor, botón transforma y vuelve a estado anterior.
- **1 caso de fallback sin WebGL:** representación 2D visible, canvas oculto, slider modifica el estado.
- **Modo de movimiento reducido:** transforma sin animación interpolada.
- **Pérdida/restauración WebGL:** prueba de extensión `WEBGL_lose_context` con retorno a 2D y recuperación de la escena.
- Capturas completas en Chrome de escritorio y móvil emulado revisadas visualmente: sin solapamientos ni scroll horizontal.
- Captura real de Unfire Audio decodificada en navegador desde el repositorio; no se inventan marcas de terceros.
- **Resultado final del prototipo (HEAD de QA `6cafe747`): 17/17 tests estáticos PASS y 8/8 pruebas de navegador PASS**, además de la sintaxis JS correcta.

**Limitaciones:** este test en navegador emulado no acredita rendimiento, temperatura, accesibilidad asistiva ni fiabilidad de Safari iOS/Android físicos. Chrome headless/SwiftShader ha mostrado variaciones y bloqueos de arranque gráfico de varios segundos; las lecturas de First Paint de ese entorno no equivalen al tiempo real de un teléfono. WebGL se inicia después de dar oportunidad de pintado al HTML/2D; el comportamiento real debe medirse y optimizarse en equipos físicos. Las cifras de carga y FPS están **pendientes**, así como licencias, producto vendible y validación fiscal/contractual.

## No mezclar con producción

No fusionar ni publicar sólo por pasar los smoke tests. Necesita revisión de producto y QA física de móviles, **rendimiento/carga inicial medidos en hardware real**, protección de rutas originales, verificación de derechos de contenido y revisión de seguridad/legales. La recuperación de WebGL se ha probado sólo en Chrome emulado, no se da por certificada en todos los dispositivos. Integración siempre serializada con el responsable de Unfire Audio conforme al [issue #13](https://github.com/ondmindmanagement-hub/unfire-website/issues/13).

Los scripts de experimento no son parte de las pruebas obligatorias del motor `maletin`; se pueden ejecutar por separado.
