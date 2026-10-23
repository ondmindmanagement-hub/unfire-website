# Unfire — inventario de material visual auténtico (23/10/2026)

## Origen comprobado y permisos

- El archivo original local `UnfireTwenty/UnfireSingles/Marketing/README.md` documenta 20 interfaces *reales* de SwiftUI `ProcessorFace` exportadas desde `NSHostingView`, no renders generativos de su interfaz. El código original de cada procesador y su clase funcional figura en `UnfireTwenty/UnfireSingles/manifest.json` y en el README de cada uno. **Eso acredita el panel de prueba, no una prueba de funcionamiento fiable en todos los DAWs.**
- Cada una de las veinte carpetas `01-razora`…`20-lofi` tiene seis capturas de interfaz originales, dos símbolos y cuatro composiciones editoriales. 20 × 12 = 240 archivos de marketing presentes. Las imágenes de esta nueva galería provienen **únicamente** de `Actual-Live-UI-Dark.png` y `Profile-Square.png`: 40 derivados de tamaño/formato optimizado; sus hashes de origen y hash publicado figuran en `audio/visuales/assets-manifest.json`.
- `PhotoSources/sources.json` recoge fotos de Wikimedia Commons con CC0, CC BY y CC BY-SA. Las composiciones editoriales `Cover-01…04` son ilustrativas: muestran fotografías reales de estudios/personas ajenas a Unfire con superposición de interfaz, pero **no** una sesión real de esas personas usando los plugins. Están **excluidas** de la galería y de la campaña de venta, incluso cuando los derechos de la foto admitan ciertos usos. La identidad, permiso de imagen de personas reconocibles y condiciones de licencia exigen verificación separada. Tampoco se publican fotos del fundador.
- El fichero `Profile-Square.png` es una imagen sin palabras: no confundirlo con la captura real `Actual-Live-UI-Dark.png` que sí incorpora etiquetas de mandos del propio programa. Los símbolos son propuestas en desarrollo, NO iconos de App Store aprobados.
- Revisión visual de contacto local de 20 perfiles detecta **familias de símbolos demasiado parecidas** (p. ej. SHADOW/SILKX, VISCOSITY/SPARKS, NOVATONAL/SPRING CHROMA, MORPH/PIXELZ, AIRFLOW/AIRE, FLUX/LOFI). Antes de sustituir iconos de aplicaciones publicadas hay que crear perfiles específicos de identidad por SKU y probarlos a tamaños pequeños. No cambiar los iconos actuales a ciegas.

## Publicado aquí

- `/audio/visuales/`: galería Y2K de 20 interfaces de ingeniería. No altera la captura de la interfaz; la capa editorial cromada es CSS *fuera* de la imagen.
- `audio/visuales/real-ui/*.webp`: 20 screenshots capturados de interfaces SwiftUI y 20 símbolos originales exportados con redimensionado de publicación, hash de origen y sin fotos humanas.
- `audio/visuales/assets-manifest.json`: identidad, efecto, origen, checksums y aclaración `available_for_purchase:false` para los veinte FX. Los FX no son paquetes listos para vender aunque haya una UI nativa o una build experimental.
- `audio/catalogo/index.html`: enlace adicional y no intrusivo a capturas reales. Sin modificar el maletín, WebGL, primera visita, misiones, sincronización, pagos o App Store Connect.

## Política visual permanente y pruebas para cada aplicación

