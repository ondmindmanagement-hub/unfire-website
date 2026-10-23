# UNFIRE Audio — autorización legal y técnica de ventas web (España / UE)
Fecha de revisión: 23-10-2026. **NO es un certificado de cumplimiento ni una autorización de venta.**
Este documento complementa `.github/docs/fast-checkout-merchant-setup.md` y la política pública.
Titular previsto: persona física (Unfire es nombre comercial, no una sociedad constituida).

## Estado verificable
- `main` contiene catálogo, bolsa, condiciones ES/EN, licencia y página de compatibilidad.
- `PAY` no contiene enlaces LIVE válidos y `READY_FOR_SALE = new Set([])`.
- La web es GitHub Pages (estática); **no dispone de backend autenticado de entrega/licencias** ni webhook fiable de Stripe. Una pantalla de éxito / redirección no demuestra un cobro irrevocable.
- Hay prototipos y compilaciones internas; la QA de instaladores para todos los FX en macOS/Windows, firma/notarización, entrega y términos por SKU no están acreditadas. **No vender promesas de entrega como descargas inmediatas.**
- Los productos que se vendan en plataformas externas pueden enlazarse únicamente a su ficha verificada; la transacción ocurre en la plataforma. No incluir en la misma bolsa web un SKU inexistente de ARCHER ni confundir ARCHER con `todo`.

## Puertas obligatorias antes de autorizar el primer SKU
1. **Titular real y pago:** completar verificación de comerciante individual en Stripe, representante, actividad, dominio, beneficiario y cuenta de abono a nombre del titular. NO guardar identidad fiscal, IBAN, contraseñas ni evidencia sensible en GitHub.
2. **Actividad fiscal:** verificar censo AEAT y tramitar modelo 036 antes del inicio exigible de la actividad; clasificar epígrafe/IVA/IRPF con asesoría, verificar facturación, registros y RETA/Seguridad Social. No suponer que ingresar poco dinero evita obligaciones.
3. **Prestación SEPE:** si se percibe paro/subsidio, identificar régimen exacto y resolver alta, comunicación o compatibilidad ANTES de comenzar la actividad. El SEPE indica que en prestación contributiva, si se cumplen las condiciones, la compatibilidad por trabajo autónomo puede durar hasta 270 días y debe solicitarse dentro de 15 días desde el inicio. No inferir automáticamente elegibilidad.
4. **Identificación LSSI:** aviso legal con identidad completa del vendedor y datos legalmente exigibles, información de contacto y, cuando proceda, registros. Verificar publicación de dirección/NIF con el titular y un profesional, sin difundir datos privados en repositorios por adelantado.
5. **Derechos del consumidor:** ficha exacta con funcionalidad, interoperabilidad (DAW, CPU, macOS/Windows, VST3/AU), restricciones, duración, actualizaciones/soporte, precio total con impuestos y moneda. Antes de pagar ofrecer idioma, pasos, corrección de errores y archivo/consulta del contrato. Orden con obligación de pago explícita.
6. **Entrega digital/desistimiento:** respetar derecho general de desistimiento de 14 días. Si se solicita entrega inmediata que afecta a ese derecho, obtener consentimiento expreso **separado** y conocimiento de su consecuencia, y confirmar ambos en soporte duradero; sin consentimiento no presumir renuncia. Aun con excepción, mantener remedios por contenido digital defectuoso o no conforme.
7. **IVA servicios electrónicos:** determinar ubicación del cliente y reglas B2C UE. AEAT recoge regla/umbral agregado de 10.000 € cuando se opera únicamente desde un Estado miembro, y OSS como opción; el escenario y tratamiento concreto deben verificarse antes de cobrar. Precios e importes fiscales reales se calculan **en servidor/Stripe**, no desde una suma manipulable en HTML.
8. **Privacidad, cookies y seguridad:** configurar avisos RGPD, base jurídica, conservación de datos de ventas, tratamiento Stripe/proveedor de correo, derechos de interesados y cookies no esenciales sujetas a consentimiento; no recopilar tarjetas en el sitio.
9. **Entrega y licencias:** para cada SKU preparar instaladores genuinos firmados/notarizados, hashes SHA-256, plataformas y versiones probadas en equipos reales, licencias verificables, descarga privada temporal y plan de re-descarga, incidencias, devoluciones y actualizaciones. Nunca dejar binarios comerciales descargables sin control en GitHub Pages.
10. **Backend/verificación:** usar servidor seguro (p. ej. función serverless autorizada) con claves **solo en secretos**, verificar firma `Stripe-Signature` en webhook, ID de evento único (idempotencia), modo LIVE, SKU/importe/moneda/estado `paid`, no entregar ante pago incompleto, crear acceso único expirable y confirmación duradera de compra. Probar disputas, pagos fallidos, reintentos, cancelación de suscripción, IVA y recibos. No confiar en parámetros de retorno del navegador.
11. **Suscripciones:** UNFIRE Club únicamente cuando haya catálogo/entitlements reales, condiciones de renovación/precio, método de cancelación accesible, correos y fin de acceso tras cancelación comprobados; no prometer permanencia a 12 meses si no puede cumplirse técnicamente.
12. **QA final:** prueba controlada por producto y OS, restore/update, 3-D Secure/wallets, dispositivo móvil, emails/descarga tras pérdida de conexión, duplicados de webhook, refund, conservación de términos aceptados, accesibilidad. Revisar legalidad con profesional habilitado; resultados en registro privado sin documentos personales públicos.

