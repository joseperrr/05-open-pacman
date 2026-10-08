# AGENTS.md

## Proyecto

Pac-Man en vanilla JS (canvas + HTML + CSS), sin frameworks ni dependencias. El propósito del repo es practicar **spec-driven development**: las features se definen en specs antes de escribir código (ver flujo abajo).

## Tooling

- No hay `package.json`, ni build, ni tests, ni lint. La única verificación es **jugar**: servir `src/` estático y probar en el navegador:
  ```
  python3 -m http.server 8000 --directory src
  ```
- No hay módulos ES: abrir `src/index.html` directamente con `file://` también funciona.

## Arquitectura

- JS sin módulos: los archivos comparten globals y el **orden de carga en `src/index.html` importa** (`maze.js` → `game.js` → `render.js` → `main.js`). Un archivo nuevo debe registrarse ahí en orden de dependencia; un error de global solo se ve en runtime (no hay build que lo detecte).
- `maze.js` define el laberinto como 31 strings de 28 caracteres (`#` pared, `.` dot, espacio vacío, `-` puerta del pen) que se parsean a números: `0` vacío, `1` pared, `2` dot, `3` puerta. Coordenadas en celdas `(x, y)`, origen arriba-izquierda; `TUNNEL_ROW = 14` hace wrap horizontal.
- La puerta del pen (3) bloquea a Pac-Man pero no a los fantasmas (`isWall` en `game.js`).
- Lógica por frames con `requestAnimationFrame` (sin timestamps): las velocidades son celdas/frame y dependen de la alineación con la rejilla (`PACMAN_SPEED = 0.125` alinea cada 8 frames). No cambiar velocidades a valores que rompan esa alineación.
- `createGame()` copia `MAZE` a `game.grid` para comer dots. Nunca mutar `MAZE`: debe quedar pristino para poder reiniciar.

## Flujo de trabajo: specs

Los skills `spec` y `spec-impl` viven en `.agents/skills/` (instalados vía `skills-lock.json`):

1. `/spec <descripción>` → diseña la feature preguntando primero y crea `specs/NN-slug.md` con estado `Draft`. Nunca escribe código.
2. El humano revisa y cambia el estado a `Approved` (o equivalente en español: `Aprobado`).
3. `/spec-impl <NN-slug>` → implementa paso a paso con pausas para revisar el diff, en la rama `spec-NN-slug`.

Reglas que el agente no debe romper:

- No implementar una feature sin spec en estado que signifique "Approved".
- **Nunca hacer commit automáticamente**, ni dentro de `/spec-impl`: el usuario decide cuándo commitear.

## Convenciones

- Todo en español: comentarios de código, texto de UI, README y specs.
- Los archivos `*:Zone.Identifier` son artefactos de descarga de Windows: ignorarlos.
