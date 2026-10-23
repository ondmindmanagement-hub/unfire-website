# Unfire Halloween — runbook real de rebajas, fidelización y premios

**Corte: 23/10/2026. Operación NO habilitada para público.** Este documento es interno de preparación. El pack MIDI en `/audio/halloween/` SÍ es público y auténticamente gratis. Nunca usar el sitio estático o un código inventado para cobrar ni adjudicar un plugin.

## 1. Rebajas del viernes 23 al sábado 31 de octubre de 2026

Comprobado por lookup público de Apple (España, 23/10/2026):

| Producto | ID App Store | Precio observado (ES) | Precio objetivo matemático (60 % menos, NO tarifa Apple confirmada) |
|---|---|---|---|
| ARCHER Mac | 6812968924 | 1,99 € | 0,796 € |
| ARCHER iPhone/iPad | 6822109610 | 1,99 € | 0,796 € |
| BOLT: Trusted AI Bridge Mac | 6814615903 | 22,99 € | 9,196 € |

**No publicar estas cifras objetivo como precios de venta.** Apple usa escalones de precios; 0,796 € y 9,196 € pueden no ser seleccionables. Seleccionar el escalón legal disponible y declarar el porcentaje REAL y el precio aplicado de cada producto, en cada país, incluyendo el historial de precio mínimo de los 30 días anteriores. No afirmar “-60 % en todo”: los FX20 no están publicados como compras web.

El Apple ID personal titular y la doble autenticación son necesarios para entrar a App Store Connect. El Mac cuenta con claves privadas `.p8` de API, pero **no hay configuración completa verificada con `issuerId`/rol y autorización de modificación**. No se escribió ninguna nueva rebaja en ASC. Al obtener acceso, para CADA aplicación: **Apps → ficha → Monetization → Pricing and Availability → Price Schedule (+) → Temporary Price Change**. Fechas propuestas 23 al 31 octubre (ajustar según horario y fecha efectiva de ASC y definir hora exacta de cierre). Seleccionar países, precio permitido y confirmar. Verificar luego cada precio en ficha App Store y lookup antes de publicar porcentaje/plazos. Apple: https://developer.apple.com/help/app-store-connect/manage-app-pricing/schedule-price-changes-for-apps/ . Normativa reducciones: https://www.boe.es/buscar/act.php?id=BOE-A-1996-1072 (arts. 19–20), https://boe.es/buscar/act.php?id=BOE-A-2017-11320 .

No realizar anuncios de 60 % si el historial de referencia o precio disponible hace la afirmación incorrecta. Cualquier operación pública queda también supeditada a situación fiscal/actividad del titular y revisión de las normas de Apple.

## 2. Código único tras comprar ARCHER

El código **no equivale** a un código de descuento para otra app Apple; promo codes oficiales de Apple son para copias gratuitas y tienen plazo/limitaciones. Un descuento para productos futuros de Unfire requerirá un catálogo realmente distribuible y checkout legal protegido. Fuentes: https://developer.apple.com/help/app-store-connect/offer-promo-codes/request-and-manage-promo-codes y https://developer.apple.com/help/app-store-connect/manage-in-app-purchases/create-offer-codes-for-in-app-purchases .

Protocolo: (a) comprador acepta recibir recompensa y verifica transacción usando StoreKit/App Store Server API, no captura susceptible de edición; (b) servidor autentica datos firmados de Apple sin registrar datos personales no necesarios; (c) se registra HMAC de `originalTransactionId` con UNIQUE, un código aleatorio de un solo canje y caducidad; (d) el beneficio tiene SKU real, importe/descuento, fecha y región; (e) backend realiza canje atómico y entrega/factura/refund donde corresponda. No pedir ID Apple ni contraseña. La simple web GitHub Pages **NO implementa** (a), (b) ni (e).

Código de pruebas local: `.github/operations/promo_ledger.py` y `.github/tests/test_promo_ledger.py` (ejecutar `python3 -m unittest discover -s .github/tests -p test_promo_ledger.py -v`). Usa SQLite transaccional, generación CSPRNG, solo hash HMAC y bloqueo por `audio/halloween/promo-status.json`; **no es un servidor desplegado ni entrega promociones reales**. Nunca publicar bases de datos ni secretos en repositorios. Un código de descuento de escritorio no puede reducir unilateralmente el precio que Apple cobra.

## 3. Ruleta Halloween 31/10/2026 — pendiente de trámite

Gencat exige comunicación **ANTES de empezar** y **tasa de 65,35 €**, trámite por internet con identidad digital. Actualmente la obligación de promotor con actividad comercial no está documentalmente verificada. https://canalempresa.gencat.cat/es/integraciodepartamentaltramit/tramit/PerTemes/9708-comunicacio-combinacions-aleatories . ATC indica adicionalmente un gravamen del **10 % del valor de los premios** para combinaciones aleatorias, con plazos propios: https://atc.gencat.cat/es/tributs/joc/rifes/ . No se ha hecho pago ni comunicación y no se debe lanzar.

Borrador de bases **NO PUBLICABLE** hasta completar: organizador (titular y domicilio fiscal), país y límites geográficos, participantes (edad mínima), fechas exactas, participación gratuita sin sobreprecio, mecanismo real de entrada y límite por participante, premios digitales enumerados con SKU/versión/compatibilidad/licencia, cantidades por premio, valor económico, probabilidad exacta, selección no manipulable, entrega verificada en plazo, incidencias/devoluciones/tributación, tratamiento RGPD, exclusión de patrocinio Apple, soporte y canal de reclamación. Incluir stock disponible para TODOS los resultados posibles; no asignar un premio que no pueda descargarse/activarse.

Al completar trámites y artefactos notarizados, autorizar un servicio de adjudicación con criptografía y bloqueos. La librería de laboratorio `promo_ledger.py` prueba selección segura sin reposiciones artificiales ni repeticiones; **sin registro legal y backend no lanzar ruleta ni llamar al giro “premio”**. El manifest `halloween_plugin_prize_wheel.enabled` permanece `false`.

## Criterios para pasar a público

- Descuento: precio mínimo 30 días y nuevo precio activo realmente comprobados por producto/territorio, y condiciones legales verificadas. Sin este punto NO publicar claims numéricos.
- Código: verificación robusta de Apple, servicio de canje probada, SKU entregable; entonces emitir códigos por compra real. Un número local con aspecto de cupón NO es una oferta.
- Ruleta: tramitación y tasas, bases, fiscalidad, registro, inventario y plugin firmados/notarizados y probados, mecanismo de premio verificado.
- Todos: consentimiento privado y protección de datos, ninguna clave/IBAN/identidad personal en GitHub, no comprometer misión principal del juego ni cambiar el maletín/DAW.

## Estado público real

`audio/halloween/promo-status.json`: único regalo público es 4 MIDI originales. Los tres incentivos monetarios están desactivados. El release gate de Unfire FX20 permanece desactivado hasta firma, notarización, licencias JUCE, compatibilidad, entrega, alta AEAT/SEPE/TGSS y proveedor de pago comprobados. No duplicar trabajo de otros capitanes; registrar progresos en issue #13.
