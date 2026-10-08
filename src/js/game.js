// game.js
// Estado y reglas. Depende de globals de maze.js: MAZE, TUNNEL_ROW,
// PACMAN_START, GHOST_STARTS.

const DIRS = {
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
};
const OPPOSITE = { left: 'right', right: 'left', up: 'down', down: 'up' };

const PACMAN_SPEED = 0.125; // 1/8 celda/frame -> alinea cada 8 frames
const GHOST_SPEED = 0.1;    // 1/10 celda/frame

// Frames de partida que cada fantasma espera en el pen antes de salir.
const GHOST_EXIT_FRAMES = { pinky: 120, inky: 240, clyde: 360 }; // ~2s/4s/6s a 60fps

// Crea una partida nueva. Copia MAZE (pristino) a game.grid para poder comer
// dots sin destruir el original, y reiniciar.
function createGame() {
  const grid = MAZE.map( ( row ) => row.slice() );
  // La celda de inicio de Pacman arranca sin dot.
  grid[ PACMAN_START.y ][ PACMAN_START.x ] = 0;

  let dots = 0;
  for ( const row of grid ) for ( const v of row ) if ( v === 2 ) dots++;

  return {
    state: 'start',
    score: 0,
    lives: 3,
    dotsRemaining: dots,
    tick: 0, // frames de partida transcurridos (salidas escalonadas del pen)
    grid,
    pacman: {
      x: PACMAN_START.x,
      y: PACMAN_START.y,
      dir: 'left',
      nextDir: null,
      speed: PACMAN_SPEED,
    },
    ghosts: GHOST_STARTS.map( ( g ) => ( {
      x: g.x,
      y: g.y,
      dir: 'up',
      speed: GHOST_SPEED,
      kind: g.kind,
      mode: g.kind === 'blinky' ? 'chase' : 'pen',
      exitAt: GHOST_EXIT_FRAMES[ g.kind ] || 0,
    } ) ),
  };
}

function aligned( v ) {
  return Math.abs( v - Math.round( v ) ) < 1e-3;
}

// Una celda es muro para el actor dado?
//   pacman y ghost (chase): bloqueados por pared (1) y puerta (3).
//   Solo la salida determinista (leavePen) cruza la puerta, porque no
//   consulta canMove.
function isWall( grid, x, y ) {
  if ( y < 0 || y >= grid.length ) return true;
  if ( x < 0 || x >= grid[ 0 ].length ) return true;
  const v = grid[ y ][ x ];
  if ( v === 1 ) return true;
  if ( v === 3 ) return true;
  return false;
}

// Puede el actor avanzar desde (x,y) en la direccion dir?
// actor se mantiene en la firma por compatibilidad; ya no cambia la regla.
function canMove( grid, x, y, dir, actor ) {
  const d = DIRS[ dir ];
  if ( !d ) return false;
  const tx = x + d.x;
  const ty = y + d.y;
  // Tunel: salir por un borde en la fila del tunel siempre es valido.
  if ( ty === TUNNEL_ROW && ( tx < 0 || tx >= grid[ 0 ].length ) ) return true;
  return !isWall( grid, tx, ty );
}

function wrapTunnel( a, width ) {
  if ( Math.round( a.y ) === TUNNEL_ROW ) {
    if ( a.x < 0 ) a.x += width;
    else if ( a.x >= width ) a.x -= width;
  }
}

function movePacman( game ) {
  const p = game.pacman;
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( p.x ) && aligned( p.y ) ) {
    p.x = Math.round( p.x );
    p.y = Math.round( p.y );

    // Aplicar giro pendiente si es posible.
    if ( p.nextDir && canMove( grid, p.x, p.y, p.nextDir, 'pacman' ) ) {
      p.dir = p.nextDir;
      p.nextDir = null;
    }
    // Comer dot.
    if ( grid[ p.y ][ p.x ] === 2 ) {
      grid[ p.y ][ p.x ] = 0;
      game.score += 10;
      game.dotsRemaining--;
    }
    // Si no puede seguir, se detiene en la celda.
    if ( !canMove( grid, p.x, p.y, p.dir, 'pacman' ) ) return;
  }

  const d = DIRS[ p.dir ];
  p.x += d.x * p.speed;
  p.y += d.y * p.speed;
  wrapTunnel( p, width );
}

