# UNFIRE Audio — activación segura de cobro rápido
Estado (2026-10-23): **integración preparada, pagos NO ACTIVADOS**.

## Titular SIN sociedad constituida (España)
- **No registrar a Unfire como SL, LLC ni entidad constituida.** Unfire se utiliza como nombre/marca comercial, no como razón social ficticia.
- Stripe admite un comerciante individual: durante el alta elegir **Empresa individual / Autónomo / Persona física**, según el texto que el formulario de España ofrezca. Nombre del titular: identidad legal real (documento nacional); nombre comercial o descriptor: Unfire. Stripe debe validar identidad, dirección, actividad, dominio y cuenta bancaria, sin compartir contraseñas ni documentos en el código.
- Una cuenta bancaria personal a nombre del titular podría servir si Stripe la admite y verifica; no introducir IBAN ni DNI en GitHub ni asumir que el pago se puede abonar hasta verificación terminada.
- **Fiscalidad previa a la actividad**: verificar/realizar alta censal Modelo 036 y clasificación de actividad adecuada antes de empezar operaciones. La venta habitual puede requerir alta en RETA. La ausencia de sociedad mercantil no elimina obligación de declarar ingresos, IVA/IRPF según corresponda, ni los requisitos de venta digital UE (umbral/OSS). Confirmar detalles con AEAT/asesoría.
- **Si se perciben prestaciones de desempleo**, confirmar individualmente la compatibilidad con SEPE antes del inicio de la actividad. En la prestación contributiva pueden existir opciones de compatibilidad, sometidas a requisitos y solicitud en plazo. No iniciar cobros esperando regularizarlo más tarde.
- **Transparencia web (LSSI)**: antes de vender, completar aviso legal con identidad legal real, dirección/domicilio de contacto, NIF y datos exigibles, y finalizar licencia, desistimiento/reembolsos, facturación, privacidad, compatibilidad y soporte. No publicar datos personales privados sin decisión consciente y procedimiento seguro.
- **No activar READY_FOR_SALE ni pegar un Payment Link live** hasta la verificación regulatoria y disponibilidad real del producto. Mantener juego gratis, consultas y demostraciones mientras tanto.

Fuentes oficiales (consulta 23-10-2026): [Stripe para empresa individual](https://support.stripe.com/questions/selling-on-stripe-without-a-separate-business-entity?locale=es-ES); [AEAT alta censal 036](https://sede.agenciatributaria.gob.es/Sede/ayuda/manuales-videos-folletos/manuales-practicos/guia-practica-cumplimentacion-modelo-censal-036/capitulo-01-cuestiones-generales/plazos-presentacion/declaracion-alta/alta-censo-empresarios-profesionales-retenedores-036.html); [Seguridad Social RETA](https://www.seg-social.es/wps/portal/wss/internet/Trabajadores/Afiliacion/10548/32825/625?changeLanguage=es); [SEPE actividad propia](https://www.sepe.es/HomeSepe/prestaciones-desempleo/cobrando-prestacion-subsidio-desempleo/trabajo-como-autonomo.html); [BOE LSSI art.10](https://www.boe.es/eli/es/l/2002/07/11/34/).

 La web es estática (GitHub Pages); ninguna clave privada debe subirse al repositorio.

## Cómo se habilita, SOLO para productos terminados
1. Comprobar que el producto está acabado, tiene instalador/entrega verificable, compatibilidad publicada, precio final, términos y política de reembolsos revisados. Si no, mantener consulta sin pago.
2. Verificar la identidad de la persona física y la cuenta de abonos (IBAN) en Stripe, y configurar recibos, impuestos aplicables, información comercial y políticas de devolución. Consultar con un profesional la situación fiscal y posibles prestaciones antes del alta de actividad.
3. Crear en Stripe un **Payment Link en modo LIVE** para el producto exacto y confirmar que el total final coincide con el precio visible en el catálogo; para UNFIRE Club, crear una suscripción con condiciones transparentes y cancelación accesible. Confirmar el nombre, importe e impuestos; NO reutilizar el enlace entre FX distintos.
4. Activar tarjetas, Apple Pay, Google Pay y Link u otros métodos compatibles desde Stripe. El proveedor presenta las opciones adecuadas al navegador/región; no dibujar botones falsos ni requerir datos bancarios en unfire.technology. La biometría la gestiona la wallet del usuario.
5. En `audio/index.html`, pegar el enlace HTTPS `https://buy.stripe.com/...` en el valor del producto en `PAY` y añadir la misma clave en `READY_FOR_SALE` **solo tras superar las verificaciones anteriores**.
6. Hacer pruebas reales controladas de recibo, entrega, devoluciones, errores de pago y dispositivos; validar la cuenta y su estado antes de promocionar ventas. Los enlaces `/test_...` se rechazan deliberadamente en producción.

El carrito solo puede pagar directamente **un producto específico**: con varias referencias distintas se mantiene consulta por correo, nunca se cobra una suma equivocada. Stripe alojará Checkout y gestionará SCA/3-D Secure; no guardar tarjetas ni claves en el sitio estático. La confirmación del navegador NO prueba por sí sola el pago: usar el Dashboard/webhooks de Stripe para verificar pagos y activar entregas, especialmente pagos diferidos.

**Importante**: venta digital dentro de apps distribuidas en App Store debe cumplir Apple Review 3.1 y las condiciones/entitlements aplicables a la región. Esta preparación es para el sitio web independiente y no añade compras externas a las apps de iOS.
