# UNFIRE WORLD LAB — piloto experimental aislado

**Estado: prototipo técnico; NO publicado como tienda, NO conectado a pagos y NO integrado en el motor de Unfire Audio.**

La rama fue creada específicamente para el primer experimento del [issue #43](https://github.com/ondmindmanagement-hub/unfire-website/issues/43). No modifica \`audio/\`, rutas de producción ni datos de otros proyectos.

## Qué funciona

- Página semántica y adaptable; vista 2D utilizable desde el primer HTML.
- Objeto tridimensional original calculado como una malla de seis caras subdivididas; shader WebGL 1 interpola **vértices y normales** de cubo a esfera en tiempo real.
- Control de rango con teclado/táctil, botón con transición de 700 ms y giro horizontal con puntero.
- \`prefers-reduced-motion\`: botón transforma sin interpolación temporal.
- Sin librerías externas, descargas remotas, telemetría, formularios, cookies ni checkout.
- Un enlace explícito a la demostración pública y REAL de [Unfire Audio](https://unfire.technology/audio/).
- Si WebGL no existe o falla, se muestra alternativa 2D y el contenido informativo no desaparece.
- Dibujado por demanda; no hay renderizado continuo cuando el visitante no interactúa.
- Límite de densidad de render del dispositivo para contener la carga de GPU.

La geometría de ejemplo **no es un modelo comercial ni una captura real de Unfire Audio**. No hay tienda ajena ni productos con licencia de terceros. No anunciarlo como centro comercial funcional.

## Cómo probar localmente

Desde raíz de repositorio (en una copia o worktree separado):

\`\`\`bash
python3 -m http.server 48763
\`\`\`

Abrir \`http://127.0.0.1:48763/experiments/unfire-world-pilot/\`.

**Prueba de sintaxis:**

\`\`\`bash
node --check experiments/unfire-world-pilot/world.js
node experiments/unfire-world-pilot/world.static.test.cjs
\`\`\`

**Prueba real navegador:** usar Chromium/Chrome con Puppeteer instalado en entorno de QA, servidor HTTP local y \`world.browser.test.cjs\`. No se instala una dependencia en el proyecto de producción. Ejemplo:

\`\`\`bash
UNFIRE_WORLD_TEST_URL=http://127.0.0.1:48763 \
PUPPETEER_MODULE=/ruta/absoluta/a/puppeteer \
node experiments/unfire-world-pilot/world.browser.test.cjs
\`\`\`

## Primer resultado local documentado — 23 octubre 2026

Mac autorizado + Chrome headless (WebGL SwiftShader, **no** dispositivo físico); rama verificada tras arreglar un problema de precisión GLSL:

- **5 tamaños de viewport:** 1280×800, 844×390, 390×844, 320×568, 280×653.
- HTTP 200, \`drawElements\` WebGL real ejecutado, \`gl.getError() == 0\`, scroll horizontal 0 y sin excepciones de página.
- Slider actualiza valor, botón transforma y vuelve a estado anterior.
- **1 caso de fallback sin WebGL:** visible, canvas oculto, control informativo operativo.
- **Resultado: 6/6 comprobaciones principales PASS.**

**Limitaciones:** este test en navegador emulado no acredita rendimiento, temperatura, accesibilidad asistiva ni fiabilidad de Safari iOS/Android físicos. Las cifras de carga y FPS están **pendientes**, así como licencias, producto vendible y validación fiscal/contractual.

## No mezclar con producción

No fusionar ni publicar sólo por pasar los smoke tests. Necesita revisión de producto y QA física de móviles, contraste visual, recuperación al perder el contexto WebGL, protección de rutas originales y revisión de seguridad/legales. Integración siempre serializada con el responsable de Unfire Audio conforme al [issue #13](https://github.com/ondmindmanagement-hub/unfire-website/issues/13).

Los scripts de experimento no son parte de las pruebas obligatorias del motor \`maletin\`; se pueden ejecutar por separado.