// Objetivo de persecucion segun la personalidad del fantasma.
// Coordenadas en celdas; pueden caer fuera del tablero: solo guian el greedy.
function ghostTarget( game, g ) {
  const p = game.pacman;
  const px = Math.round( p.x );
  const py = Math.round( p.y );
  const d = DIRS[ p.dir ] || { x: 0, y: 0 };

  if ( g.kind === 'pinky' ) {
    // Embosca: 4 celdas por delante de la direccion actual de Pac-Man.
    return { x: px + 4 * d.x, y: py + 4 * d.y };
  }

  if ( g.kind === 'inky' ) {
    // Flanquea: dobla el vector desde Blinky hasta el punto 2 celdas por
    // delante de Pac-Man. Sin blinky en la partida (defensivo), imita a Pac-Man.
    const b = game.ghosts.find( ( o ) => o.kind === 'blinky' );
    if ( !b ) return { x: px, y: py };
    const ax = px + 2 * d.x;
    const ay = py + 2 * d.y;
    return { x: 2 * ax - Math.round( b.x ), y: 2 * ay - Math.round( b.y ) };
  }

  if ( g.kind === 'clyde' ) {
    // Timido: persigue de lejos (mas de 8 celdas) y se retira a su esquina
    // (0,30) cuando tiene a Pac-Man cerca.
    const dist = Math.abs( g.x - px ) + Math.abs( g.y - py );
    return dist > 8 ? { x: px, y: py } : { x: 0, y: 30 };
  }

  // blinky (agresivo) y fallback defensivo: la celda de Pac-Man.
  return { x: px, y: py };
}

function decideGhost( game, g ) {
  const grid = game.grid;

  const options = Object.keys( DIRS ).filter(
    ( dir ) => dir !== OPPOSITE[ g.dir ] && canMove( grid, g.x, g.y, dir, 'ghost' )
  );
  // Sin salida (callejon): permitir el giro de 180.
  const choices = options.length ? options : [ '' + OPPOSITE[ g.dir ] ];

  // Greedy: la direccion que mas acerca al objetivo (sin reversa salvo callejon).
  const t = ghostTarget( game, g );
  let best = choices[ 0 ];
  let bestDist = Infinity;
  for ( const dir of choices ) {
    const d = DIRS[ dir ];
    const nx = g.x + d.x;
    const ny = g.y + d.y;
    const dist = Math.abs( nx - t.x ) + Math.abs( ny - t.y );
    if ( dist < bestDist ) {
      bestDist = dist;
      best = dir;
    }
  }
  g.dir = best;
}

// Salida determinista del pen: centrarse en la columna de la puerta (13) y
// subir hasta (13,11). Ahi el fantasma pasa a chase mirando a la izquierda.
function leavePen( game, g ) {
  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );

    if ( g.x === 13 && g.y === 11 ) {
      g.mode = 'chase';
      g.dir = 'left';
      return;
    }
    g.dir = g.x !== 13 ? ( g.x < 13 ? 'right' : 'left' ) : 'up';
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

// Caja del pen: puerta (fila 12, col 13) + interior (cols 11-16, filas 13-15).
function insidePen( g ) {
  return g.y >= 12 && g.y <= 15 && g.x >= 11 && g.x <= 16;
}

function moveGhost( game, g ) {
  if ( g.mode === 'pen' ) {
    // Espera su turno de salida, quieto en su celda.
    if ( game.tick >= g.exitAt ) g.mode = 'leaving';
    return;
  }
  if ( g.mode === 'leaving' ) {
    leavePen( game, g );
    return;
  }

  // Rescate defensivo: con la puerta bloqueada un fantasma en chase no
  // deberia poder estar dentro de la jaula, pero si acabara ahi, vuelve
  // al camino de salida determinista (leavePen no consulta canMove).
  if ( insidePen( g ) ) {
    g.mode = 'leaving';
    return;
  }

  const grid = game.grid;
  const width = grid[ 0 ].length;

  if ( aligned( g.x ) && aligned( g.y ) ) {
    g.x = Math.round( g.x );
    g.y = Math.round( g.y );
    decideGhost( game, g );
    if ( !canMove( grid, g.x, g.y, g.dir, 'ghost' ) ) return;
  }

  const d = DIRS[ g.dir ];
  g.x += d.x * g.speed;
  g.y += d.y * g.speed;
  wrapTunnel( g, width );
}

function resetPositions( game ) {
  const p = game.pacman;
  p.x = PACMAN_START.x;
  p.y = PACMAN_START.y;
  p.dir = 'left';
  p.nextDir = null;
  game.ghosts.forEach( ( g, i ) => {
    const s = GHOST_STARTS[ i ];
    g.x = s.x;
    g.y = s.y;
    g.dir = 'up';
    // Restaurar modo y re-armar la salida escalonada desde el tick actual.
    g.mode = g.kind === 'blinky' ? 'chase' : 'pen';
    g.exitAt = game.tick + ( GHOST_EXIT_FRAMES[ g.kind ] || 0 );
  } );
}

function collides( a, b ) {
  return Math.abs( a.x - b.x ) < 0.5 && Math.abs( a.y - b.y ) < 0.5;
}

function update( game ) {
  game.tick++;
  movePacman( game );
  game.ghosts.forEach( ( g ) => moveGhost( game, g ) );

  for ( const g of game.ghosts ) {
    if ( collides( game.pacman, g ) ) {
      game.lives--;
      if ( game.lives <= 0 ) {
        game.state = 'lost';
        return;
      }
      resetPositions( game );
      break;
    }
  }

  if ( game.dotsRemaining <= 0 ) game.state = 'won';
}

window.createGame = createGame;
window.update = update;
window.DIRS = DIRS;
