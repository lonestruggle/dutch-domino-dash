// Pure port van de plaatsingslogica uit `useDominoGame` (de "stable" versie).
// Wordt gebruikt door "Fix stenen" om de gelegde stenen opnieuw netjes uit te
// leggen volgens exact dezelfde regels als waarmee de stable game live stenen
// aanlegt (findLegalMoves + forbiddens + hasDifferentNeighbor). Zo blijft
// interactieve plaatsing = beta, maar auto-relayout = stable.

import type { DominoData, DominoState, GameState, OpenEnd } from '@/types/domino';

type Dir = 'N' | 'S' | 'E' | 'W';
type Orientation = 'horizontal' | 'vertical';

const isDouble = (d: DominoData) => d?.value1 === d?.value2;

// ---------- hasDifferentNeighbor (pure) ----------
const hasDifferentNeighbor = (board: GameState['board'], x: number, y: number): boolean => {
  const n = [
    [x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y],
    [x + 1, y - 1], [x - 1, y - 1], [x + 1, y + 1], [x - 1, y + 1],
  ];
  let count = 0;
  for (const [nx, ny] of n) {
    if (board[`${nx},${ny}`]) count += 1;
  }
  return count > 3;
};

// ---------- regenerateOpenEnds (pure port) ----------
const regenerateOpenEnds = (state: GameState): OpenEnd[] => {
  const openEnds: OpenEnd[] = [];

  for (const coord in state.board) {
    const [x, y] = coord.split(',').map(Number);
    const cell = state.board[coord];
    const domino = state.dominoes[cell.dominoId];
    if (!domino) continue;

    const neighbors: Record<Dir, [number, number]> = {
      N: [x, y - 1], S: [x, y + 1], W: [x - 1, y], E: [x + 1, y],
    };

    for (const dir of ['N', 'S', 'W', 'E'] as Dir[]) {
      const [nx, ny] = neighbors[dir];
      const neighborKey = `${nx},${ny}`;
      if (state.board[neighborKey]) continue;
      if (state.forbiddens[neighborKey]) continue;
      if (hasDifferentNeighbor(state.board, nx, ny)) continue;

      const fwd: Record<Dir, [number, number]> = {
        N: [nx, ny - 1], S: [nx, ny + 1], W: [nx - 1, ny], E: [nx + 1, ny],
      };
      const [fx, fy] = fwd[dir];
      if (state.board[`${fx},${fy}`]) continue;

      if (isDouble(domino.data)) {
        const isVertical = domino.orientation === 'vertical';
        if ((isVertical && (dir === 'N' || dir === 'S')) ||
            (!isVertical && (dir === 'W' || dir === 'E'))) continue;
      }

      let edgeValue = cell.value;
      const isHorizontal = domino.orientation === 'horizontal';
      const [v1, v2] = domino.flipped
        ? [domino.data.value2, domino.data.value1]
        : [domino.data.value1, domino.data.value2];

      if (isDouble(domino.data)) {
        edgeValue = domino.data.value1;
      } else if (isHorizontal) {
        const isLeft = coord === `${domino.x},${domino.y}`;
        const isRight = coord === `${domino.x + 1},${domino.y}`;
        if (!isLeft && !isRight) continue;
        const outward: Dir = isLeft ? 'W' : 'E';
        const [ox, oy] = neighbors[outward];
        if (state.board[`${ox},${oy}`]) continue;
        const allowed: Dir[] = [outward, 'N', 'S'];
        if (!allowed.includes(dir)) continue;
        edgeValue = isLeft ? v1 : v2;
      } else {
        const isTop = coord === `${domino.x},${domino.y}`;
        const isBot = coord === `${domino.x},${domino.y + 1}`;
        if (!isTop && !isBot) continue;
        const outward: Dir = isTop ? 'N' : 'S';
        const [ox, oy] = neighbors[outward];
        if (state.board[`${ox},${oy}`]) continue;
        const allowed: Dir[] = [outward, 'W', 'E'];
        if (!allowed.includes(dir)) continue;
        edgeValue = isTop ? v1 : v2;
      }

      openEnds.push({ x: nx, y: ny, value: edgeValue, fromDir: dir });
    }
  }
  return openEnds;
};