## Integración técnica — no activar a ciegas
- `.github/audio-commerce-release.json` guarda únicamente comprobaciones booleanas sin PII, y el estado inicial **no autorizado**.
- `.github/tests/audio-commerce-release-gate.test.cjs` y su workflow hacen fallar CI si se añaden SKUs a `READY_FOR_SALE` sin todas las verificaciones y constancia de versión/entrega.
- Esta defensa no reemplaza los justificantes reales ni puede demostrar por sí sola licitud, firma o funcionamiento. Revisar documentación del titular fuera de GitHub antes de cambiar un booleano.
- El checkout actual usa un enlace por SKU, NO una cesta multipartida segura; no prometer pago combinado de todos los plugins. Si se desea cesta real, diseñar Checkout Sessions en backend con su tabla de precios inmutable y webhooks.
- GitHub PR #25 tiene el ámbito comercial ARCHER y otro capitán edita maletín: esta rama no modifica `audio/index.html`, ni motores, ni checkout actual. Fusionar tras inspección de CI sin revertir otras ramas.

## Fuentes oficiales consultadas
- [AEAT — Declaración de alta censal Modelo 036](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/guia-practica-cumplimentacion-modelo-censal-036/capitulo-01-cuestiones-generales/plazos-presentacion/declaracion-alta/alta-censo-empresarios-profesionales-retenedores-036.html)
- [AEAT — IVA comercio electrónico y ventanilla única OSS](https://www3.agenciatributaria.gob.es/Sede/iva/iva-comercio-electronico/regimenes-especiales-ventanilla-unica.html)
- [AEAT — servicios electrónicos y umbral B2C UE](https://sede.agenciatributaria.gob.es/Sede/iva/iva-comercio-electronico/iva-telecomunicaciones-servicios-electronicos.html)
- [SEPE — trabajo por cuenta propia y prestación contributiva](https://sepe.es/HomeSepe/prestaciones-desempleo/cobrando-prestacion-subsidio-desempleo/trabajo-como-autonomo.html)
- [BOE — Ley 34/2002 LSSI](https://www.boe.es/eli/es/l/2002/07/11/34)
- [Your Europe — venta a distancia, software digital y consentimiento de desistimiento](https://europa.eu/youreurope/business/selling-in-eu/selling-goods-services/ecommerce-distance-selling/index_en.htm)
- [Directiva 2011/83/UE consolidada — derechos del consumidor](https://eur-lex.europa.eu/legal-content/ES/TXT/?uri=CELEX:02011L0083-20220528)

**NUNCA** activar pagos por la mera creación de esta PR. El titular debe completar verificaciones personales fuera del repositorio y aprobar individualmente los productos realmente entregables.
