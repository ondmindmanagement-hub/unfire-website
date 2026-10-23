# UNFIRE WORLD — arquitectura y MVP (propuesta, no producto publicado)

**Fecha:** 2026-10-23  
**Fuente de coordinación:** [issue #43](https://github.com/ondmindmanagement-hub/unfire-website/issues/43); prioridad operativa [Unfire Audio #13](https://github.com/ondmindmanagement-hub/unfire-website/issues/13).  
**Estado:** diseño. No activar, anunciar como funcional ni monetizar antes de cumplir los criterios de salida.

## 1. Tesis de producto

Una web puede ser un **espacio digital explorable**, sin convertirse en una carga para el usuario: entrada cinematográfica, escaparates 3D, demostraciones procedurales genuinas, navegación intuitiva, información indexable y una alternativa accesible en 2D.

- **Experiencia B2C:** plaza virtual modular con tiendas reales autorizadas, búsqueda clara, fichas de producto y enlace externo a canales de venta verificados.
- **Oferta B2B:** demostraciones procedurales de productos, showrooms, micrositios 3D y tecnología de interacción reutilizable para empresas.
- **Primer caso real:** una única tienda Unfire con un producto propio cuya demo, licencia y estado se puedan comprobar. No publicar tiendas, productos o logos de terceros sin autorización.
- **Activo verificable actual:** [Unfire Audio](https://unfire.technology/audio/) muestra capacidades de entrada WebGL y efectos procedurales, pero no constituye una plataforma de comercio ni acredita despliegues empresariales.

## 2. Orden inalterable y aislamiento

1. **P0: Unfire Audio.** Antes de publicar WORLD, proteger portada inmediata y misma pestaña, volumen 27 %, PASEAR, retorno a maletín, misiones, online, CI, rendimiento y cumplimiento. No modificar el motor del juego desde WORLD.
2. **P1: arquitectura y diseño aislados.** Este documento y el dossier comercial. Auditoría de componentes reales reutilizables sin mover su código ni borrar branches/worktrees.
3. **P2: piloto independiente.** Un solo módulo 3D de tienda con **una** transformación procedural comprobable; no integrar al sitio público sin QA y aprobación del integrador.
4. **P3: prueba de usuario y dispositivos.** Sólo expandir a un máximo de tres zonas si piloto estable, navegación entendible y los costes operativos tienen sentido.
5. **P4: tiendas externas.** Únicamente tras permisos de uso de marcas/productos, condiciones de contratación y facturación, responsabilidades de soporte, privacidad y acuerdos comerciales por escrito.

**Reserva técnica:** esta rama sólo agrega `docs/unfire-world/`. No se tocan `audio/`, `index.html` raíz, pipelines de pagos ni ramas de otros capitanes.

## 3. Diseño del recorrido

| Estado | Experiencia | Alternativa robusta |
| --- | --- | --- |
| Inicio | Fotograma real y ligero, nombre claro, «Explorar», «Ver tiendas» | Catálogo HTML visible sin esperar WebGL |
| Plaza | Máximo 3 accesos en piloto, cámara limitada, señales visuales | Lista de tiendas con enlaces funcionales |
| Tienda Unfire | Escena pequeña, producto real, control de transformación, información de estado | Página con capturas reales y descripción |
| Ficha | Qué es, para qué sirve, compatibilidad verificada, estado del producto | HTML accesible, compartible e indexable |
| Salida / retorno | Atrás siempre consistente; conservar estado sin bloquear navegación | Enlaces normales y navegación del navegador |

Un carrusel obligatorio o un mundo vacío no son alternativa a una tienda: el usuario debe encontrar el producto directamente desde el encabezado y en no más de dos acciones. Ninguna entrada requiere registro, movimiento de cámara ni sonido.

## 4. Arquitectura modular propuesta

```
/world/                        # Ruta futura; no publicada en esta fase
  index.html                   # HTML primero, accesible e indexable
  app/
    shell/                     # router, estado de navegación, errores
    scene/                     # adaptador WebGL, cámara, iluminación
    procedural/                # efecto de revelado, parámetros medibles
    stores/unfire-audio/       # primera tienda experimental aislada
    data/catalogue.v1.json     # sólo productos verificados
    fallback/                  # imágenes auténticas, fichas 2D
    telemetry/                 # métricas agregadas opt-in si aplica
  assets/                      # mallas y texturas con licencia y presupuesto
```

No migrar el motor de Audio automáticamente. Empezar por adaptadores pequeños y **referencias a código autorizado**, nunca una copia gigantesca de `game-engine-v50.js` sin inventario de licencias, dependencias, rendimiento y regresiones.

**Contrato del catálogo v1** (esquema sugerido; no refleja stock real):

```json
{
  "schema": 1,
  "stores": [
    {
      "id": "unfire-audio",
      "displayName": "Unfire Audio",
      "status": "demo",
      "owner": "Unfire",
      "authorizedAssets": true,
      "experiencePath": "/world/stores/unfire-audio/",
      "fallbackPath": "/audio/",
      "externalCheckoutEnabled": false
    }
  ]
}
```

`status`: `demo | beta | available | unavailable`. Precios y descarga se mostrarán **sólo** si son actuales, tienen términos claros y se comprueban legalmente. Nunca inventar valoraciones, disponibilidad, colaboradores o entregas.

### Núcleo procedural

- Controles `progress` 0–1, `style` y `quality` con animación determinista y opción «reducir movimiento».
- Para el primer piloto: transición reproducible de una malla a su representación/variante autorizada mediante deformación de vértices, interpolación de atributos y material sombreado; **no simular con vídeo** una transformación que se anuncie como generada en tiempo real.
- El motor expone `mount(canvas, config)`, `setProgress(x)`, `pause()`, `resize(w,h,dpr)`, `dispose()`. Liberar geometrías/texturas al cambiar de tienda.
- El contexto WebGL puede perderse: capturar `webglcontextlost`, detener render y ofrecer ficha HTML; intentar recuperar sólo en un reintento explícito y acotado.
- Preparar separación por `scene` y por `store` para poder suspender tiendas no visibles; sin un render loop por cada módulo oculto.
- Evitar plugins externos innecesarios, credenciales en cliente, escritura en red sin permiso y acceso no autorizado a sesiones del navegador.

### Rendimiento — presupuestos **objetivo**, aún no medidos

| Magnitud | Objetivo MVP de laboratorio |
| --- | --- |
| Primer contenido significativo | ≤ 1,5 s en escritorio en red rápida; registrar por separado 4G lento |
| Primera imagen o ficha visible | Inmediata en HTML, sin bloqueo por motor WebGL |
| Carga inicial de assets | ≤ 750 KB comprimidos para shell + póster; tienda se difiere |
| Interactividad de tienda | Objetivo ≤ 4 s en móvil medio con 4G; no prometer hasta medir |
| FPS bajo escena interactiva | Medir p50/p95: objetivo 60 escritorio y 30 móvil medio |
| Memoria / GPU | Presupuesto por dispositivo, límites de texturas, `devicePixelRatio` acotado y LOD |
| Salida de WebGL | Ficha usable sin canvas, scroll horizontal cero |
| Dispositivos mínimos | Safari iPhone físico, Chrome Android físico, Safari/Chrome escritorio, teclado |

No usar métricas de Chrome con emulación como prueba de hardware real. Probar frío/caliente, orientación con cambio durante interacción, red lenta/offline y errores GPU. Registrar versión y dispositivo para reproducir fallos.

## 5. Accesibilidad, derechos y privacidad

- Contenido principal en HTML semántico con foco visible, teclado, subtítulos para cualquier vídeo, controles táctiles suficientemente grandes, pausa de movimiento y sin audio automático.
- Mantener compatibilidad con `prefers-reduced-motion`, contraste, contenido adaptativo y zoom; no hacer depender una compra de resolver un minijuego.
- Todo activo de terceros requiere fuente, titular y licencia de uso comercial rastreable; evitar logos o tiendas ficticias que parezcan socios oficiales.
- Sin checkout web directo hasta verificar identidad fiscal/contractual, licencias de software, soporte, política de devoluciones, entrega, pasarela y seguridad. Usar enlaces externos a canales de distribución existentes únicamente si están verdaderamente disponibles.
- No recopilar datos personales sin necesidad; si se agregan analíticas, revisar consentimiento, minimización, conservación y obligaciones aplicables antes.

## 6. Criterios de aceptación de cada fase

**Para abrir PR del piloto:** una transformación **real** con controles funcionales, screenshot auténtica, 2D funcional, `dispose` de recursos, tests de navegación y sin conflictos con `audio/`.

**Para publicar piloto:** CI verde sobre SHA combinado, pruebas en móvil físico y escritorio, nada que rompa /audio/, medición de rendimiento reproducible, licencias auditadas y revisión de responsable de despliegue.

**Para incorporar primera marca ajena:** autorización y contrato firmados válidos, alcance aprobado, coste/protección de datos, assets licenciados, proceso de actualización del catálogo, facturación y plan de mantenimiento.

## 7. Backlog inmediato (sin saturación)

- [x] Documento de arquitectura y criterios verificables, aislado.
- [ ] Inventariar componentes **realmente reutilizables** de Unfire Audio sin tocar código en uso.
- [ ] Dibujar wireflow textual y prototipo 2D de una sola tienda (aún fuera de producción).
- [ ] Diseñar una transformación procedural pequeña con prueba automatizada, fuera del motor principal.
- [ ] Medir pilotos en dispositivos físicos y revisar con el integrador.
- [ ] Preparar caso de estudio comercial con vídeo/capturas **reales** y datos de rendimiento medidos.
- [ ] Solicitar consentimiento contractual de una tienda externa sólo tras validar el piloto.

**No es un anuncio de lanzamiento.** La ventaja sostenible será la calidad demostrable, la estabilidad y la capacidad de desplegar módulos de forma repetible, no afirmar superioridad absoluta sin pruebas.
