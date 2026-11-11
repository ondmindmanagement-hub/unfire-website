# UNFIRE | grabación auténtica en MacBook Pro (NO PUBLICAR)

Este directorio solo contiene herramientas para grabar la escena Three.js **real** con Google Chrome en el Mac autorizado. No modifica ni copia código nuevo al motor en uso, ni sobrescribe carpetas de otras sesiones, ni toca pestañas de Safari. En particular no hay panorámicas renderizadas a partir de JPG.

## Requisitos previos

- MacBook autorizado conectado a Desktop Commander (todavía **OFFLINE** al preparar esto). El operador ejecutará la captura por acceso remoto cuando haya conexión real.
- Google Chrome instalado, Node.js, Python 3, ffmpeg y acceso de lectura a GitHub. Instalación local aislada de `playwright@1.56.1` en `~/Desktop/Unfire/FilmStudio/CinemaReview_20261024`. No hay compras ni presupuestos publicitarios.
- Espacio libre suficiente. Chrome se abre con perfil aislado y aceleración gráfica activa; no toca Safari.

## Ejecución en el Mac

Desde una copia del repositorio que tenga esta rama de trabajo:

```sh
zsh film/mac/20261024/run_mac_capture.command
```

No ejecutar en los runners Ubuntu sin GPU: aquella prueba falló por GPU de software y se rechazó correctamente.

## Qué grabar

1. `record_cine_mac.cjs` abre la cámara espectadora **nativa** (`window.__REC.set(true)`, equivalente a V), pasea 6 planos reales (interior de robots, noche e islas, costa, cielo/espacio y atardecer), sin generar ningún fotograma. Cada clip se guarda en MP4 y WebM, con diagnósticos de movimiento y fps efectivos en `QA_MANIFEST.json`.
2. `record_gameplay_mac.cjs` graba 30 segundos continuos de control del robot real en tercera persona y movimiento de vuelo del jugador, sin modo cine. Resultado `UNFIRE_GAMEPLAY_REAL_CONTINUO.mp4` y `GAMEPLAY_QA.json`.
3. **No editar, publicar ni etiquetar como aprobado** un clip con menos de ~22fps efectivos, si está congelado, o si un plano espacial no muestra realmente el escenario deseado. Revisar el contenido visual, no únicamente la duración/fps.
4. Las pistas UK Bass Waves, diálogos eSpeak NG y mezcla cinematográfica se añaden **solo después de una grabación visualmente válida**, con derechos de música/samples verificados. Las voces `say` de macOS no son publicables por defecto.
5. Entregar *dos vídeos separados para revisión*; nunca subir a YouTube ni a la web antes de la aprobación del usuario.

## Estado de entrega

- Código de captura: preparado, pendiente de ejecutar realmente en el Mac.
- Grabación real nocturna desde Mac: no verificada todavía.
- El gran plano con **todas** las islas principales a la vez requiere composición de cámara mediante el motor y validación visual; no debe afirmarse hasta confirmarlo.
- El motor del juego y la web pública **no se modifican** con estos scripts.