1. **Separar:** icono/avatar propio y sin letras; screenshot de UI real (obligatoriamente foto/captura auténtica de la app funcionando); fotografía documental real de personas (solo si están usando esa app y hay consentimiento/release y licencia); ilustración editorial (solo contextualizada, no testimonial).
2. **No usar** cara, fotos personales, retratos ni identidad del fundador, ni generar personas o supuestas sesiones como contenido publicitario de Unfire. No usar un actor como si hubiera comprado el plugin. No presumir autorización de retrato a partir de una licencia general de Wikimedia.
3. **App Store:** capturas deben enseñar mayoritariamente la app ejecutándose (2.3.3), no composiciones genéricas que la sustituyan. Dimensiones aceptadas deben salir de la ficha oficial al exportar: macOS 16:10 (1280×800, 1440×900, 2560×1600 o 2880×1800); iPhone Dynamic Island mediano (1179×2556 / 1206×2622 u otras aceptadas); iPad 13" tamaño compatible según dispositivo. Sin alfa y con texto legible. Fuente: https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications y https://developer.apple.com/help/app-review/guideline-reference/2-3-3-screenshots .
4. **No reutilizar capturas de un plugin diferente ni inventar su interfaz.** Para ARCHER Mac, ARCHER iOS, BOLT Mac y Power iOS, verificar el binario publicado y ejecutar esa versión en el simulador/dispositivo antes de exportar nuevos materiales. No presentar una captura web de catálogo como captura nativa de la app. Para el juego capturar WebGL real con su HUD, respetando consentimientos de jugadores antes de mostrar nombres/chat.
5. **Coherencia Y2K:** paleta cromada, negros profundos, acentos fríos y estructura editorial compacta; no bloquear controles o escribir textos sobre la ventana del plugin como si fueran mandos; evitar ventanas decorativas que el usuario no verá al abrir el programa.
6. **QA visual:** 320/390 móvil vertical, 844×390 móvil horizontal, escritorio 1365×768 y 1440×900; alineación, enfoque, contraste, alt, tamaños realistas, sin superposiciones, sin letra en iconos, fuentes disponibles; comprobar precarga y tamaños antes de publicar.
7. **Origen trazable:** copia de fuente/commit/build, fecha, resolución y SHA-256; licencia de fotografías, release de modelo, versión UI, revisión de reclamos y contenido; documentar todo por producto.

## Inventario de aplicaciones y trabajos pendientes, no simulados

| Producto | Canales de imagen | Estado en este trabajo |
|---|---|---|
| ARCHER Mac | Icono 1024 sin letras; 3–5 capturas nativas de ventana con parámetros reales; foto de uso opcional licenciada | Ficha pública real existe, pero NO se ha sustituido su media en App Store desde este trabajo |
| ARCHER iPhone/iPad | Icono sin letras; capturas reales separadas iPhone/iPad de binario publicado y sus controles | Por capturar/validar; no reutilizar UI macOS como si fuera móvil |
| BOLT Mac | Icono propio sin letras; flujo real de aprobación/registro con datos sintéticos | Por capturar de la app existente, no declarar integraciones externas no comprobadas |
| BOLT iOS | Capturas propias de build iOS, no de macOS | En revisión al último estado conocido, nada sustituido |
| Power Energy Prices | Pantallas reales de consulta, país/fuente y advertencia de precios estimados | Por capturar y validar versión publicada |
| Unfire Pocket Capture | Capturas de permisos/grabación reales y sin terceros identificables | Por validar nueva versión y publicación |
| Juego Unfire Audio | Maletín WebGL real, juego vertical/horizontal, artilugios, misiones y escena multijugador con datos no personales | Captura de pantalla real a planificar tras último merge del motor; NO reutilizar publicidad Synth como gameplay |
| FX20 | 20 iconos de concepto y 20 screenshots nativos de ingeniería | Galería de desarrollo publicada, NO App Store/comercial habilitado |
| Unfire Control y futuras apps | Identidad propia, grabación real en Mac y pruebas de permisos | Se requiere evidencia de la versión final; no inventar fotos ni funciones |

## Pasos fuera de este cambio

Solo cuando QA de cada binario confirme su identidad y soporte legal, compilar un lote de capturas nativas 16:10/vertical/tableta, auditar datos personales, revisar legal y subir a App Store Connect por tandas pequeñas, sin afectar revisiones ya abiertas. No abrir anuncios de descuentos ni venta de FX20 hasta validación del release gate y requisitos fiscales. Consultar registros de coordinación en GitHub issue #13 antes de editar archivos de juego y no dar por reales otras sesiones humanas solo porque existen imágenes de estudio con licencia.
