# Unfire Audio Halloween 2026 — campaña ética y controles de entrega

Revisión: 23 octubre 2026. Ruta pública segura: `/audio/halloween/` (4 MIDI propios GRATIS para todos). **Las ofertas monetarias y la ruleta de premios no están activas.**

## Operación real ya disponible

- Regalo sin compra ni datos personales: ZIP de cuatro pistas MIDI originales, licencia de uso musical comercial incluida. Descarga estática segura desde el dominio principal; no se pide un email. El regalo sirve como muestra del universo UNFIRE, sin prometer ninguna compra ni acceso a plugins DSP.
- ARCHER para Mac y para iPhone/iPad sigue en sus fichas oficiales App Store. BOLT y resto de apps en la tienda oficial, sin checkout propio. No hay descuento anunciado en web hasta que Apple haya aplicado y publicado el precio.
- Sin reseñas ficticias, anuncios de ventas inexistentes, urgencias artificiales, precios anteriores inflados, falsas existencias ni ruletas trucadas. La experiencia de juego y su progreso permanecen gratuitos.

## 60 % de descuento temporal — PREPARACIÓN, NO VENTA ACTIVA

Solicitud del titular: promoción hasta el 31/10/2026 desde el 23/10/2026, sujeto a hora de comienzo realmente verificable y a las condiciones de Apple por país. No afirmar «-60 % en todo»: no todos los productos están en venta ni se pueden rebajar desde esta web.

1. App Store Connect, ficha de **cada aplicación de pago realmente publicada**: comprobar acuerdos, territorios, tasa/comisión, precio actual, histórico de 30 días y mínimo previo del artículo. Habilitar un **temporary price change** de fecha y hora verificables, seleccionar puntos de precio reales de Apple (pueden impedir -60 % exacto), revisar países y devolución al precio ordinario. Confirmar primero la documentación fiscal y de actividad del titular; no presuponer compatibilidad con prestaciones SEPE.
2. Verificar después `https://itunes.apple.com/lookup?id=...&country=es` y la ficha humana hasta que el precio efectivo coincida. La diferencia porcentual debe calcularse usando el precio anterior legalmente válido y precio efectivo, redondeos y país. Solo entonces publicar banner con producto, fechas, zona, condiciones, precio previo y nuevo.
3. Si App Store no ofrece el punto de precio exacto, anunciar la reducción realmente aplicada, nunca «60 %» falso.
4. Web FX20/VST3/AU o futuros plugins NO disponibles en comercio directo hasta abrir el release gate: licencias JUCE/terceros, firma/notarización, pruebas DAW, inventario por SKU, AEAT/SEPE/TGSS, comerciante y pagos confirmados, webhook y entrega; no sustituirlo con una etiqueta de precio de venta ficticia.

Fuentes: https://developer.apple.com/help/app-store-connect/manage-app-pricing/schedule-price-changes-for-apps ; https://www.boe.es/buscar/act.php?id=BOE-A-1996-1072 (artículos 19-20).

## Código único para compradores de ARCHER — ESQUEMA FUTURO

**No emitir ni prometer de forma automática todavía.** Una compra de ARCHER en App Store no da a GitHub Pages identidad verificable del comprador ni hay canje de un cupón arbitrario sobre otras apps de Apple. Los códigos promo de aplicaciones de Apple permiten una copia GRATUITA, no un descuento porcentual arbitrario para todos los productos. Para compras integradas, hay códigos de oferta específicos bajo condiciones StoreKit.

Flujo futuro: el usuario opta voluntariamente a un beneficio; servidor verifica derecho de compra usando un canal oficial/receipt de Apple o documentación de compra limitada y minimizada; política antifraude con límite uno por transacción/original transaction id, hash HMAC unidireccional del identificador, expiración y revocación. Servidor genera 128 bits de aleatoriedad CSPRNG, guarda solo hash del código con SQL transaccional UNIQUE, canje único/idempotente, ámbito SKU específico, importe y fechas. Datos y correo con consentimiento RGPD, política de conservación y proceso de borrado. El código **solo se redime en una tienda que admita cupones y tenga checkout seguro**, nunca en la web estática ni sobre precio de Apple si Apple no lo permite. Si son códigos App Store, usar exclusivamente códigos válidos generados por App Store Connect, sin inventarlos.

Fuentes: https://developer.apple.com/help/app-store-connect/offer-promo-codes/request-and-manage-promo-codes ; https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-offer-codes-for-in-app-purchases

## Ruleta de Halloween con premio plugin — ESQUEMA FUTURO NO ACTIVADO

Fecha de intención: 31 octubre 2026. Es una promoción aleatoria con premios de valor económico, **no** una rueda decorativa. La Dirección General de Ordenación del Juego estatal explica que las combinaciones promocionales pueden quedar fuera de licencia general; pero **Cataluña exige comunicación previa, tasa y condiciones específicas**. Fuente oficial: https://canalempresa.gencat.cat/es/integraciodepartamentaltramit/tramit/PerTemes/9708-comunicacio-combinacions-aleatories ; no iniciar antes de verificar territorio, presentar comunicación y liquidar la tasa si aplica.

Condiciones necesarias antes de lanzar: bases publicadas con organizador real y datos legales, ámbito geográfico, edad/requisitos, duración y zona horaria, participación gratuita y ausencia de sobreprecio, probabilidades precisas verificables, listado de plugins disponibles y cantidades, valor del premio, entrega/acceso válido y compatibilidad, privacidad, impuestos sobre premios cuando correspondan, reclamación/incidencias y exclusión clara de Apple como patrocinador en versiones App Store. La asignación se debe realizar y persistir en un servidor autoritativo que evite repetir spins y simular premios no entregables; control de inventario legal y técnico por SKU, logs y test antifraude. Sin licencias de plugins y mecanismo de entrega NO se puede prometer el plugin gratis.

Apple App Review 5.3 para sorteos en apps: https://developer.apple.com/app-store/review/guidelines/

## Convertir sin engañar

- Demostración jugable gratuita → acceso claro a ARCHER oficial; mostrar antes/después real con sonido reproducible y permisos apropiados.
- Regalo gratuito funcional y documentación de compatibilidad antes del checkout; CTA claros, sin romper el juego con popups.
- Mensajes diferenciales: Mac vs iPhone/iPad, no afirmar que se entrega VST3 por comprar app móvil.
- Mostrar testimonios reales solo con consentimiento; datos de popularidad solo con métricas verificables.
- No usar ruedas o interfaces que manipulen probabilidades en secreto, ni presentarlas como gratuitas si imponen una compra.

## Puertas técnicas

`audio/halloween/promo-status.json` establece descuentos, beneficios comprador y premios aleatorios `enabled:false`; el test `halloween-offer-gate.test.cjs` comprueba que la página pública no tenga afirmaciones falsas, que el zip existe con cuatro MIDI y que el checkout web sigue apagado. Para habilitar promociones monetarias hace falta PR posterior con evidencia externa de precio efectivo y comprobación fiscal/licencias. Nunca colocar tokens, identificación de clientes ni documentos fiscales públicos en GitHub.
