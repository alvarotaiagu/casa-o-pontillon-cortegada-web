# El 3D del Miño · Casa O Pontillón

Una sola sección: `#rio`, en «Alrededor». La primera vez que se ve, el vuelo del tablero por la S del Miño hasta la casa (22 s); después, el explorador con rótulos, la hora y la luz de hoy, el agua que refleja el cielo, «Bajar a la casa» y En 3D / En plano. Relieve MDT05 y ortofoto PNOA del IGN (CC BY 4.0), altura ×1,6. Parte del 3D del tablero (`../casa-o-pontillon-cortegada-bocetos/partes/tres.html`, dirección B) y de la arquitectura de Fontes (`../caserio-de-fontes-nogueira-web/js/3d/`).

## Ficheros

| Fichero | Qué hace |
|---|---|
| `arranque.js` | Lo único que carga la web. Espera a `load` + tiempo libre; chip; mira el ahorro de datos y WebGL2; al acercarse `#rio` (1200 px) monta los mandos de hora y, con 3D, pide los módulos y los datos y monta la escena. Si falla: `sin-3d`. Lleva `VERSION`. |
| `sol.js` | Sol y luna (SunCalc), hora de Madrid, salida y puesta, textos del chip y de la lectura. `?ahora3d=2026-10-19T18:30` fija «ahora». |
| `mandos.js` | Chip, barra de hora, momentos y lectura (`aria-live`, al parar la barra). Sin Three.js: sirven también sin 3D. |
| `escena.js` | Un renderer: relieve, cantos, la casa de cerca (foto a 0,3 m/px), agua con reflejo propio (cámara espejo + plano de recorte), cúpula de cielo con sol y luna, estrellas, sombras, luz por altura del sol, calidad automática, proyección con la cuenta de `object-fit: cover`. |
| `rio.js` | Vuelo (curva del valle → Prexigueiro → río abajo → la casa) y explorador (OrbitControls en `#rio-lienzo`), rótulos, «Volar por el río» / «Saltar el vuelo», «Bajar a la casa», En 3D / En plano, «Mover el mapa», teclado. |
| `vendor/` | Three.js r160, `OrbitControls.js` y `Water.js` (de `cdn.jsdelivr.net/npm/three@0.160.0/`, con el import reescrito a `./three.module.min.js`). |
| `../../css/3d.css` | Lo de dentro de `#rio-marco`: póster, canvas y fundido, plano, rótulos, chip, carga y «Mover el mapa». |
| `../../scripts/terreno.py` | Fuentes del tablero → `img/terreno/`. |
| `../../pruebas/3d-*` | Banco, pruebas con capturas y póster. |

## Contrato con la web

- Marcado: el de `pruebas/3d-banco.html` (ids `rio`, `rio-marco`, `rio-poster`, `rio-lienzo`, `rio-rotulos`, `rio-mover`, `rio-carga`, `rio-chip`, `rio-hora`, `rio-hora-txt`, `[data-h]`, `rio-lectura`, `rio-volar`, `rio-casa`, `rio-3d`, `rio-plano`).
- Clases que pone el 3D: en `#rio`, `con-3d` (primer fotograma), `sin-3d` (sin WebGL2, ahorro de datos o error) y `volando` (durante el vuelo); en `#rio-marco`, `plano` y `mapa-suelto` (táctil, mapa suelto). Evento `pontillon:3d-listo` en `document`.
- Lo que toca: textos de `#rio-volar` («Volar por el río» / «Saltar el vuelo»; oculto con movimiento reducido) y `#rio-mover` («Mover el mapa» / «Soltar el mapa»; visible solo en táctil); `aria-pressed` de `#rio-casa`, `#rio-3d` y `#rio-plano`; crea `<picture class="rio-plano"><img id="rio-plano-img">` al pulsar «En plano»; `tabindex`, `role="application"` y `aria-label` en `#rio-lienzo`; con `sin-3d` oculta el grupo «Vista».
- Espera la cortina (`cortina-fuera` o `pontillon:cortina-fuera`, 6 s de red) antes de crear el motor.
- `window.PONT_3D` = `{ estado, motor, rio, mandos }` para las pruebas.

## Cómo se regenera

```
python -I scripts/terreno.py    # alturas-256/384, orto-1792/2880, finca-1024/1536, plano, terreno.json
node pruebas/3d-poster.mjs      # poster-rio-1600 (16:10) y poster-rio-movil-900 (4:5), luz de las 18:30
node pruebas/3d-probar.mjs      # una pasada: escritorio, móvil, movimiento reducido y sin WebGL, con capturas 3d-cap-*.png
```
Después, **subir `VERSION` en `arranque.js`** (todo lo que pide el 3D lleva `?v=VERSION`; `versionar.mjs` ve el cambio de huella de `arranque.js`).

El póster es la vista del valle con movimiento reducido (sin ondas): coincide con el primer fotograma del vuelo, así que el canvas entra fundido sin salto. Es 16:10 en apaisado y 4:5 en vertical (en vertical el campo de visión horizontal es fijo, 34°).

## Rendimiento

- Nada pesado antes de `load`; los datos, al acercarse `#rio`, con `priority: 'low'`, WebP con JPG de respaldo y `createImageBitmap`.
- Móvil (`pointer: coarse` o pantalla < 700 px): malla 256, ortofoto 1792 (544 KB), casa 1024 (206 KB), reflejo 384, sombras 1024, densidad ≤ 1,5, sin antialias. Escritorio: 384, 2880 (1,4 MB), 1536 (460 KB), reflejo 640, sombras 2048, densidad ≤ 1,75. JS: Three 166 KB gzip + lo demás 32 KB.
- Pinta solo si se ve y hay algo que mover (vuelo, viaje, giro); fuera de pantalla o con la pestaña oculta, nada. La sombra se rehace al cambiar el minuto.
- Calidad automática (media de 45 fotogramas > 30 ms): densidad −0,25 hasta 1 → sin sombras → reflejo 256 → densidad 0,75.
- La barra del móvil no rehace el búfer (cambio de alto < 160 px).

## No probado

Fluidez en un móvil real y Safari/iOS (todo con SwiftShader, donde baja a «sin sombras, reflejo 256»). La luna tiene fase y posición reales, pero su luz es aproximada.
