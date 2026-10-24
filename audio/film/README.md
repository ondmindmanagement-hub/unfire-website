# Unfire Film — proyecto separado del juego publicado

**Producción**: «Unfire: El Gran Silencio», largometraje original de comedia de ciencia ficción y fantasía oscura.

Archivos: UNFIRE_EL_GRAN_SILENCIO_GUION.md (libreto), el-gran-silencio-scenes.json (24 secuencias), SHOTLIST_PRODUCCION.csv (96 tomas planificadas), director-capture.js (herramienta de filmación para navegador de producción).

**Estado real:** guion y planificación creados; la película NO está grabada, mezclada ni exportada, y no debe anunciarse en la web como estrenada.

## Herramienta Director

El archivo director-capture.js NO se carga en el juego público. Solo se inyecta explícitamente en una sesión local autorizada de rodaje. Utiliza los objetos 3D presentes para controlar una cámara libre sin colisiones y capturar vídeo real del WebGL en clips independientes (máximo 120 segundos) cuando el navegador admite captureStream y MediaRecorder.

No crea usuarios ocultos, red de control remoto, tareas autónomas, claves ni privilegios secretos. No contiene telemetría. Para incluir audio, producción debe proporcionar explícitamente un MediaStream autorizado, o sincronizar música y voces externamente. Nunca presume que el audio de la pestaña se graba sin permisos. El vídeo se descarga localmente tras cada toma.

El guion contempla a Umbral como único robot-nave anclado: entradas pie derecho y pecho; DJ Óxido y ventana circular. El viaje lunar de continuidad visual pertenece al módulo del juego, no a este subproyecto; el equipo del juego debe aprobar su integración de manera independiente.

## Criterios de calidad pendientes

- Grabar y revisar tomas reales del juego, con temperatura/FPS y memoria bajo control.
- No convertir el navegador en exportador de un archivo de 78 minutos: grabar tomas y editar fuera para evitar saturación.
- Completar voces interpretadas, foley, subtítulos, montaje, mezcla y loudness objetivo tras QA auditivo.
- Verificar derechos de sincronización de cada pista UK Bass Waves para la película.
- Verificar geometrías, encuadres y continuidad visual en Mac, móvil y tablet antes de anunciarla.
- Las duraciones del guion son tiempos de planificación, NO duración de un filme terminado.
