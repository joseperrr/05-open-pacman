# SPEC 02 — Los fantasmas no re-entran a la jaula

> **Estado:** Implementado
> **Depende de:** SPEC 01 (implementada en la rama `spec-01-cuatro-fantasmas`, pendiente de commit)
> **Fecha:** 2026-10-08
> **Objetivo:** Impedir que los fantasmas en persecución vuelvan a entrar a la jaula y añadir un rescate defensivo para el caso residual, de modo que una vez en el mapa permanezcan en él.

## Por qué existe esta spec

Jugando a la implementación de SPEC 01 se ve a veces a fantasmas "atrapados" dentro de la jaula. La espera inicial (2s/4s/6s) es intencional y se mantiene; el problema real es que la puerta del pen es transitable para fantasmas en `chase`, así que un fantasma ya en persecución puede re-entrar y quedar orbitando dentro. Esta spec cierra ese agujero.

## Scope

**In:**

- La puerta del pen (valor 3) pasa a bloquear a todos los actores: Pac-Man y fantasmas en `chase`.
- Rescate defensivo: un fantasma en `chase` que se encuentre dentro de la caja del pen pasa automáticamente a `leaving` y sale por la puerta.
- Sincronizar los comentarios de `game.js` y la línea correspondiente de `AGENTS.md`.
- Se implementa apilada sobre la rama `spec-01-cuatro-fantasmas` (SPEC 01 sin commitear).

**Out of scope (para futuras specs):**

- Acortar la espera inicial de salida (2s/4s/6s se mantienen, decisión cerrada en SPEC 01).
- Power pellets / modo frightened, scatter, niveles, sonido.

## Modelo de datos

```js
// game.js — isWall deja de distinguir por actor en la puerta
function isWall( grid, x, y ) {
  // ...
  if ( v === 3 ) return true; // la puerta bloquea a Pac-Man y a fantasmas en chase
  // ...
}
// canMove conserva su firma; 'pacman'/'ghost' siguen pasándose (sin cambio de API).

// game.js — predicado de rescate (caja del pen: puerta + interior)
function insidePen( g ) {
  return g.y >= 12 && g.y <= 15 && g.x >= 11 && g.x <= 16;
}
// Rescate en moveGhost, antes del bloque chase:
//   if ( g.mode === 'chase' && insidePen( g ) ) g.mode = 'leaving';
// No hay campos ni constantes nuevos.
```

Nota: la salida determinista (`leavePen`) no usa `canMove`, por lo que sigue cruzando la puerta aunque ahora sea muro para `chase`. Los fantasmas en `pen` no se mueven y no consultan `canMove`.

## Plan de implementación

1. `game.js`: en `isWall`, la puerta (3) devuelve `true` para cualquier actor; actualizar el comentario de la función. Prueba: simulación larga donde ningún fantasma en `chase` pisa la caja del pen.
2. `game.js`: añadir `insidePen( g )` y el rescate en `moveGhost` (fantasma en `chase` dentro de la caja → `mode = 'leaving'`, que sale por la puerta porque `leavePen` no consulta `canMove`). Prueba: forzar un fantasma en `chase` dentro del pen en una simulación y verificar que sale solo.
3. Documentación: actualizar en `AGENTS.md` la línea "La puerta del pen (3) bloquea a Pac-Man pero no a los fantasmas" por el nuevo comportamiento (bloquea a todos; solo `leaving` la cruza).
4. Verificación final: simulación de 1200 frames (nadie en pen en `chase`, nadie atascado, sin NaN) y prueba manual en navegador (los 4 fantasma en el mapa; Blinky nunca se mete a la jaula; salidas escalonadas intactas).

## Criterios de aceptación

- [ ] Ningún fantasma en `chase` cruza la puerta hacia el pen en ninguna simulación ni partida.
- [ ] Un fantasma en `chase` colocado a propósito dentro de la caja del pen sale solo por la puerta (rescate defensivo).
- [ ] La salida escalonada de SPEC 01 sigue funcionando: pinky/inky/clyde salen ~2s/4s/6s y suben por la puerta hasta (13,11).
- [ ] Los timers de espera se mantienen exactos: `GHOST_EXIT_FRAMES = { pinky: 120, inky: 240, clyde: 360 }`.
- [ ] Blinky, una vez fuera, no se le ve nunca dentro de la jaula.
- [ ] Simulación de 1200 frames: sin atascos permanentes (máx. parada decenas de frames, no infinita) y sin posiciones NaN.
- [ ] Se puede ganar y perder una partida sin errores en la consola del navegador.

## Decisiones

- **Sí:** bloquear la puerta para fantasmas en `chase`. Es la causa raíz: la jaula solo tiene una entrada física, así que cerrar la puerta basta (no hace falta marcar el interior como muro).
- **Sí:** rescate defensivo además del bloqueo (elección del usuario: "Ambas"). Con la puerta cerrada no debería dispararse nunca; queda como red de seguridad si un cambio futuro rompe el invariant.
- **Sí:** mantener la espera de 2s/4s/6s. El usuario confirmó que el síntoma era la re-entrada/apariencia de atasco, no la espera, cerrada en SPEC 01.
- **Sí:** actualizar `AGENTS.md` para que futuros agentes no "restauren" el comportamiento antiguo de la puerta.
- **No:** lógica anti-atrapamiento alternativa dentro de `decideGhost` (empujar hacia la puerta con greedy): más frágil que el cambio de modo a `leaving`, que ya sabe salir.
- **No:** marcar las celdas interiores del pen como muro para fantasmas: redundante y rompería el rescate defensivo.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Que `leavePen` dependiera de `canMove` y dejara de poder salir | Verificado: `leavePen` se mueve de forma determinista sin consultar `canMove`; la ruta (13,13)→(13,12)→(13,11) queda garantizada. |
| Falso positivo del predicado `insidePen` con fantasmas cruzando el túnel (fila 14) | El túnel en la fila 14 es transitable solo en cols 0-9 y 18-27; la caja de rescate es cols 11-16, filas 12-15, inalcanzable desde el túnel sin cruzar paredes. |
| Spec 01 sigue sin commitear al implementar 02 | Commitear la implementación de SPEC 01 en su rama antes de ejecutar `/spec-impl 02-salida-de-la-jaula`. |

## Lo que **no** está en esta spec

- Acortar la espera inicial del pen, scatter, frightened, niveles.
- Cada uno de esos puntos, si aterriza, va en su propia spec.