// ---------- findLegalMoves (pure port, strict pip-match) ----------
interface PureLegalMove {
  end: OpenEnd;
  dominoData: DominoData;
  flipped: boolean;
  orientation: Orientation;
  x: number;
  y: number;
  fromDominoId: string;
}

const findLegalMoves = (state: GameState, dominoData: DominoData): PureLegalMove[] => {
  const moves: PureLegalMove[] = [];
  const selectedIsDouble = isDouble(dominoData);
  const uniqueEnds: Record<string, boolean> = {};
  const openEnds = regenerateOpenEnds(state);

  openEnds.forEach((end) => {
    if (uniqueEnds[`${end.x},${end.y}`]) return;

    let validMove: PureLegalMove | null = null;

    const check = (value: number, flippedIn: boolean) => {
      if (end.value !== value) return;
      let flipped = flippedIn;

      const fromCellKey = ({
        N: `${end.x},${end.y + 1}`,
        S: `${end.x},${end.y - 1}`,
        W: `${end.x + 1},${end.y}`,
        E: `${end.x - 1},${end.y}`,
      } as const)[end.fromDir];

      const toCellKey = ({
        N: `${end.x},${end.y - 1}`,
        S: `${end.x},${end.y + 1}`,
        W: `${end.x - 1},${end.y}`,
        E: `${end.x + 1},${end.y}`,
      } as const)[end.fromDir];

      const toCellKeyForward = ({
        N: `${end.x},${end.y - 2}`,
        S: `${end.x},${end.y + 2}`,
        W: `${end.x - 2},${end.y}`,
        E: `${end.x + 2},${end.y}`,
      } as const)[end.fromDir];

      const fromCell = state.board[fromCellKey];
      if (!fromCell) return;
      const fromDomino = state.dominoes[fromCell.dominoId];
      if (!fromDomino) return;
      if (state.board[toCellKey]) return;
      if (state.board[toCellKeyForward]) return;
      if (state.forbiddens[toCellKey]) return;
      if (hasDifferentNeighbor(state.board, end.x, end.y)) return;

      const orientation: Orientation = end.fromDir === 'N' || end.fromDir === 'S' ? 'vertical' : 'horizontal';

      if (selectedIsDouble && fromDomino.orientation === 'horizontal' && (end.fromDir === 'N' || end.fromDir === 'S')) return;
      if (selectedIsDouble && fromDomino.orientation === 'vertical' && (end.fromDir === 'E' || end.fromDir === 'W')) return;

      let { x, y } = end;
      let finalOrientation: Orientation = orientation;
      if (selectedIsDouble) finalOrientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';

      if (finalOrientation === 'horizontal') {
        if (end.fromDir === 'W') { x -= 1; flipped = !flipped; }
      } else {
        if (end.fromDir === 'N') { y -= 1; flipped = !flipped; }
      }

      // Strikte pip-match verificatie
      const pip1 = flipped ? dominoData.value2 : dominoData.value1;
      const pip2 = flipped ? dominoData.value1 : dominoData.value2;
      const adjacencyOnSecondCell =
        (finalOrientation === 'horizontal' && end.fromDir === 'W') ||
        (finalOrientation === 'vertical' && end.fromDir === 'N');
      const connectingPip = adjacencyOnSecondCell ? pip2 : pip1;
      if (connectingPip !== end.value) return;

      // Anti-clutter: alleen contact aan verbindingskant
      const placementCells: Array<[number, number]> = finalOrientation === 'horizontal'
        ? [[x, y], [x + 1, y]]
        : [[x, y], [x, y + 1]];
      const placementCellSet = new Set(placementCells.map(([cx, cy]) => `${cx},${cy}`));
      const fromDominoCells: Array<[number, number]> = fromDomino.orientation === 'horizontal'
        ? [[fromDomino.x, fromDomino.y], [fromDomino.x + 1, fromDomino.y]]
        : [[fromDomino.x, fromDomino.y], [fromDomino.x, fromDomino.y + 1]];
      const allowedContact = new Set<string>([
        ...placementCellSet,
        ...fromDominoCells.map(([cx, cy]) => `${cx},${cy}`),
      ]);
      const illegalContact = placementCells.some(([cx, cy]) => {
        const nb: Array<[number, number]> = [
          [cx, cy - 1], [cx, cy + 1], [cx - 1, cy], [cx + 1, cy],
          [cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1], [cx + 1, cy + 1],
        ];
        return nb.some(([nx, ny]) => {
          const k = `${nx},${ny}`;
          if (allowedContact.has(k)) return false;
          if (!state.board[k]) return false;
          return true;
        });
      });
      if (illegalContact) return;

      validMove = {
        end, dominoData, flipped, orientation: finalOrientation, x, y,
        fromDominoId: fromCell.dominoId,
      };
    };

    check(dominoData.value1, false);
    if (!validMove) check(dominoData.value2, true);

    if (validMove) {
      moves.push(validMove);
      uniqueEnds[`${end.x},${end.y}`] = true;
    }
  });

  return moves;
};

