# SPEC 01 — Cuatro fantasmas con personalidades clásicas

> **Estado:** Aprobado
> **Depende de:** ninguna (primera spec del repo)
> **Fecha:** 2026-10-08
> **Objetivo:** Sustituir los 2 fantasmas actuales (hunter/random) por 4 fantasmas con las personalidades clásicas del arcade, uno de ellos (Blinky) persecutor agresivo de Pac-Man.

## Por qué existe esta spec

Hoy `decideGhost` solo distingue `hunter` (greedy por Manhattan) y un fallback aleatorio, con 2 fantasmas. El juego pierde la identidad del original: 4 enemigos con conductas complementarias que fuerzan distintas reacciones del jugador. Esta spec es la primera del repo y no depende de otras.

## Scope

**In:**

- 4 fantasmas con `kind`: `blinky`, `pinky`, `inky`, `clyde`.
- Comportamiento por personalidad en modo persecución (chase) usando la misma mecánica greedy actual.
- Salida escalonada del pen: Blinky fuera desde el inicio, Pinky/Inky/Clyde con retraso.
- Colores fijados por `kind` en el render.
- Restauración de modos y timers al perder una vida.

**Out of scope (para futuras specs):**

- Power pellets y modo frightened (no existen aún en el juego).
- Modo scatter (alternancia persecución/dispersión).
- Velocidades distintas por fantasma.
- Niveles, dificultad progresiva, sonido.

## Modelo de datos

```js
// maze.js — reemplaza GHOST_STARTS actual
const GHOST_STARTS = [
  { x: 13, y: 11, kind: 'blinky' }, // fuera del pen, sobre la puerta
  { x: 13, y: 14, kind: 'pinky'  }, // centro del pen (interior cols 11-16, filas 13-15)
  { x: 11, y: 14, kind: 'inky'   }, // oeste del pen
  { x: 16, y: 14, kind: 'clyde'  }, // este del pen
];
```

```js
// game.js — cada fantasma gana dos campos
{
  x, y, dir, speed, kind,
  mode: 'pen' | 'leaving' | 'chase', // nuevo
  exitAt: Number,                    // nuevo: game.tick en que pasa a 'leaving'
}
// game.js — nuevo contador global de frames de partida, incrementado en update()
game.tick
// Constantes nuevas
const GHOST_EXIT_FRAMES = { pinky: 120, inky: 240, clyde: 360 }; // ~2s/4s/6s a 60fps
```

Convenciones: coordenadas en celdas (x, y), origen arriba-izquierda; velocidades en celdas/frame; `GHOST_SPEED = 0.1` no cambia.

## Plan de implementación

1. `maze.js`: extender `GHOST_STARTS` a 4 entradas con los `kind` y posiciones de la tabla de arriba. Pinky/Inky/Clyde usan de momento el fallback aleatorio existente. Prueba manual: se ven 4 fantasmas.
2. `render.js`: sustituir `GHOST_COLORS` (array por índice) por un mapa por `kind` (`blinky` rojo, `pinky` rosa, `inky` cian, `clyde` naranja). Prueba: colores correctos y estables aunque cambie el orden.
3. `game.js`: añadir `game.tick`, `mode` y `exitAt` a los fantasmas; lógica de estados `pen` (quieto), `leaving` (ir a la columna 13 y subir por la puerta hasta (13,11), ahí `mode='chase'` y `dir='left'`), `chase` (decisión actual). Prueba: salida escalonada visible, Blinky activo desde el primer frame.
4. `game.js`: sustituir la rama `hunter`/`random` de `decideGhost` por objetivo por `kind` en `chase`:
   - `blinky`: celda redondeada de Pac-Man (agresivo, se conserva la mecánica actual).
   - `pinky`: Pac-Man + 4 celdas en `pacman.dir`.
   - `inky`: `2 * (pacman + 2*dir) − blinky`, con Blinky localizado por `kind` (fallback: Pac-Man).
   - `clyde`: si distancia Manhattan a Pac-Man > 8 → Pac-Man; si no → esquina (0, 30).
   Prueba: jugando se distinguen las 4 conductas.
5. `game.js`: `resetPositions` restaura posiciones, `dir`, `mode` y re-arma `exitAt` desde el tick actual (Blinky reaparece fuera en (13,11), el resto en el pen). Prueba: perder una vida reinicia la salida escalonada.

## Criterios de aceptación

- [ ] Al iniciar hay 4 fantasmas: rojo, rosa, cian y naranja.
- [ ] Blinky persigue directamente la celda de Pac-Man de forma sostenida.
- [ ] Pinky apunta 4 celdas por delante de la dirección actual de Pac-Man.
- [ ] Inky flanquea: su rumbo cambia según la posición de Blinky, no solo de Pac-Man.
- [ ] Clyde se acerca cuando está a más de 8 celdas y se retira hacia su esquina cuando está cerca.
- [ ] Blinky está fuera del pen al empezar; Pinky, Inky y Clyde salen escalonados (~2s, ~4s, ~6s).
- [ ] Al perder una vida, todos vuelven a su posición inicial y la salida escalonada se repite.
- [ ] Ningún fantasma atraviesa paredes ni se queda atascado para siempre (velocidades intactas: `GHOST_SPEED = 0.1`).
- [ ] Se puede ganar y perder una partida sin errores en la consola del navegador.

## Decisiones

- **Sí:** personalidades clásicas arcade. Canónicas, y "uno agresivo" es exactamente Blinky.
- **Sí:** salida escalonada con Blinky fuera desde el inicio. Fiel al original y evita un pen abarrotado al primer frame.
- **Sí:** mecánica greedy con distancia Manhattan para los 4. Reutiliza el `hunter` actual; sin pathfinding (A*) que el MVP no necesita.
- **Sí:** re-armar los timers de salida al perder vida. Reproduce el reinicio del original.
- **No:** scatter alternado por temporizador. Amplía el alcance; spec futura.
- **No:** velocidades distintas por fantasma. Riesgo de romper la alineación de rejilla que el AGENTS.md prohíbe romper; la dificultad viene de las personalidades.
- **No:** bug histórico de Pinky (target desplazado 4 celdas a la izquierda al mirar arriba). Implementamos la versión corregida.
- **No:** power pellets / frightened. No existen en el juego todavía; su interacción con los fantasmas merece spec propia.

## Riesgos

| Riesgo | Mitigación |
| --- | --- |
| Romper la alineación de rejilla en los estados `pen`/`leaving` | Reusar `GHOST_SPEED` y la mecánica de pasos alineados de `moveGhost`; no introducir velocidades nuevas. |
| Colisión al terminar la salida en (13,11), celda alcanzable por Pac-Man | El chequeo global de colisiones en `update()` se aplica a todos los `mode`; no se excluye a nadie. |
| Inky depende de Blinky | Localización por `kind` con fallback a perseguir a Pac-Man si no se encuentra. |
| Distancia Manhattan ignora el wrap del túnel | Aceptado para MVP: el greedy actual ya lo ignora y el comportamiento es estable. |

## Lo que **no** está en esta spec

- Power pellets y modo frightened (spec propia si aterriza).
- Modo scatter, velocidades por fantasma, niveles.
- Cada uno de esos puntos, si aterriza, va en su propia spec.