// ---------- applyMove (pure port van executeMove's board/forbiddens/dominoes updates) ----------
const applyMove = (state: GameState, move: PureLegalMove, dominoId: string): GameState => {
  const { end, dominoData, flipped, orientation, x, y } = move;
  const newForbiddens = { ...state.forbiddens };

  if (isDouble(dominoData)) {
    newForbiddens[`${x},${y}`] = true;
    if (orientation === 'horizontal') newForbiddens[`${x + 1},${y}`] = true;
    else newForbiddens[`${x},${y + 1}`] = true;

    const dir = end.fromDir;
    if (dir === 'N') {
      newForbiddens[`${x - 1},${y + 2}`] = true; newForbiddens[`${x + 1},${y + 2}`] = true;
      newForbiddens[`${x - 1},${y + 1}`] = true; newForbiddens[`${x + 1},${y + 1}`] = true;
      newForbiddens[`${x - 1},${y}`] = true;     newForbiddens[`${x + 1},${y}`] = true;
      newForbiddens[`${x},${y + 2}`] = true;
    } else if (dir === 'S') {
      newForbiddens[`${x - 1},${y - 1}`] = true; newForbiddens[`${x + 1},${y - 1}`] = true;
      newForbiddens[`${x - 1},${y - 2}`] = true; newForbiddens[`${x + 1},${y - 2}`] = true;
      newForbiddens[`${x - 1},${y}`] = true;     newForbiddens[`${x + 1},${y}`] = true;
      newForbiddens[`${x},${y - 2}`] = true;
    } else if (dir === 'E') {
      newForbiddens[`${x - 1},${y + 1}`] = true; newForbiddens[`${x - 1},${y - 1}`] = true;
      newForbiddens[`${x - 2},${y + 1}`] = true; newForbiddens[`${x - 2},${y - 1}`] = true;
      newForbiddens[`${x},${y + 1}`] = true;     newForbiddens[`${x},${y - 1}`] = true;
      newForbiddens[`${x - 2},${y}`] = true;
    } else if (dir === 'W') {
      newForbiddens[`${x + 1},${y + 1}`] = true; newForbiddens[`${x + 1},${y - 1}`] = true;
      newForbiddens[`${x + 2},${y + 1}`] = true; newForbiddens[`${x + 2},${y - 1}`] = true;
      newForbiddens[`${x},${y + 1}`] = true;     newForbiddens[`${x},${y - 1}`] = true;
      newForbiddens[`${x + 2},${y}`] = true;
    }
  } else {
    const dir = end.fromDir;
    if (dir === 'N') {
      newForbiddens[`${x - 1},${y + 2}`] = true; newForbiddens[`${x + 1},${y + 2}`] = true;
      newForbiddens[`${x - 1},${y + 1}`] = true; newForbiddens[`${x + 1},${y + 1}`] = true;
      newForbiddens[`${x},${y + 3}`] = true;
    } else if (dir === 'S') {
      newForbiddens[`${x - 1},${y - 1}`] = true; newForbiddens[`${x + 1},${y - 1}`] = true;
      newForbiddens[`${x - 1},${y}`] = true;     newForbiddens[`${x + 1},${y}`] = true;
      newForbiddens[`${x},${y - 2}`] = true;
    } else if (dir === 'W') {
      newForbiddens[`${x + 2},${y + 1}`] = true; newForbiddens[`${x + 2},${y - 1}`] = true;
      newForbiddens[`${x + 1},${y + 1}`] = true; newForbiddens[`${x + 1},${y - 1}`] = true;
      if (`${x + 3},${y}` !== '1,0') newForbiddens[`${x + 3},${y}`] = true;
    } else if (dir === 'E') {
      newForbiddens[`${x - 1},${y - 1}`] = true; newForbiddens[`${x - 1},${y + 1}`] = true;
      newForbiddens[`${x},${y - 1}`] = true;     newForbiddens[`${x},${y + 1}`] = true;
      if (`${x - 2},${y}` !== '-1,0') newForbiddens[`${x - 2},${y}`] = true;
    }
  }

  const dominoState: DominoState = {
    data: dominoData, x, y, orientation, flipped,
    isSpinner: isDouble(dominoData),
    rotation: 0, rotationX: 0, rotationY: 0, rotationZ: 0,
  };

  const pips = flipped
    ? [dominoData.value2, dominoData.value1]
    : [dominoData.value1, dominoData.value2];
  const cells: Array<[number, number]> = orientation === 'horizontal'
    ? [[x, y], [x + 1, y]]
    : [[x, y], [x, y + 1]];

  const newBoard = { ...state.board };
  cells.forEach((c, i) => {
    newBoard[`${c[0]},${c[1]}`] = { dominoId, value: pips[i] };
  });

  return {
    ...state,
    dominoes: { ...state.dominoes, [dominoId]: dominoState },
    board: newBoard,
    forbiddens: newForbiddens,
  };
};

// ---------- pick best legal move for L-shape (prefer E first, then S) ----------
const scoreMoveForL = (
  move: PureLegalMove,
  index: number,
  total: number
): number => {
  // Eerste helft: bouw naar het oosten (rechts). Tweede helft: bouw naar het zuiden.
  const preferSouth = index >= Math.ceil(total / 2);
  const dir = move.end.fromDir;
  if (preferSouth) {
    if (dir === 'S') return 100 + move.y;
    if (dir === 'E') return 50 + move.x;
    return -Math.abs(move.x) - Math.abs(move.y);
  }
  if (dir === 'E') return 100 + move.x;
  if (dir === 'S') return 50 + move.y;
  return -Math.abs(move.x) - Math.abs(move.y);
};

// ---------- MAIN: relayout a chain using stable placement rules ----------
export const stableRelayoutTableState = (
  state: GameState,
  orderedDominoEntries: Array<[string, GameState['dominoes'][string]]>
): GameState | null => {
  if (orderedDominoEntries.length < 2) return null;

  const [firstId, firstDom] = orderedDominoEntries[0];
  const firstIsDouble = isDouble(firstDom.data);
  const firstOrientation: Orientation = firstIsDouble ? 'vertical' : 'horizontal';
  const firstCells: Array<[number, number]> = firstOrientation === 'horizontal'
    ? [[0, 0], [1, 0]]
    : [[0, 0], [0, 1]];

  const firstDominoState: DominoState = {
    data: firstDom.data,
    x: 0, y: 0,
    orientation: firstOrientation,
    flipped: false,
    isSpinner: firstIsDouble,
    rotation: 0, rotationX: 0, rotationY: 0, rotationZ: 0,
  };

  const initBoard: GameState['board'] = {};
  const initPips = [firstDom.data.value1, firstDom.data.value2];
  firstCells.forEach((c, i) => {
    initBoard[`${c[0]},${c[1]}`] = { dominoId: firstId, value: initPips[i] };
  });

  let working: GameState = {
    ...state,
    dominoes: { [firstId]: firstDominoState },
    board: initBoard,
    forbiddens: {},
    openEnds: [],
  };

  const total = orderedDominoEntries.length;
  for (let i = 1; i < total; i += 1) {
    const [dominoId, domino] = orderedDominoEntries[i];
    const moves = findLegalMoves(working, domino.data);
    if (moves.length === 0) return null;

    moves.sort((a, b) => scoreMoveForL(b, i, total) - scoreMoveForL(a, i, total));
    const chosen = moves[0];
    working = applyMove(working, chosen, dominoId);
  }

  const finalOpenEnds = regenerateOpenEnds(working);
  return { ...working, openEnds: finalOpenEnds };
};