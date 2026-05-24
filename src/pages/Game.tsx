
import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DominoGame } from '@/components/DominoGame';
import { DominoGame as DominoGameStable } from '@/components/stable/DominoGame';
import { GameVersionToggle } from '@/components/GameVersionToggle';
import { useGameVersion } from '@/hooks/useGameVersion';
import { useDominoGame } from '@/hooks/useDominoGame';
import { PersistedGameState, useSyncedDominoGameState } from '@/hooks/useSyncedDominoGameState';
import { useBotAI } from '@/hooks/useBotAI';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { useToast } from '@/hooks/use-toast';
import { useGameVisualSettings } from '@/hooks/useGameVisualSettings';
import { useAppSettings } from '@/hooks/useAppSettings';
import { useUserRoles } from '@/hooks/useUserRoles';
import type { DominoData, GameState, LegalMove, OpenEnd, ShakeAnimationProfile } from '@/types/domino';
import { WegaPhaseOverlay } from '@/components/WegaPhaseOverlay';
import { WegaPlayingOverlay } from '@/components/WegaPlayingOverlay';
import { logGameEvent } from '@/lib/gameLogger';

type MoveWithEffects = LegalMove & { localHardSlamActive?: boolean };

interface GameOutcomePlayerPayload {
  user_id: string;
  player_position: number;
  points_scored: number;
  pips_remaining: number;
  won: boolean;
  hard_slams_used: number;
  turns_played: number;
  won_by_changa: boolean;
}

interface BotDebugInfo {
  status: string;
  details: string;
  isBotTurn: boolean;
  currentPlayer: number;
  controllerPosition: number | null;
  turnKey: string;
  legalMoves: number;
  boneyardSize: number;
  updatedAt: number;
}

const DEFAULT_MIN_PLACEMENT_DELAY_MS = 950;

const buildConsolidatedState = (
  remoteState: PersistedGameState | null,
  currentState: GameState,
  myPos: number,
  actorPos?: number
): PersistedGameState => {
  const remote = remoteState ?? ({} as PersistedGameState);
  const remoteHands = Array.isArray(remote.playerHands) ? [...remote.playerHands] : [];
  const nextHands = Array.isArray(currentState.playerHands) ? [...currentState.playerHands] : remoteHands;
  const effectiveActor = typeof actorPos === 'number' ? actorPos : myPos;

  if (!Array.isArray(currentState.playerHands)) {
    nextHands[effectiveActor] = currentState.playerHand || [];
  }

  const localPlayerHand = nextHands[myPos] || currentState.playerHand || [];

  return {
    ...remote,
    dominoes: currentState.dominoes,
    board: currentState.board,
    boneyard: currentState.boneyard,
    forbiddens: currentState.forbiddens,
    openEnds: currentState.openEnds,
    nextDominoId: currentState.nextDominoId,
    spinnerId: currentState.spinnerId,
    isGameOver: currentState.isGameOver,
    playerHand: localPlayerHand,
    playerHands: nextHands,
    gameEndReason: currentState.gameEndReason,
    winner_position: currentState.winner_position,
    hardSlamNextMove: currentState.hardSlamNextMove,
    isHardSlamming: currentState.isHardSlamming,
    hardSlamDominoId: currentState.hardSlamDominoId,
    triggerHardSlamAnimation: currentState.triggerHardSlamAnimation,
    hardSlamAnimationProfile: currentState.hardSlamAnimationProfile,
    hardSlamActorUserId: currentState.hardSlamActorUserId,
    lastMoveActorUserId: currentState.lastMoveActorUserId,
    moveCooldownUntilMs: currentState.moveCooldownUntilMs,
  };
};

const getOpenEndAnchorKey = (end: OpenEnd): string | null => {
  if (typeof end.anchorX === 'number' && typeof end.anchorY === 'number') {
    return `${end.anchorX},${end.anchorY}`;
  }

  switch (end.fromDir) {
    case 'N':
      return `${end.x},${end.y + 1}`;
    case 'S':
      return `${end.x},${end.y - 1}`;
    case 'W':
      return `${end.x + 1},${end.y}`;
    case 'E':
      return `${end.x - 1},${end.y}`;
    default:
      return null;
  }
};

type FixTableLayoutRotation = 'l-0' | 'l-90' | 'l-180' | 'l-270';
type LayoutDirection = 'N' | 'S' | 'E' | 'W';

const FIX_TABLE_LAYOUT_SEQUENCE: FixTableLayoutRotation[] = ['l-0', 'l-90', 'l-180', 'l-270'];

const getFixLayoutLabel = (rotation: FixTableLayoutRotation): string => {
  switch (rotation) {
    case 'l-0':
      return 'L-rotatie 0°';
    case 'l-90':
      return 'L-rotatie 90°';
    case 'l-180':
      return 'L-rotatie 180°';
    case 'l-270':
      return 'L-rotatie 270°';
    default:
      return 'L-rotatie';
  }
};

const parseDominoIndex = (dominoId: string): number => {
  const numericPart = Number.parseInt(dominoId.replace(/[^\d]/g, ''), 10);
  return Number.isFinite(numericPart) ? numericPart : 0;
};

const generateDirectionsForLayout = (rotation: FixTableLayoutRotation, dominoCount: number): LayoutDirection[] => {
  const remaining = Math.max(0, dominoCount - 1);
  if (remaining === 0) return [];

  const basePattern: [LayoutDirection, LayoutDirection] = (() => {
    switch (rotation) {
      case 'l-0':
        return ['E', 'S'];
      case 'l-90':
        return ['S', 'W'];
      case 'l-180':
        return ['W', 'N'];
      case 'l-270':
        return ['N', 'E'];
      default:
        return ['E', 'S'];
    }
  })();

  const [firstLegDirection, secondLegDirection] = basePattern;
  const legSize = Math.max(2, Math.ceil(Math.sqrt(dominoCount)));
  const directions: LayoutDirection[] = [];
  const pushSteps = (direction: LayoutDirection, steps: number): void => {
    for (let i = 0; i < steps && directions.length < remaining; i += 1) {
      directions.push(direction);
    }
  };

  while (directions.length < remaining) {
    pushSteps(firstLegDirection, legSize);
    pushSteps(secondLegDirection, legSize);
  }

  return directions;
};

interface ChainPlacement {
  x: number;
  y: number;
  orientation: 'horizontal' | 'vertical';
  flipped: boolean;
  values: [number, number];
  cells: Array<[number, number]>;
  endpointCell: [number, number];
  endpointValue: number;
  fromDir: LayoutDirection | null;
}

interface FixOpenEnd {
  endpointCell: [number, number];
  requiredValue: number;
  anchorCells: Array<[number, number]>;
  side: 'left' | 'right';
  outwardDir: LayoutDirection;
}

type FixPlacementSide = 'left' | 'right' | 'any';

const directionDelta: Record<LayoutDirection, [number, number]> = {
  N: [0, -1],
  S: [0, 1],
  E: [1, 0],
  W: [-1, 0],
};

const createPlacementCandidate = (
  endpoint: { x: number; y: number },
  direction: LayoutDirection
): Omit<ChainPlacement, 'flipped' | 'values' | 'endpointValue' | 'fromDir'> & { innerIndex: 0 | 1; outerIndex: 0 | 1 } => {
  if (direction === 'E') {
    const cells: Array<[number, number]> = [
      [endpoint.x + 1, endpoint.y],
      [endpoint.x + 2, endpoint.y],
    ];
    return {
      x: endpoint.x + 1,
      y: endpoint.y,
      orientation: 'horizontal',
      cells,
      endpointCell: [endpoint.x + 2, endpoint.y],
      innerIndex: 0,
      outerIndex: 1,
    };
  }
  if (direction === 'W') {
    const cells: Array<[number, number]> = [
      [endpoint.x - 2, endpoint.y],
      [endpoint.x - 1, endpoint.y],
    ];
    return {
      x: endpoint.x - 2,
      y: endpoint.y,
      orientation: 'horizontal',
      cells,
      endpointCell: [endpoint.x - 2, endpoint.y],
      innerIndex: 1,
      outerIndex: 0,
    };
  }
  if (direction === 'S') {
    const cells: Array<[number, number]> = [
      [endpoint.x, endpoint.y + 1],
      [endpoint.x, endpoint.y + 2],
    ];
    return {
      x: endpoint.x,
      y: endpoint.y + 1,
      orientation: 'vertical',
      cells,
      endpointCell: [endpoint.x, endpoint.y + 2],
      innerIndex: 0,
      outerIndex: 1,
    };
  }

  const cells: Array<[number, number]> = [
    [endpoint.x, endpoint.y - 2],
    [endpoint.x, endpoint.y - 1],
  ];
  return {
    x: endpoint.x,
    y: endpoint.y - 2,
    orientation: 'vertical',
    cells,
    endpointCell: [endpoint.x, endpoint.y - 2],
    innerIndex: 1,
    outerIndex: 0,
  };
};

const createDoublePlacementCandidates = (
  endpoint: { x: number; y: number },
  direction: LayoutDirection
): Array<Omit<ChainPlacement, 'flipped' | 'values' | 'endpointValue' | 'fromDir'> & { innerIndex: 0 | 1; outerIndex: 0 | 1 }> => {
  const [dx, dy] = directionDelta[direction];
  const entryX = endpoint.x + dx;
  const entryY = endpoint.y + dy;

  if (direction === 'E' || direction === 'W') {
    return [
      {
        x: entryX,
        y: entryY,
        orientation: 'vertical',
        cells: [[entryX, entryY], [entryX, entryY + 1]],
        endpointCell: [entryX, entryY],
        innerIndex: 0,
        outerIndex: 0,
      },
      {
        x: entryX,
        y: entryY - 1,
        orientation: 'vertical',
        cells: [[entryX, entryY - 1], [entryX, entryY]],
        endpointCell: [entryX, entryY],
        innerIndex: 1,
        outerIndex: 1,
      },
    ];
  }

  return [
    {
      x: entryX,
      y: entryY,
      orientation: 'horizontal',
      cells: [[entryX, entryY], [entryX + 1, entryY]],
      endpointCell: [entryX, entryY],
      innerIndex: 0,
      outerIndex: 0,
    },
    {
      x: entryX - 1,
      y: entryY,
      orientation: 'horizontal',
      cells: [[entryX - 1, entryY], [entryX, entryY]],
      endpointCell: [entryX, entryY],
      innerIndex: 1,
      outerIndex: 1,
    },
  ];
};

const fallbackDirections: Record<LayoutDirection, LayoutDirection[]> = {
  E: ['E', 'S', 'N', 'W'],
  W: ['W', 'N', 'S', 'E'],
  S: ['S', 'W', 'E', 'N'],
  N: ['N', 'E', 'W', 'S'],
};

const resolveValuesByInnerMatch = (
  value1: number,
  value2: number,
  targetValue: number,
  innerIndex: 0 | 1
): { flipped: boolean; values: [number, number] } | null => {
  if (innerIndex === 0) {
    if (value1 === targetValue) return { flipped: false, values: [value1, value2] };
    if (value2 === targetValue) return { flipped: true, values: [value2, value1] };
    return null;
  }

  if (value2 === targetValue) return { flipped: false, values: [value1, value2] };
  if (value1 === targetValue) return { flipped: true, values: [value2, value1] };
  return null;
};

const hasIllegalSideContact = (
  candidateCells: Array<[number, number]>,
  anchorCells: Array<[number, number]>,
  occupiedByCell: Map<string, string>
): boolean => {
  const placementCellSet = new Set(candidateCells.map(([x, y]) => `${x},${y}`));
  const allowedContactSet = new Set<string>([
    ...placementCellSet,
    ...anchorCells.map(([x, y]) => `${x},${y}`),
  ]);

  return candidateCells.some(([cx, cy]) => {
    const neighbors = [
      [cx, cy - 1], [cx, cy + 1], [cx - 1, cy], [cx + 1, cy],
      [cx - 1, cy - 1], [cx + 1, cy - 1], [cx - 1, cy + 1], [cx + 1, cy + 1],
    ] as const;

    return neighbors.some(([nx, ny]) => {
      const key = `${nx},${ny}`;
      if (allowedContactSet.has(key)) return false;
      return occupiedByCell.has(key);
    });
  });
};

const areAdjacentCells = (a: [number, number], b: [number, number]): boolean =>
  Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) === 1;

const countOccupiedNeighbors = (
  cell: [number, number],
  occupiedByCell: Map<string, string>
): number => {
  const [x, y] = cell;
  const neighbors = [
    [x, y - 1], [x, y + 1], [x - 1, y], [x + 1, y],
    [x - 1, y - 1], [x + 1, y - 1], [x - 1, y + 1], [x + 1, y + 1],
  ] as const;
  return neighbors.reduce((acc, [nx, ny]) => acc + (occupiedByCell.has(`${nx},${ny}`) ? 1 : 0), 0);
};

const isOpenEndPlayable = (openEnd: FixOpenEnd, occupiedByCell: Map<string, string>): boolean => {
  const [dx, dy] = directionDelta[openEnd.outwardDir];
  const openCell: [number, number] = [openEnd.endpointCell[0] + dx, openEnd.endpointCell[1] + dy];
  const forwardCell: [number, number] = [openEnd.endpointCell[0] + (2 * dx), openEnd.endpointCell[1] + (2 * dy)];
  const openCellKey = `${openCell[0]},${openCell[1]}`;
  const forwardCellKey = `${forwardCell[0]},${forwardCell[1]}`;

  if (occupiedByCell.has(openCellKey)) return false;
  if (occupiedByCell.has(forwardCellKey)) return false;

  // Keep consistency with hasDifferentNeighbor guard used in legal move generation.
  if (countOccupiedNeighbors(openCell, occupiedByCell) > 3) return false;

  return true;
};

const inferPlacementSides = (
  state: GameState,
  orderedDominoEntries: Array<[string, GameState['dominoes'][string]]>
): FixPlacementSide[] => {
  const sides: FixPlacementSide[] = new Array(orderedDominoEntries.length).fill('any');
  if (orderedDominoEntries.length <= 1) return sides;

  const boardCellsByDomino = new Map<string, Array<[number, number]>>();
  Object.entries(state.board).forEach(([coord, cell]) => {
    const [x, y] = coord.split(',').map(Number);
    const current = boardCellsByDomino.get(cell.dominoId) || [];
    current.push([x, y]);
    boardCellsByDomino.set(cell.dominoId, current);
  });

  const getCells = (dominoId: string): Array<[number, number]> => {
    const fromBoard = boardCellsByDomino.get(dominoId);
    if (fromBoard && fromBoard.length >= 2) return fromBoard;

    const domino = state.dominoes[dominoId];
    if (!domino) return [];
    return domino.orientation === 'horizontal'
      ? [[domino.x, domino.y], [domino.x + 1, domino.y]]
      : [[domino.x, domino.y], [domino.x, domino.y + 1]];
  };

  const touches = (idA: string, idB: string): boolean => {
    const cellsA = getCells(idA);
    const cellsB = getCells(idB);
    return cellsA.some((a) => cellsB.some((b) => areAdjacentCells(a, b)));
  };

  const chainOrder: string[] = [orderedDominoEntries[0][0]];
  for (let index = 1; index < orderedDominoEntries.length; index += 1) {
    const currentId = orderedDominoEntries[index][0];
    const leftId = chainOrder[0];
    const rightId = chainOrder[chainOrder.length - 1];
    const touchesLeft = touches(currentId, leftId);
    const touchesRight = touches(currentId, rightId);

    if (touchesLeft && !touchesRight) {
      sides[index] = 'left';
      chainOrder.unshift(currentId);
      continue;
    }
    if (touchesRight && !touchesLeft) {
      sides[index] = 'right';
      chainOrder.push(currentId);
      continue;
    }

    // Ambiguous or not reliably inferable from current board shape.
    sides[index] = 'any';
    if (touchesRight) {
      chainOrder.push(currentId);
    } else if (touchesLeft) {
      chainOrder.unshift(currentId);
    } else {
      chainOrder.push(currentId);
    }
  }

  return sides;
};

// Bouw de daadwerkelijke lineaire ketenvolgorde door over de buurrelaties op
// het bord te lopen, in plaats van te vertrouwen op de plaatsingsvolgorde
// (d0, d1, …). Als er een vertakking (spinner met >2 buren) of een gesloten
// lus is, geven we null terug zodat "Fix stenen" netjes met een toast meldt
// dat hij niet kan relayouten.
const computeLinearChainOrder = (
  state: GameState
): Array<[string, GameState['dominoes'][string]]> | null => {
  const entries = Object.entries(state.dominoes);
  if (entries.length <= 1) return entries;

  const cellsByDomino = new Map<string, Array<[number, number]>>();
  Object.entries(state.board).forEach(([coord, cell]) => {
    const [x, y] = coord.split(',').map(Number);
    const arr = cellsByDomino.get(cell.dominoId) || [];
    arr.push([x, y]);
    cellsByDomino.set(cell.dominoId, arr);
  });
  for (const [id, dom] of entries) {
    const existing = cellsByDomino.get(id);
    if (existing && existing.length >= 2) continue;
    const cells: Array<[number, number]> = dom.orientation === 'horizontal'
      ? [[dom.x, dom.y], [dom.x + 1, dom.y]]
      : [[dom.x, dom.y], [dom.x, dom.y + 1]];
    cellsByDomino.set(id, cells);
  }

  // Adjacency: twee dominoes zijn buren als willekeurige cel van A
  // orthogonaal grenst aan een cel van B (geen diagonalen).
  const adjacency = new Map<string, Set<string>>();
  const ids = entries.map(([id]) => id);
  for (const id of ids) adjacency.set(id, new Set());
  for (let i = 0; i < ids.length; i += 1) {
    for (let j = i + 1; j < ids.length; j += 1) {
      const a = cellsByDomino.get(ids[i]) || [];
      const b = cellsByDomino.get(ids[j]) || [];
      const touch = a.some(([ax, ay]) => b.some(([bx, by]) =>
        Math.abs(ax - bx) + Math.abs(ay - by) === 1));
      if (touch) {
        adjacency.get(ids[i])!.add(ids[j]);
        adjacency.get(ids[j])!.add(ids[i]);
      }
    }
  }

  // Vertakking → niet lineair relaybaar.
  for (const [, neighbors] of adjacency) {
    if (neighbors.size > 2) return null;
  }

  // Zoek een eindpunt (1 buur). Bij een gesloten lus bestaat dat niet.
  const endpoint = ids.find((id) => (adjacency.get(id)?.size ?? 0) === 1)
    ?? ids.find((id) => (adjacency.get(id)?.size ?? 0) === 0);
  if (!endpoint) return null;

  // Loop de keten af.
  const order: string[] = [];
  const visited = new Set<string>();
  let prev: string | null = null;
  let curr: string | null = endpoint;
  while (curr && !visited.has(curr)) {
    visited.add(curr);
    order.push(curr);
    const neighbors = Array.from(adjacency.get(curr) || []);
    const nextId = neighbors.find((n) => n !== prev) ?? null;
    prev = curr;
    curr = nextId;
  }
  if (order.length !== ids.length) return null; // niet verbonden

  const entryMap = new Map(entries);
  return order.map((id) => [id, entryMap.get(id)!] as [string, GameState['dominoes'][string]]);
};

const applyForbiddenRulesForPlacement = (
  forbiddens: Record<string, boolean>,
  placement: ChainPlacement,
  dominoData: DominoData
): void => {
  const { x, y, orientation, fromDir } = placement;
  if (!fromDir) return;

  if (dominoData.value1 === dominoData.value2) {
    forbiddens[`${x},${y}`] = true;
    if (orientation === 'horizontal') {
      forbiddens[`${x + 1},${y}`] = true;
    } else {
      forbiddens[`${x},${y + 1}`] = true;
    }

    if (fromDir === 'N') {
      forbiddens[`${x - 1},${y + 2}`] = true;
      forbiddens[`${x + 1},${y + 2}`] = true;
      forbiddens[`${x - 1},${y + 1}`] = true;
      forbiddens[`${x + 1},${y + 1}`] = true;
      forbiddens[`${x - 1},${y}`] = true;
      forbiddens[`${x + 1},${y}`] = true;
      forbiddens[`${x},${y + 3}`] = true;
      forbiddens[`${x},${y + 2}`] = true;
    }
    if (fromDir === 'S') {
      forbiddens[`${x - 1},${y - 1}`] = true;
      forbiddens[`${x + 1},${y - 1}`] = true;
      forbiddens[`${x - 1},${y - 2}`] = true;
      forbiddens[`${x + 1},${y - 2}`] = true;
      forbiddens[`${x - 1},${y}`] = true;
      forbiddens[`${x + 1},${y}`] = true;
      forbiddens[`${x},${y - 2}`] = true;
      forbiddens[`${x},${y - 3}`] = true;
    }
    if (fromDir === 'E') {
      forbiddens[`${x - 1},${y + 1}`] = true;
      forbiddens[`${x - 1},${y - 1}`] = true;
      forbiddens[`${x - 2},${y + 1}`] = true;
      forbiddens[`${x - 2},${y - 1}`] = true;
      forbiddens[`${x},${y + 1}`] = true;
      forbiddens[`${x},${y - 1}`] = true;
      forbiddens[`${x - 2},${y}`] = true;
      forbiddens[`${x - 3},${y}`] = true;
    }
    if (fromDir === 'W') {
      forbiddens[`${x + 1},${y + 1}`] = true;
      forbiddens[`${x + 1},${y - 1}`] = true;
      forbiddens[`${x + 2},${y + 1}`] = true;
      forbiddens[`${x + 2},${y - 1}`] = true;
      forbiddens[`${x},${y + 1}`] = true;
      forbiddens[`${x},${y - 1}`] = true;
      forbiddens[`${x + 2},${y}`] = true;
      forbiddens[`${x + 3},${y}`] = true;
    }
    return;
  }

  if (fromDir === 'N') {
    forbiddens[`${x - 1},${y + 2}`] = true;
    forbiddens[`${x + 1},${y + 2}`] = true;
    forbiddens[`${x - 1},${y + 1}`] = true;
    forbiddens[`${x + 1},${y + 1}`] = true;
    forbiddens[`${x},${y + 3}`] = true;
  }
  if (fromDir === 'S') {
    forbiddens[`${x - 1},${y - 1}`] = true;
    forbiddens[`${x + 1},${y - 1}`] = true;
    forbiddens[`${x - 1},${y}`] = true;
    forbiddens[`${x + 1},${y}`] = true;
    forbiddens[`${x},${y - 2}`] = true;
  }
  if (fromDir === 'W') {
    forbiddens[`${x + 2},${y + 1}`] = true;
    forbiddens[`${x + 2},${y - 1}`] = true;
    forbiddens[`${x + 1},${y + 1}`] = true;
    forbiddens[`${x + 1},${y - 1}`] = true;
    if (`${x + 3},${y}` !== '1,0') forbiddens[`${x + 3},${y}`] = true;
  }
  if (fromDir === 'E') {
    forbiddens[`${x - 1},${y - 1}`] = true;
    forbiddens[`${x - 1},${y + 1}`] = true;
    forbiddens[`${x},${y - 1}`] = true;
    forbiddens[`${x},${y + 1}`] = true;
    if (`${x - 2},${y}` !== '-1,0') forbiddens[`${x - 2},${y}`] = true;
  }
};

const rebuildForbiddensFromPlacements = (
  orderedDominoEntries: Array<[string, GameState['dominoes'][string]]>,
  placements: ChainPlacement[]
): Record<string, boolean> => {
  const rebuilt: Record<string, boolean> = {};
  for (let index = 1; index < placements.length; index += 1) {
    const placement = placements[index];
    const [, domino] = orderedDominoEntries[index];
    applyForbiddenRulesForPlacement(rebuilt, placement, domino.data);
  }
  return rebuilt;
};

const buildPlacementWithTwoEnds = (
  orderedDominoEntries: Array<[string, GameState['dominoes'][string]]>,
  directions: LayoutDirection[],
  firstFlipped: boolean,
  placementSides: FixPlacementSide[]
): ChainPlacement[] | null => {
  if (orderedDominoEntries.length === 0) return [];

  const [firstDominoId, firstDomino] = orderedDominoEntries[0];
  const firstValues: [number, number] = firstFlipped
    ? [firstDomino.data.value2, firstDomino.data.value1]
    : [firstDomino.data.value1, firstDomino.data.value2];
  const firstCells: Array<[number, number]> = [[0, 0], [1, 0]];
  const firstPlacement: ChainPlacement = {
    x: 0,
    y: 0,
    orientation: 'horizontal',
    flipped: firstFlipped,
    values: firstValues,
    cells: firstCells,
    endpointCell: [1, 0],
    endpointValue: firstValues[1],
    fromDir: null,
  };

  const occupiedByCell = new Map<string, string>();
  firstCells.forEach(([x, y]) => occupiedByCell.set(`${x},${y}`, firstDominoId));

  const scoreOpenEnd = (openEnd: FixOpenEnd, preferred: LayoutDirection): number => {
    const [x, y] = openEnd.endpointCell;
    switch (preferred) {
      case 'E':
        return x;
      case 'W':
        return -x;
      case 'S':
        return y;
      case 'N':
        return -y;
      default:
        return 0;
    }
  };

  const tryPlaceRecursive = (
    dominoIndex: number,
    placements: ChainPlacement[],
    openEnds: FixOpenEnd[]
  ): ChainPlacement[] | null => {
    if (dominoIndex >= orderedDominoEntries.length) {
      return placements;
    }

    const [, domino] = orderedDominoEntries[dominoIndex];
    const preferredDirection = directions[dominoIndex - 1] ?? directions[directions.length - 1] ?? 'E';
    const directionAttempts = fallbackDirections[preferredDirection];
    const preferredSide = placementSides[dominoIndex] ?? 'any';
    const sortedOpenEnds = [...openEnds].sort(
      (a, b) => scoreOpenEnd(b, preferredDirection) - scoreOpenEnd(a, preferredDirection)
    );
    const candidateOpenEnds = preferredSide === 'any'
      ? sortedOpenEnds
      : sortedOpenEnds.filter((end) => end.side === preferredSide);
    const openEndsToTry = candidateOpenEnds.length > 0 ? candidateOpenEnds : sortedOpenEnds;

    for (const openEnd of openEndsToTry) {
      for (const direction of directionAttempts) {
        const candidates = (domino.data.value1 === domino.data.value2)
          ? createDoublePlacementCandidates(
              { x: openEnd.endpointCell[0], y: openEnd.endpointCell[1] },
              direction
            )
          : [
              createPlacementCandidate(
                { x: openEnd.endpointCell[0], y: openEnd.endpointCell[1] },
                direction
              ),
            ];

        for (const candidate of candidates) {
          const overlapsExisting = candidate.cells.some(([x, y]) => occupiedByCell.has(`${x},${y}`));
          if (overlapsExisting) continue;

          const valueResolution = resolveValuesByInnerMatch(
            domino.data.value1,
            domino.data.value2,
            openEnd.requiredValue,
            candidate.innerIndex
          );
          if (!valueResolution) continue;

          if (hasIllegalSideContact(candidate.cells, openEnd.anchorCells, occupiedByCell)) continue;

          const endpointValue = valueResolution.values[candidate.outerIndex];
          const placement: ChainPlacement = {
            x: candidate.x,
            y: candidate.y,
            orientation: candidate.orientation,
            flipped: valueResolution.flipped,
            values: valueResolution.values,
            cells: candidate.cells,
            endpointCell: candidate.endpointCell,
            endpointValue,
            fromDir: direction,
          };

          const [dominoId] = orderedDominoEntries[dominoIndex];
          placement.cells.forEach(([x, y]) => occupiedByCell.set(`${x},${y}`, dominoId));

          const nextOpenEnds = openEnds.map((end) =>
            end === openEnd
              ? ({
                  endpointCell: placement.endpointCell,
                  requiredValue: placement.endpointValue,
                  anchorCells: placement.cells,
                  side: end.side,
                  outwardDir: direction,
                } satisfies FixOpenEnd)
              : end
          );
          const allEndsPlayable = nextOpenEnds.every((end) => isOpenEndPlayable(end, occupiedByCell));
          if (!allEndsPlayable) {
            placement.cells.forEach(([x, y]) => occupiedByCell.delete(`${x},${y}`));
            continue;
          }

          const nextPlacements = [...placements, placement];
          const solved = tryPlaceRecursive(dominoIndex + 1, nextPlacements, nextOpenEnds);
          if (solved) return solved;

          placement.cells.forEach(([x, y]) => occupiedByCell.delete(`${x},${y}`));
        }
      }
    }

    return null;
  };

  const initialOpenEnds: FixOpenEnd[] = [
    {
      endpointCell: [0, 0],
      requiredValue: firstValues[0],
      anchorCells: firstCells,
      side: 'left',
      outwardDir: 'W',
    },
    {
      endpointCell: [1, 0],
      requiredValue: firstValues[1],
      anchorCells: firstCells,
      side: 'right',
      outwardDir: 'E',
    },
  ];

  return tryPlaceRecursive(1, [firstPlacement], initialOpenEnds);
};

const relayoutTableState = (
  state: GameState,
  rotation: FixTableLayoutRotation,
  regenerateOpenEnds: (state: GameState) => OpenEnd[]
): GameState | null => {
  const orderedDominoEntries = Object.entries(state.dominoes).sort(
    ([dominoA], [dominoB]) => {
      const indexA = parseDominoIndex(dominoA);
      const indexB = parseDominoIndex(dominoB);
      if (indexA !== indexB) return indexA - indexB;
      return dominoA.localeCompare(dominoB);
    }
  );
  if (orderedDominoEntries.length < 2) return null;

  const directions = generateDirectionsForLayout(rotation, orderedDominoEntries.length);
  const placementSides = inferPlacementSides(state, orderedDominoEntries);
  const firstTry = buildPlacementWithTwoEnds(orderedDominoEntries, directions, false, placementSides);
  const placements = firstTry ?? buildPlacementWithTwoEnds(orderedDominoEntries, directions, true, placementSides);
  if (!placements || placements.length !== orderedDominoEntries.length) return null;

  const newDominoes = { ...state.dominoes };
  const newBoard: Record<string, { dominoId: string; value: number }> = {};

  orderedDominoEntries.forEach(([dominoId, domino], index) => {
    const placement = placements[index];
    const relaidDomino = {
      ...domino,
      x: placement.x,
      y: placement.y,
      orientation: placement.orientation,
      flipped: placement.flipped,
    };
    newDominoes[dominoId] = relaidDomino;

    placement.cells.forEach(([x, y], cellIndex) => {
      newBoard[`${x},${y}`] = { dominoId, value: placement.values[cellIndex] };
    });
  });

  const rebuiltForbiddens = rebuildForbiddensFromPlacements(orderedDominoEntries, placements);

  const tempState: GameState = {
    ...state,
    dominoes: newDominoes,
    board: newBoard,
    forbiddens: rebuiltForbiddens,
  };

  return {
    ...tempState,
    openEnds: regenerateOpenEnds(tempState),
  };
};

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const savedRef = useRef(false);
  const executeMoveSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passMoveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardSlamResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const moveAnimationLockUntilRef = useRef<number>(0);
  const nextFixLayoutIndexRef = useRef(0);
  const botTurnExecutionRef = useRef<string | null>(null);
  const botTurnObservedAtRef = useRef<Record<string, number>>({});
  const botAwaitingTurnAdvanceRef = useRef<{ player: number | null; until: number }>({ player: null, until: 0 });
  const botCooldownUntilRef = useRef<number>(0);
  const botRetryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [botTick, setBotTick] = useState(0);
  const [botDebugInfo, setBotDebugInfo] = useState<BotDebugInfo>({
    status: 'init',
    details: 'Bot debug gestart',
    isBotTurn: false,
    currentPlayer: 0,
    controllerPosition: null,
    turnKey: '-',
    legalMoves: 0,
    boneyardSize: 0,
    updatedAt: Date.now(),
  });
  
  // Hard slam functionality
  const { disarmHardSlam, settings, isAnimating } = useGameVisualSettings();
  const { settings: appSettings } = useAppSettings();
  const { isAdmin } = useUserRoles();
  const adminBoneyardFaceUp = isAdmin && Boolean(appSettings?.admin_boneyard_face_up);
  const { calculateBestMove } = useBotAI();
  const botBlockAggression = useMemo(() => {
    const raw = Number(appSettings?.bot_block_aggression ?? 65);
    if (!Number.isFinite(raw)) return 65;
    return Math.max(0, Math.min(100, Math.round(raw)));
  }, [appSettings]);
  const botMaxActionMs = useMemo(() => {
    const raw = Number(appSettings?.bot_max_action_ms ?? 1500);
    if (!Number.isFinite(raw)) return 1500;
    return Math.max(300, Math.min(10000, Math.round(raw)));
  }, [appSettings]);
  const scheduleBotRetry = useCallback((delayMs: number) => {
    const clamped = Math.max(60, Math.min(3000, delayMs));
    if (botRetryTimerRef.current) clearTimeout(botRetryTimerRef.current);
    botRetryTimerRef.current = setTimeout(() => {
      botRetryTimerRef.current = null;
      setBotTick((t) => t + 1);
    }, clamped);
  }, []);
  const minPlacementDelayMs = useMemo(() => {
    const raw = Number(appSettings?.global_min_placement_delay_ms ?? DEFAULT_MIN_PLACEMENT_DELAY_MS);
    if (!Number.isFinite(raw)) return DEFAULT_MIN_PLACEMENT_DELAY_MS;
    return Math.max(200, Math.min(5000, Math.round(raw)));
  }, [appSettings]);
  
  // Use the existing synced game state hook
  const { syncState, updateGameState, startNewGame: syncedStartNewGame } = useSyncedDominoGameState(gameId || '', user?.id || '');
  
  // Use the domino game hook with shake animation support
  const gameHook = useDominoGame(syncState.playerPosition);
  const { gameState, setGameState } = gameHook;

  // Versie-switch (stable = backup, beta = huidige physics-experimenten).
  // Default stable, alleen admin/dev kan wisselen via GameVersionToggle.
  const { version: gameVersion, setVersion: setGameVersion } = useGameVersion();

  // Optie B: dwing de lobby-versie af. Als onze lokale versie afwijkt van
  // de centraal in de lobby ingestelde versie, opslaan + harde reload.
  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from('lobbies')
        .select('game_version')
        .eq('id', gameId)
        .maybeSingle();
      if (cancelled || error || !data) return;
      const target = ((data as any).game_version ?? 'stable') as 'stable' | 'beta';
      if (target !== gameVersion) {
        setGameVersion(target);
        setTimeout(() => window.location.reload(), 50);
      }
    })();
    return () => { cancelled = true; };
  }, [gameId, gameVersion, setGameVersion]);

  // Ref om Changa-detectie te markeren tussen pre- en post-move
  const changaRef = useRef(false);

  // === Client-side game logging (debug) ===
  // Snapshot loggen bij elke verandering van dominoes-count, beurt of wegaPhase.
  const lastSnapshotKeyRef = useRef<string>('');
  useEffect(() => {
    if (!gameId) return;
    const gs: any = syncState.gameState;
    if (!gs) return;
    const lobbyId = (syncState as any)?.gameData?.lobby_id || null;
    const dominoCount = gs.dominoes ? Object.keys(gs.dominoes).length : 0;
    const handsLengths = Array.isArray(gs.playerHands) ? gs.playerHands.map((h: any[]) => (Array.isArray(h) ? h.length : 0)) : [];
    const key = `${syncState.currentPlayer}|${dominoCount}|${gs.wegaPhase || ''}|${gs.isGameOver ? 1 : 0}|${handsLengths.join(',')}`;
    if (key === lastSnapshotKeyRef.current) return;
    lastSnapshotKeyRef.current = key;
    logGameEvent({
      gameId,
      lobbyId,
      eventType: 'state_snapshot',
      currentTurn: syncState.currentPlayer,
      wegaPhase: gs.wegaPhase || null,
      playerPosition: syncState.playerPosition,
      data: {
        domino_count: dominoCount,
        hand_sizes: handsLengths,
        boneyard: Array.isArray(gs.boneyard) ? gs.boneyard.length : 0,
        is_game_over: !!gs.isGameOver,
        wega_phase: gs.wegaPhase || null,
        last_placer_position: gs.lastPlacerPosition ?? null,
        opening_placements: gs.openingPlacements ?? null,
        consecutive_passes: gs.consecutivePasses ?? null,
      },
    });
  }, [gameId, syncState.gameState, syncState.currentPlayer, syncState.playerPosition]);

  // Tile selection loggen (alleen door lokale speler)
  useEffect(() => {
    if (!gameId) return;
    const idx = gameState?.selectedHandIndex;
    if (idx == null || idx < 0) return;
    const tile = (gameState?.playerHand || [])[idx];
    if (!tile) return;
    const lobbyId = (syncState as any)?.gameData?.lobby_id || null;
    logGameEvent({
      gameId,
      lobbyId,
      eventType: 'tile_selected',
      currentTurn: syncState.currentPlayer,
      playerPosition: syncState.playerPosition,
      wegaPhase: (syncState.gameState as any)?.wegaPhase || null,
      data: { hand_index: idx, tile },
    });
  }, [gameId, gameState?.selectedHandIndex]); // eslint-disable-line react-hooks/exhaustive-deps

  const resolvePlayerCount = useCallback(() => {
    const fromSync = syncState.allPlayers.length;
    if (fromSync > 0) return fromSync;

    const fromLocalHands = Array.isArray(gameState.playerHands) ? gameState.playerHands.length : 0;
    if (fromLocalHands > 0) return fromLocalHands;

    const remoteHands = syncState.gameState?.playerHands;
    const fromRemoteHands = Array.isArray(remoteHands) ? remoteHands.length : 0;
    if (fromRemoteHands > 0) return fromRemoteHands;

    return 0;
  }, [gameState.playerHands, syncState.allPlayers.length, syncState.gameState]);

  useEffect(() => {
    return () => {
      if (executeMoveSyncTimeoutRef.current) clearTimeout(executeMoveSyncTimeoutRef.current);
      if (drawSyncTimeoutRef.current) clearTimeout(drawSyncTimeoutRef.current);
      if (passMoveTimeoutRef.current) clearTimeout(passMoveTimeoutRef.current);
      if (hardSlamResetTimeoutRef.current) clearTimeout(hardSlamResetTimeoutRef.current);
      if (botRetryTimerRef.current) clearTimeout(botRetryTimerRef.current);
    };
  }, []);
  
  // Sync the game state when synced state changes
  useEffect(() => {
    if (syncState.gameState && !syncState.isLoading) {
      // Behoud lokale UI-state (zoals selectedHandIndex) zodat realtime updates
      // niet jouw selectie wissen tijdens je beurt (belangrijk in Wega di sen).
      setGameState((prev) => ({
        ...syncState.gameState,
        selectedHandIndex:
          prev?.selectedHandIndex !== undefined && prev?.selectedHandIndex !== null
            ? prev.selectedHandIndex
            : (syncState.gameState as any)?.selectedHandIndex ?? null,
      }));
    }
  }, [syncState.gameState, syncState.isLoading, setGameState]);

  // Removed syncLocalToRemote - now using SINGLE consolidated updates instead of double updates

  // Wrap local actions and then sync - SINGLE CONSOLIDATED UPDATE
  const wrappedExecuteMove = useCallback((move: MoveWithEffects) => {
    const now = Date.now();
    const sharedMoveCooldownUntil = Number(gameState.moveCooldownUntilMs || 0);
    if (isAnimating || now < moveAnimationLockUntilRef.current || now < sharedMoveCooldownUntil) {
      console.log('⛔ Move blocked: animation lock active');
      return;
    }

    console.log('🎬 🎯 WRAPPED EXECUTE MOVE CALLED!', move);
    const actorPosition = typeof move.actorPosition === 'number' ? move.actorPosition : syncState.currentPlayer;
    const actorUserId = syncState.allPlayers.find((player) => player.position === actorPosition)?.user_id || null;
    console.log('🎯 Acting player position:', actorPosition);
    console.log('🔥 localHardSlamActive:', move?.localHardSlamActive);
    
    // Turn validation removed - database controls turns completely now
    
    // Pre-move: detecteer CHANGA (ook bij dubbel)
    const actorHand = gameState.playerHands?.[actorPosition] || (actorPosition === syncState.playerPosition ? gameState.playerHand : []);
    const isLastStone = actorHand.length === 1;
    let isChangaCandidate = false;

    if (isLastStone && move?.dominoData) {
      const legalMovesForLastStone = gameHook.findLegalMoves(move.dominoData) || [];
      const nonForcedAnchors = new Set<string>();

      legalMovesForLastStone.forEach((candidateMove) => {
        if (candidateMove.end.forced) return;
        const anchorKey = getOpenEndAnchorKey(candidateMove.end);
        if (anchorKey) nonForcedAnchors.add(anchorKey);
      });

      // Fallback for edge cases where only forced endpoints are emitted.
      if (nonForcedAnchors.size > 0) {
        isChangaCandidate = nonForcedAnchors.size >= 2;
      } else {
        const allAnchors = new Set<string>();
        legalMovesForLastStone.forEach((candidateMove) => {
          const anchorKey = getOpenEndAnchorKey(candidateMove.end);
          if (anchorKey) allAnchors.add(anchorKey);
        });
        isChangaCandidate = allAnchors.size >= 2;
      }
    }

    changaRef.current = isChangaCandidate;

    const hardSlamDominoId = move?.localHardSlamActive ? `d${gameState.nextDominoId}` : undefined;
    const hardSlamAnimationProfile: ShakeAnimationProfile | undefined = (move?.localHardSlamActive && hardSlamDominoId)
      ? {
          eventId: `${hardSlamDominoId}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
          seed: Math.floor(Math.random() * 0x7fffffff),
          startedAtMs: Date.now(),
          intensity: settings.shakeIntensity,
          duration: settings.shakeDuration,
          rotationAmplitudeX: settings.rotationAmplitudeX,
          rotationAmplitudeY: settings.rotationAmplitudeY,
          rotationAmplitudeZ: settings.rotationAmplitudeZ,
          rotationSpeed: settings.rotationSpeed,
        }
      : undefined;

    if (move?.localHardSlamActive && hardSlamDominoId) {
      // Arm hard slam BEFORE move execution so executeMove can apply the effect on this move.
      setGameState((currentState) => ({
        ...currentState,
        hardSlamNextMove: true,
        isHardSlamming: true,
        hardSlamDominoId,
        triggerHardSlamAnimation: true,
        hardSlamAnimationProfile,
        hardSlamActorUserId: actorUserId,
      }));
    }

    // Execute the move locally
    const nextPlacementAllowedAt = Date.now() + minPlacementDelayMs;
    gameHook.executeMove({ ...move, actorPosition });
    // Log placement to game_logs so we can debug after the fact (classic mode)
    try {
      const lobbyIdForLog = (syncState as any)?.gameData?.lobby_id || null;
      if (gameId) {
        logGameEvent({
          gameId,
          lobbyId: lobbyIdForLog,
          eventType: 'tile_placed',
          currentTurn: syncState.currentPlayer,
          playerPosition: actorPosition,
          wegaPhase: (syncState.gameState as any)?.wegaPhase || null,
          data: {
            tile: move?.dominoData,
            x: (move as any)?.x,
            y: (move as any)?.y,
            orientation: move?.orientation,
            flipped: (move as any)?.flipped,
            from_dir: (move as any)?.end?.fromDir,
            end_value: (move as any)?.end?.value,
            actor_position: actorPosition,
            actor_user_id: actorUserId,
            hard_slam: !!move?.localHardSlamActive,
            hand_index: (move as any)?.index,
          },
        });
      }
    } catch (e) {
      console.debug('[gameLog] tile_placed log failed', e);
    }
    // Enforce a minimum spacing between placements so hand animations can complete.
    moveAnimationLockUntilRef.current = nextPlacementAllowedAt;

    // Calculate next player turn using the actual acting player (human or bot).
    const playerCount = resolvePlayerCount();
    const nextPlayerTurn = playerCount > 0
      ? (actorPosition + 1) % playerCount
      : syncState.currentPlayer;
    console.log('🎯 Advancing turn from', actorPosition, 'to', nextPlayerTurn);

    // SINGLE CONSOLIDATED DATABASE UPDATE - capture fresh state
    if (executeMoveSyncTimeoutRef.current) {
      clearTimeout(executeMoveSyncTimeoutRef.current);
    }

    executeMoveSyncTimeoutRef.current = setTimeout(() => {
      executeMoveSyncTimeoutRef.current = null;
      setGameState(currentState => {
        console.log('🔄 SINGLE CONSOLIDATED UPDATE - capturing fresh state');
        
        // Prepare consolidated state with turn advancement
        const myPos = syncState.playerPosition || 0;
        let finalState: PersistedGameState = {
          ...buildConsolidatedState(syncState.gameState, currentState, myPos, actorPosition),
          // Reset hard slam game logic after domino placement
          isHardSlamming: false,
          triggerHardSlamAnimation: Boolean(move?.localHardSlamActive),
          hardSlamDominoId: move?.localHardSlamActive ? hardSlamDominoId : currentState.hardSlamDominoId,
          hardSlamAnimationProfile: move?.localHardSlamActive ? hardSlamAnimationProfile : currentState.hardSlamAnimationProfile,
          hardSlamActorUserId: move?.localHardSlamActive ? actorUserId : currentState.hardSlamActorUserId,
          lastMoveActorUserId: actorUserId,
          moveCooldownUntilMs: nextPlacementAllowedAt,
        };

        // Check for CHANGA and update state accordingly
        if (changaRef.current) {
          finalState = {
            ...finalState,
            isGameOver: true,
            gameEndReason: 'changa',
            winner_position: actorPosition
          };
          const winnerLabel = actorPosition === syncState.playerPosition
            ? 'Je hebt gewonnen met CHANGA!'
            : `${syncState.allPlayers[actorPosition]?.username || 'Een speler'} won met CHANGA!`;
          toast({ title: 'CHANGA!', description: winnerLabel });
          changaRef.current = false;
        }

        // SINGLE database update with consolidated state AND turn advancement
        updateGameState(finalState, nextPlayerTurn);
        
        return currentState; // Return current state to avoid double setting
      });
    }, 150); // Slightly longer delay for better state consistency
  }, [gameHook, gameState, isAnimating, minPlacementDelayMs, resolvePlayerCount, setGameState, settings.rotationAmplitudeX, settings.rotationAmplitudeY, settings.rotationAmplitudeZ, settings.rotationSpeed, settings.shakeDuration, settings.shakeIntensity, syncState.allPlayers, syncState.allPlayers.length, syncState.currentPlayer, syncState.gameState, syncState.playerPosition, toast, updateGameState]);

  const wrappedDrawFromBoneyard = useCallback(async (actorPosition?: number) => {
    console.log('🎲 Draw from boneyard - turn validation removed, database controls turns');
    const wegaPhase = (syncState.gameState as any)?.wegaPhase;
    if (wegaPhase === 'playing' || wegaPhase === 'ended') {
      toast({ title: 'Boneyard gesloten', description: 'In Wega di sen kun je geen extra stenen meer trekken.', variant: 'destructive' });
      return;
    }
    const actingPosition = typeof actorPosition === 'number' ? actorPosition : syncState.currentPlayer;

    // Execute draw locally - database will validate turn
    gameHook.drawFromBoneyard(actingPosition);
    
    // Keep current turn after drawing from boneyard
    if (drawSyncTimeoutRef.current) {
      clearTimeout(drawSyncTimeoutRef.current);
    }

    drawSyncTimeoutRef.current = setTimeout(() => {
      drawSyncTimeoutRef.current = null;
      setGameState(currentState => {
        console.log('🔄 Drawing with MANDATORY turn advancement');
        
        // Prepare consolidated state
        const myPos = syncState.playerPosition || 0;
        const finalState = buildConsolidatedState(syncState.gameState, currentState, myPos, actingPosition);

        // NO turn advancement for boneyard draw - player stays on turn
        console.log('🎯 DRAW - No turn advancement, player stays on turn:', syncState.currentPlayer);

        // Keep current player on turn (no advancement)
        updateGameState(finalState, syncState.currentPlayer);
        
        return currentState;
      });
    }, 150);
  }, [gameHook, setGameState, syncState.currentPlayer, syncState.gameState, syncState.playerPosition, updateGameState]);

  const wrappedDrawSpecificFromBoneyard = useCallback(async (index: number, actorPosition?: number) => {
    console.log('🎲 Draw specific from boneyard - turn validation removed, database controls turns');
    const wegaPhase = (syncState.gameState as any)?.wegaPhase;
    if (wegaPhase === 'playing' || wegaPhase === 'ended') {
      toast({ title: 'Boneyard gesloten', description: 'In Wega di sen kun je geen extra stenen meer trekken.', variant: 'destructive' });
      return;
    }
    const actingPosition = typeof actorPosition === 'number' ? actorPosition : syncState.currentPlayer;

    // Execute draw locally - database will validate turn
    gameHook.drawSpecificFromBoneyard(index, actingPosition);

    // Keep current turn after drawing from boneyard
    if (drawSyncTimeoutRef.current) {
      clearTimeout(drawSyncTimeoutRef.current);
    }

    drawSyncTimeoutRef.current = setTimeout(() => {
      drawSyncTimeoutRef.current = null;
      setGameState(currentState => {
        const myPos = syncState.playerPosition || 0;
        const finalState = buildConsolidatedState(syncState.gameState, currentState, myPos, actingPosition);

        // NO turn advancement for boneyard draw - player stays on turn
        updateGameState(finalState, syncState.currentPlayer);
        return currentState;
      });
    }, 150);
  }, [gameHook, setGameState, syncState.currentPlayer, syncState.gameState, syncState.playerPosition, updateGameState]);

  const wrappedStartNewGame = useCallback(async () => {
    // Reset opslagvlag voor scorebord zodat nieuwe uitslag later kan worden opgeslagen
    savedRef.current = false;

    // Reset alle shake states bij nieuw spel
    if (disarmHardSlam) {
      disarmHardSlam();
    }

    const blank: GameState = {
      dominoes: {},
      board: {},
      playerHand: [],
      playerHands: [],
      boneyard: [],
      openEnds: [],
      forbiddens: {},
      nextDominoId: 0,
      spinnerId: null,
      isGameOver: false,
      selectedHandIndex: null,
      hardSlamActorUserId: null,
      lastMoveActorUserId: null,
      moveCooldownUntilMs: 0,
    };
    // Optimistische reset van UI
    setGameState(blank);
    // Start nieuw spel in backend en gebruik de teruggegeven state voor directe UI update
    const newState = await syncedStartNewGame();
    if (newState) {
      setGameState(newState);
    }
  }, [disarmHardSlam, setGameState, syncedStartNewGame]);

  const wrappedFixTableStones = useCallback((rotation?: FixTableLayoutRotation) => {
    if (!gameState || gameState.isGameOver) return null;

    const dominoCount = Object.keys(gameState.dominoes || {}).length;
    if (dominoCount < 2) return null;

    if (syncState.currentPlayer !== syncState.playerPosition) {
      toast({
        title: 'Niet jouw beurt',
        description: 'Je kunt stenen alleen fixen in je eigen beurt.',
      });
      return null;
    }

    const now = Date.now();
    if (isAnimating || now < moveAnimationLockUntilRef.current) {
      toast({
        title: 'Animatie actief',
        description: 'Wacht tot de animatie klaar is en probeer opnieuw.',
      });
      return null;
    }

    const chosenRotation =
      rotation ?? FIX_TABLE_LAYOUT_SEQUENCE[nextFixLayoutIndexRef.current % FIX_TABLE_LAYOUT_SEQUENCE.length];
    if (!rotation) {
      nextFixLayoutIndexRef.current =
        (nextFixLayoutIndexRef.current + 1) % FIX_TABLE_LAYOUT_SEQUENCE.length;
    }

    const relaidState = relayoutTableState(gameState, chosenRotation, gameHook.regenerateOpenEnds);
    if (!relaidState) {
      toast({
        title: 'Fix mislukt',
        description: 'Kon geen geldige L-layout maken met deze rotatie.',
        variant: 'destructive',
      });
      return null;
    }

    setGameState(relaidState);
    const myPos = syncState.playerPosition || 0;
    const consolidatedState = buildConsolidatedState(syncState.gameState, relaidState, myPos);
    updateGameState(consolidatedState, syncState.currentPlayer);
    moveAnimationLockUntilRef.current = Date.now() + 320;

    toast({
      title: 'Stenen gefixt',
      description: `Vorm: ${getFixLayoutLabel(chosenRotation)}`,
    });
    return chosenRotation;
  }, [
    gameHook.regenerateOpenEnds,
    gameState,
    isAnimating,
    setGameState,
    syncState.currentPlayer,
    syncState.gameState,
    syncState.playerPosition,
    toast,
    updateGameState,
  ]);

  const tryFinalizeBlockedGame = useCallback((state: GameState | null): boolean => {
    if (!state || state.isGameOver || state.gameEndReason === 'changa') return false;
    if (!state.board || Object.keys(state.board).length === 0) return false;

    const finalizeBlockedGame = (reason: string, allHandsForScoring: DominoData[][]): boolean => {
      const playerPoints = allHandsForScoring.map((hand) =>
        hand.reduce((sum, domino) => sum + domino.value1 + domino.value2, 0)
      );
      const minPoints = playerPoints.length > 0 ? Math.min(...playerPoints) : 0;
      const winnerPosition = playerPoints.findIndex((points) => points === minPoints);
      const resolvedWinner = winnerPosition >= 0 ? winnerPosition : 0;

      const blockedState: GameState = {
        ...state,
        isGameOver: true,
        winner_position: resolvedWinner,
        gameEndReason: 'blocked',
      };

      setGameState(blockedState);
      updateGameState(blockedState as PersistedGameState, syncState.currentPlayer);
      console.log('🧱 GAME BLOCKED auto-triggered.', {
        reason,
        winner: resolvedWinner,
        points: playerPoints,
        boneyardSize: state.boneyard?.length || 0,
      });
      return true;
    };

    const resolvedPlayerCount =
      (syncState.allPlayers?.length && syncState.allPlayers.length > 0)
        ? syncState.allPlayers.length
        : (Array.isArray(state.playerHands) && state.playerHands.length > 0 ? state.playerHands.length : resolvePlayerCount());
    const allHands: DominoData[][] =
      resolvedPlayerCount > 0
        ? Array.from({ length: resolvedPlayerCount }, (_, index) => {
            if (Array.isArray(state.playerHands?.[index])) return state.playerHands[index];
            if (index === syncState.playerPosition) return state.playerHand || [];
            return [];
          })
        : (state.playerHands || [state.playerHand || []]);

    // If anyone has already emptied their hand, this is not a blocked endgame.
    if (allHands.some((hand) => hand.length === 0)) return false;

    // In Wega di sen "playing" fase: gebruik een pip-gebaseerde check op alle lege buurcellen
    // van bezette cellen. Voorkomt dat strikte forbiddens/neighbor-regels ten onrechte een
    // blokkade triggeren terwijl er nog speelbare zetten zijn.
    const wegaPhaseNow = (syncState.gameState as any)?.wegaPhase;
    if (wegaPhaseNow === 'playing') {
      // Echte legaliteits-check: kunnen we ergens daadwerkelijk plaatsen?
      const anyLegal = allHands.some((hand) =>
        hand.some((domino) => gameHook.findLegalMoves(domino).length > 0)
      );
      if (anyLegal) return false;
      return finalizeBlockedGame('wega-no-pip-match', allHands);
    }

    // Use stored openEnds when present so blocked debug and blocked engine are consistent.
    // Fallback to regenerated open ends only when state has none.
    const currentOpenEnds =
      Array.isArray(state.openEnds) && state.openEnds.length > 0
        ? state.openEnds
        : gameHook.regenerateOpenEnds(state);
    const uniqueRequiredValues = new Set(currentOpenEnds.map((end) => end.value));
    const singleRequiredValue = uniqueRequiredValues.size === 1 ? Array.from(uniqueRequiredValues)[0] : null;

    // Explicit fast-path for your rule:
    // if open ends are effectively both X and all 7 X-tiles are already on table -> blocked.
    if (singleRequiredValue !== null && currentOpenEnds.length >= 2) {
      const boardTilesWithValueX = Object.values(state.dominoes || {}).filter(
        (domino) => domino.data.value1 === singleRequiredValue || domino.data.value2 === singleRequiredValue
      ).length;
      // Extra safety: ook nagaan dat er écht geen tile met deze waarde meer in hand of boneyard zit.
      const handHasValueX = allHands.some((hand) =>
        hand.some((d) => d.value1 === singleRequiredValue || d.value2 === singleRequiredValue)
      );
      const boneyardHasValueX = (state.boneyard || []).some(
        (d) => d && (d.value1 === singleRequiredValue || d.value2 === singleRequiredValue)
      );
      if (boardTilesWithValueX >= 7 && !handHasValueX && !boneyardHasValueX) {
        return finalizeBlockedGame(`seven-x-rule:${singleRequiredValue}`, allHands);
      }
    }

    const handPlayableTileCounts = allHands.map((hand) =>
      hand.reduce((count, domino) => count + (gameHook.findLegalMoves(domino).length > 0 ? 1 : 0), 0)
    );
    const somePlayerCanPlay = handPlayableTileCounts.some((count) => count > 0);

    // Ook als de boneyard nog stenen heeft, kan het spel al effectief geblokkeerd zijn
    // wanneer GEEN enkele boneyard-steen een legale zet oplevert op dit bord.
    const boneyardPlayableTileCount = (state.boneyard || []).reduce(
      (count, domino) => count + (domino && gameHook.findLegalMoves(domino).length > 0 ? 1 : 0),
      0
    );
    // Extra vangnet: vergelijk open-end-waardes met alle resterende pip-waardes in hand+boneyard.
    // Als er nog een match is op pip-niveau, is het spel zeker niet geblokkeerd (forbiddens/neighbor
    // checks zouden anders ten onrechte een blokkade kunnen triggeren).
    const openEndValues = new Set(currentOpenEnds.map((e) => e.value));
    const remainingPipMatch =
      allHands.some((hand) =>
        hand.some((d) => openEndValues.has(d.value1) || openEndValues.has(d.value2))
      ) ||
      (state.boneyard || []).some(
        (d) => d && (openEndValues.has(d.value1) || openEndValues.has(d.value2))
      );
    const blockedByNoMoves = !somePlayerCanPlay && boneyardPlayableTileCount === 0 && !remainingPipMatch;

    if (!blockedByNoMoves) {
      console.log('🧪 Not blocked yet:', {
        handPlayableTileCounts,
        boneyardPlayableTileCount,
        remainingPipMatch,
        singleRequiredValue,
        openEndsCount: currentOpenEnds.length,
      });
      return false;
    }

    return finalizeBlockedGame('no-legal-moves', allHands);
  }, [gameHook, resolvePlayerCount, setGameState, syncState.currentPlayer, syncState.playerPosition, syncState.gameState, updateGameState]);

  // Auto-check for blocked game after each move
  useEffect(() => {
    if (!gameState || gameState.isGameOver) return;
    const timeoutId = setTimeout(() => {
      tryFinalizeBlockedGame(gameState);
    }, 100);
    return () => clearTimeout(timeoutId);
  }, [gameState, tryFinalizeBlockedGame]);

  // Function to manually trigger blocked game check
  const manualBlockedCheck = useCallback(() => {
    if (!gameState) return;
    const wasBlocked = tryFinalizeBlockedGame(gameState);
    if (!wasBlocked) {
      console.log('✅ Manual blocked check: game is NOT blocked');
      toast({
        title: 'Niet geblokkeerd',
        description: 'Er is nog minimaal 1 legale zet mogelijk (in hand of boneyard).',
      });
    }
  }, [gameState, toast, tryFinalizeBlockedGame]);

  // Pass move function
  const passMove = useCallback((actorPosition?: number) => {
    const actingPosition = typeof actorPosition === 'number' ? actorPosition : syncState.currentPlayer;
    const playerCount = resolvePlayerCount();

    // Advance to next player turn after pass based on the acting player (human or bot).
    const nextPlayerTurn = playerCount > 0
      ? (actingPosition + 1) % playerCount
      : syncState.currentPlayer;
    console.log('🎯 Pass move - advancing turn from', actingPosition, 'to', nextPlayerTurn);
    
    // Pass doesn't change game state, just advances turn
    if (passMoveTimeoutRef.current) {
      clearTimeout(passMoveTimeoutRef.current);
    }

    passMoveTimeoutRef.current = setTimeout(() => {
      passMoveTimeoutRef.current = null;
      // EXTRA VALIDATION: Double-check turn ownership before database update
      if (syncState.currentPlayer !== actingPosition) {
        console.log('🚫 PASS MOVE BLOCKED: Turn changed during timeout, aborting database update');
        console.log('Expected player:', actingPosition, 'Current player:', syncState.currentPlayer);
        return;
      }
      
      console.log('🔄 PASS MOVE - Advancing turn only');
      console.log('✅ PASS MOVE VALIDATED: Player', actingPosition, 'confirmed as current player');
      // Only update the turn, no game state changes needed for pass
      if (syncState.gameData) {
        updateGameState(syncState.gameState, nextPlayerTurn);
      }
    }, 150);
  }, [resolvePlayerCount, syncState.currentPlayer, syncState.gameData, syncState.gameState, updateGameState]);

  const getBotDifficulty = useCallback((botName: string): 'easy' | 'medium' | 'hard' => {
    if (botName.includes('Dave') || botName.includes('Betty')) return 'easy';
    if (botName.includes('Raja') || botName.includes('Sam')) return 'hard';
    return 'medium';
  }, []);

  const botControllerPosition = useMemo(() => {
    const humanPositions = syncState.allPlayers
      .filter((player) => !player.is_bot)
      .map((player) => player.position)
      .sort((a, b) => a - b);
    return humanPositions.length > 0 ? humanPositions[0] : null;
  }, [syncState.allPlayers]);

  // One deterministic human client drives bot turns (single authority to avoid duplicate bot moves).
  useEffect(() => {
    const now = Date.now();

    // Skip classic bot loop entirely for Wega di sen games — handled by Wega bot orchestrator below.
    const _wegaActive = (syncState.gameState as any)?.gameMode === 'wega_di_sen' || !!(syncState.gameState as any)?.wegaPhase;
    if (_wegaActive) {
      return;
    }

    if (gameState.isGameOver || !syncState.allPlayers.length) {
      setBotDebugInfo((prev) => ({
        ...prev,
        status: 'idle',
        details: gameState.isGameOver ? 'Game over' : 'Geen spelers',
        isBotTurn: false,
        currentPlayer: syncState.currentPlayer,
        controllerPosition: botControllerPosition,
        turnKey: '-',
        legalMoves: 0,
        boneyardSize: gameState.boneyard.length,
        updatedAt: Date.now(),
      }));
      return;
    }

    // Release "await turn advance" lock as soon as turn changed.
    if (
      botAwaitingTurnAdvanceRef.current.player !== null &&
      syncState.currentPlayer !== botAwaitingTurnAdvanceRef.current.player
    ) {
      botAwaitingTurnAdvanceRef.current = { player: null, until: 0 };
    }

    const currentPlayerData = syncState.allPlayers.find((player) => player.position === syncState.currentPlayer);
    if (!currentPlayerData?.is_bot) {
      botTurnExecutionRef.current = null;
      setBotDebugInfo((prev) => ({
        ...prev,
        status: 'waiting-human',
        details: `Beurt van ${currentPlayerData?.username || 'speler'}`,
        isBotTurn: false,
        currentPlayer: syncState.currentPlayer,
        controllerPosition: botControllerPosition,
        turnKey: '-',
        legalMoves: 0,
        boneyardSize: gameState.boneyard.length,
        updatedAt: Date.now(),
      }));
      return;
    }

    const hardSlamProfile = gameState.hardSlamAnimationProfile;
    const hasUsableHardSlamProfile = Boolean(
      hardSlamProfile &&
      Number.isFinite(hardSlamProfile.startedAtMs) &&
      Number.isFinite(hardSlamProfile.duration)
    );
    const hardSlamDurationMs = hasUsableHardSlamProfile ? Math.max(0, hardSlamProfile!.duration * 1000) : 0;
    const hardSlamEndMs = hasUsableHardSlamProfile ? hardSlamProfile!.startedAtMs + hardSlamDurationMs + 120 : 0;
    const hardSlamFlagsActive = Boolean(gameState.triggerHardSlamAnimation) || Boolean(gameState.isHardSlamming);
    const sharedMoveCooldownUntil = Number(gameState.moveCooldownUntilMs || 0);
    // Prevent stale DB flags from locking bots forever once the profile window has ended.
    const hardSlamAnimatingNow = hasUsableHardSlamProfile ? now < hardSlamEndMs : hardSlamFlagsActive;
    const anyAnimationLockActive =
      hardSlamAnimatingNow ||
      isAnimating ||
      now < moveAnimationLockUntilRef.current ||
      now < sharedMoveCooldownUntil;

    if (anyAnimationLockActive) {
      const remainingLocalLock = Math.max(0, moveAnimationLockUntilRef.current - now);
      const remainingHardSlam = Math.max(0, hardSlamEndMs - now);
      const remainingSharedLock = Math.max(0, sharedMoveCooldownUntil - now);
      const remainingMs = Math.max(remainingHardSlam, remainingLocalLock, remainingSharedLock);
      scheduleBotRetry(remainingMs + 40);
      setBotDebugInfo((prev) => ({
        ...prev,
        status: 'waiting-animation',
        details: `Wachten op animatie-lock (${remainingMs}ms)`,
        isBotTurn: true,
        currentPlayer: syncState.currentPlayer,
        controllerPosition: botControllerPosition,
        turnKey: `${syncState.currentPlayer}:${gameState.nextDominoId}`,
        boneyardSize: gameState.boneyard.length,
        updatedAt: Date.now(),
      }));
      return;
    }

    const localPlayerData = syncState.allPlayers.find((player) => player.position === syncState.playerPosition);
    if (localPlayerData?.is_bot) {
      setBotDebugInfo((prev) => ({
        ...prev,
        status: 'blocked',
        details: 'Lokale client is bot; geen botsturing',
        isBotTurn: true,
        currentPlayer: syncState.currentPlayer,
        controllerPosition: botControllerPosition,
        turnKey: '-',
        legalMoves: 0,
        boneyardSize: gameState.boneyard.length,
        updatedAt: Date.now(),
      }));
      return;
    }

    const actorPosition = syncState.currentPlayer;
    const turnIdentity = `${actorPosition}:${gameState.nextDominoId}`;
    if (!botTurnObservedAtRef.current[turnIdentity]) {
      botTurnObservedAtRef.current[turnIdentity] = Date.now();
    }
    const turnAgeMs = Date.now() - botTurnObservedAtRef.current[turnIdentity];
    const isDesignatedController = botControllerPosition !== null && syncState.playerPosition === botControllerPosition;

    // Fallback takeover: if designated controller did nothing, any human can execute after delay.
    const fallbackWaitMs = Math.min(1800, Math.max(400, botMaxActionMs + 200));
    if (!isDesignatedController && turnAgeMs < fallbackWaitMs) {
      scheduleBotRetry(fallbackWaitMs - turnAgeMs + 40);
      setBotDebugInfo((prev) => ({
        ...prev,
        status: 'waiting-controller',
        details: `Wachten op controller (${turnAgeMs}ms)`,
        isBotTurn: true,
        currentPlayer: syncState.currentPlayer,
        controllerPosition: botControllerPosition,
        turnKey: turnIdentity,
        legalMoves: 0,
        boneyardSize: gameState.boneyard.length,
        updatedAt: Date.now(),
      }));
      return;
    }

    if (
      botAwaitingTurnAdvanceRef.current.player === actorPosition &&
      now < botAwaitingTurnAdvanceRef.current.until
    ) {
      scheduleBotRetry(botAwaitingTurnAdvanceRef.current.until - now + 40);
      setBotDebugInfo((prev) => ({
        ...prev,
        status: 'awaiting-turn-advance',
        details: `Wachten op turn switch (${botAwaitingTurnAdvanceRef.current.until - now}ms)`,
        isBotTurn: true,
        currentPlayer: syncState.currentPlayer,
        controllerPosition: botControllerPosition,
        turnKey: turnIdentity,
        boneyardSize: gameState.boneyard.length,
        updatedAt: Date.now(),
      }));
      return;
    }

    if (now < botCooldownUntilRef.current) {
      scheduleBotRetry(botCooldownUntilRef.current - now + 40);
      setBotDebugInfo((prev) => ({
        ...prev,
        status: 'cooldown',
        details: `Bot cooldown (${botCooldownUntilRef.current - now}ms)`,
        isBotTurn: true,
        currentPlayer: syncState.currentPlayer,
        controllerPosition: botControllerPosition,
        turnKey: turnIdentity,
        boneyardSize: gameState.boneyard.length,
        updatedAt: Date.now(),
      }));
      return;
    }

    const botHand = gameState.playerHands?.[actorPosition] || [];
    const botTurnKey = `${actorPosition}:${gameState.nextDominoId}:${botHand.length}:${gameState.boneyard.length}`;
    if (botTurnExecutionRef.current === botTurnKey) {
      setBotDebugInfo((prev) => ({
        ...prev,
        status: 'locked',
        details: 'Bot turn lock actief',
        isBotTurn: true,
        currentPlayer: syncState.currentPlayer,
        controllerPosition: botControllerPosition,
        turnKey: botTurnKey,
        legalMoves: prev.legalMoves,
        boneyardSize: gameState.boneyard.length,
        updatedAt: Date.now(),
      }));
      return;
    }

    botTurnExecutionRef.current = botTurnKey;
    setBotDebugInfo((prev) => ({
      ...prev,
      status: isDesignatedController ? 'controller' : 'fallback-controller',
      details: `Bot ${currentPlayerData.username} verwerken`,
      isBotTurn: true,
      currentPlayer: syncState.currentPlayer,
      controllerPosition: botControllerPosition,
      turnKey: botTurnKey,
      legalMoves: 0,
      boneyardSize: gameState.boneyard.length,
      updatedAt: Date.now(),
    }));

    console.log('[classicBot] turn detected', {
      pos: actorPosition,
      bot: currentPlayerData.username,
      handSize: (gameState.playerHands?.[actorPosition] || []).length,
      boardSize: Object.keys(gameState.board || {}).length,
      boneyard: gameState.boneyard.length,
      nextDominoId: gameState.nextDominoId,
      controllerPos: botControllerPosition,
      isController: isDesignatedController,
    });

    const runBotTurn = async () => {
      const latestBotHand = gameState.playerHands?.[actorPosition] || [];
      let legalMovesForBot: MoveWithEffects[] = [];

      latestBotHand.forEach((domino, index) => {
        const moves = gameHook.findLegalMoves(domino);
        if (moves.length === 0) return;

        legalMovesForBot = legalMovesForBot.concat(
          moves.map((move) => ({ ...move, index, actorPosition }))
        );
      });

      console.log('[classicBot] runBotTurn', {
        pos: actorPosition,
        hand: latestBotHand.map((d, i) => `${i}:${d.value1}-${d.value2}`),
        handSize: latestBotHand.length,
        legalMovesCount: legalMovesForBot.length,
        boneyard: gameState.boneyard.length,
        openEnds: (gameState.openEnds || []).length,
      });

      try {
        const thinkDelay = Math.max(80, Math.min(350, botMaxActionMs - 250));
        await new Promise((resolve) => setTimeout(resolve, thinkDelay));
        if (botTurnExecutionRef.current !== botTurnKey) return;

        const boneyardSize = gameState.boneyard.length;
        const difficulty = getBotDifficulty(currentPlayerData.username);
        const boardValueTileCounts = Array.from({ length: 7 }, () => 0);
        Object.values(gameState.dominoes || {}).forEach((domino) => {
          const v1 = Math.max(0, Math.min(6, domino.data.value1));
          const v2 = Math.max(0, Math.min(6, domino.data.value2));
          if (v1 === v2) {
            boardValueTileCounts[v1] += 1;
          } else {
            boardValueTileCounts[v1] += 1;
            boardValueTileCounts[v2] += 1;
          }
        });
        const currentOpenValues = Array.from(
          new Set((gameState.openEnds || []).map((end) => end.value).filter((value) => Number.isFinite(value)))
        );
        const botBlockAggression = (() => {
          const raw = Number(appSettings?.bot_block_aggression ?? 65);
          if (!Number.isFinite(raw)) return 65;
          return Math.max(0, Math.min(100, Math.round(raw)));
        })();

        const selectedMove = calculateBestMove(
          latestBotHand,
          legalMovesForBot,
          { difficulty, thinkingTime: 0 },
          {
            currentOpenValues,
            boardValueTileCounts,
            blockAggression: botBlockAggression,
          }
        );

        setBotDebugInfo((prev) => ({
          ...prev,
          status: 'deciding',
          details: selectedMove ? 'Bot kiest zet' : boneyardSize > 0 ? 'Bot trekt uit boneyard' : 'Bot past',
          isBotTurn: true,
          currentPlayer: syncState.currentPlayer,
          controllerPosition: botControllerPosition,
          turnKey: botTurnKey,
          legalMoves: legalMovesForBot.length,
          boneyardSize,
          updatedAt: Date.now(),
        }));

        if (selectedMove) {
          console.log('[classicBot] PLAY', {
            pos: actorPosition,
            index: selectedMove.index,
            tile: `${selectedMove.dominoData.value1}-${selectedMove.dominoData.value2}`,
            at: `${selectedMove.x},${selectedMove.y}`,
            orient: selectedMove.orientation,
            flipped: selectedMove.flipped,
          });
          const cd = Math.min(900, Math.max(150, botMaxActionMs - 200));
          const adv = Math.min(2600, Math.max(600, botMaxActionMs * 2));
          botCooldownUntilRef.current = Date.now() + cd;
          botAwaitingTurnAdvanceRef.current = { player: actorPosition, until: Date.now() + adv };
          botTurnExecutionRef.current = null;

          wrappedExecuteMove({ ...selectedMove, actorPosition });
          return;
        }

        if (boneyardSize > 0) {
          console.log('[classicBot] DRAW', { pos: actorPosition, boneyardSize });
          const cd = Math.min(900, Math.max(150, botMaxActionMs - 200));
          botCooldownUntilRef.current = Date.now() + cd;
          botTurnExecutionRef.current = null;
          void wrappedDrawFromBoneyard(actorPosition);
          return;
        }

        console.log('[classicBot] PASS', {
          pos: actorPosition,
          handSize: latestBotHand.length,
          legalMoves: legalMovesForBot.length,
        });
        const cd2 = Math.min(900, Math.max(150, botMaxActionMs - 200));
        const adv2 = Math.min(2600, Math.max(600, botMaxActionMs * 2));
        botCooldownUntilRef.current = Date.now() + cd2;
        botAwaitingTurnAdvanceRef.current = { player: actorPosition, until: Date.now() + adv2 };
        botTurnExecutionRef.current = null;
        passMove(actorPosition);
      } catch (error) {
        console.error('❌ Bot move execution failed:', error);
        botTurnExecutionRef.current = null;
        botCooldownUntilRef.current = Date.now() + 700;
        setBotDebugInfo((prev) => ({
          ...prev,
          status: 'error',
          details: error instanceof Error ? error.message : 'Onbekende botfout',
          isBotTurn: true,
          currentPlayer: syncState.currentPlayer,
          controllerPosition: botControllerPosition,
          turnKey: botTurnKey,
          updatedAt: Date.now(),
        }));
      }
    };

    void runBotTurn();
  }, [
    appSettings?.bot_block_aggression,
    botMaxActionMs,
    botTick,
    scheduleBotRetry,
    gameHook,
    gameState,
    isAnimating,
    calculateBestMove,
    getBotDifficulty,
    passMove,
    syncState.allPlayers,
    botControllerPosition,
    syncState.currentPlayer,
    syncState.playerPosition,
    wrappedDrawFromBoneyard,
    wrappedExecuteMove,
  ]);

  // Sla automatisch de uitslag op naar het scoreboard zodra het spel eindigt
  useEffect(() => {
    if (!gameState?.isGameOver || !syncState?.gameData || savedRef.current) return;

    savedRef.current = true;

    (async () => {
      try {
        // Zorg dat er een actief seizoen bestaat (maak er één aan indien nodig en toegestaan)
        const { data: season, error: seasonErr } = await supabase
          .from('seasons')
          .select('id')
          .eq('is_active', true)
          .maybeSingle();

        if (!season && !seasonErr) {
          const defaultName = `Seizoen ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
          const { error: createSeasonErr } = await supabase.rpc('start_new_season', { _name: defaultName });
          if (createSeasonErr) {
            console.warn('start_new_season failed (non-blocking):', createSeasonErr);
          }
        }

        const hands = gameState.playerHands || [];
        const winnerPos = gameState.winner_position !== undefined
          ? gameState.winner_position
          : hands.findIndex(h => Array.isArray(h) && h.length === 0);

        const winnerUserId = winnerPos >= 0
          ? (syncState.allPlayers[winnerPos]?.user_id ?? null)
          : null;

        const wonByChanga = gameState.gameEndReason === 'changa';

        const players: GameOutcomePlayerPayload[] = syncState.allPlayers.flatMap((p, index) => {
          if (!p.user_id) return []; // sla bots of onbekenden over

          const hand = hands[index] || [];
          const pips_remaining = hand.reduce((sum, d) => sum + d.value1 + d.value2, 0);
          return [{
            user_id: p.user_id,
            player_position: index,
            points_scored: 0,
            pips_remaining,
            won: index === winnerPos,
            hard_slams_used: 0,
            turns_played: 0,
            won_by_changa: index === winnerPos ? wonByChanga : false,
          }];
        });

        const { error } = await supabase.rpc('record_game_outcome', {
          _game_id: syncState.gameData.id,
          _lobby_id: syncState.gameData.lobby_id,
          _winner_user_id: winnerUserId,
          _is_blocked: gameState.gameEndReason === 'blocked',
          _players: players as unknown as Json,
        });

        if (error) {
          console.error('record_game_outcome error', error);
          toast({
            title: 'Opslaan mislukt',
            description: error.message || 'Kon uitslag niet opslaan.',
            variant: 'destructive'
          });
        } else {
          toast({ 
            title: wonByChanga ? 'Uitslag: CHANGA' : 'Uitslag opgeslagen', 
            description: wonByChanga ? 'Scorebord bijgewerkt — gewonnen met CHANGA!' : 'Scorebord bijgewerkt.' 
          });
        }
      } catch (err: unknown) {
        const description = err instanceof Error ? err.message : 'Onbekende fout bij opslaan.';
        console.error('Result save flow error', err);
        toast({
          title: 'Opslaan mislukt',
          description,
          variant: 'destructive'
        });
      }
    })();
  }, [gameState?.isGameOver, gameState?.gameEndReason, gameState?.winner_position, gameState?.playerHands, syncState?.gameData, syncState.allPlayers, toast]);

  // Wrapper for hardSlam that immediately syncs to database
  const wrappedHardSlam = useCallback(async () => {
    console.log('🔥 HARD SLAM ACTIVATED - SYNCING TO DATABASE!');
    const actorUserId = syncState.allPlayers.find((player) => player.position === syncState.currentPlayer)?.user_id || null;
    const hardSlamAnimationProfile: ShakeAnimationProfile = {
      eventId: `queued-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
      seed: Math.floor(Math.random() * 0x7fffffff),
      startedAtMs: Date.now(),
      intensity: settings.shakeIntensity,
      duration: settings.shakeDuration,
      rotationAmplitudeX: settings.rotationAmplitudeX,
      rotationAmplitudeY: settings.rotationAmplitudeY,
      rotationAmplitudeZ: settings.rotationAmplitudeZ,
      rotationSpeed: settings.rotationSpeed,
    };
    
    // Construct the new state directly with hard slam flags
    const newStateWithHardSlam = {
      ...gameState,
      hardSlamNextMove: true,
      isHardSlamming: true,
      triggerHardSlamAnimation: true, // New animation flag for all players
      hardSlamAnimationProfile,
      hardSlamActorUserId: actorUserId,
    };
    
    // Update local state first
    setGameState(newStateWithHardSlam);
    
    // Then immediately sync the same state to database
    if (updateGameState) {
      try {
        // Hard slam - no turn advancement needed, keep current turn
        await updateGameState(newStateWithHardSlam, syncState.currentPlayer);
        console.log('✅ Hard Slam synced to database successfully');
        
        // Reset animation trigger after 2 seconds (allows 1.5s animation + buffer)
        if (hardSlamResetTimeoutRef.current) {
          clearTimeout(hardSlamResetTimeoutRef.current);
        }

        hardSlamResetTimeoutRef.current = setTimeout(async () => {
          hardSlamResetTimeoutRef.current = null;
          const resetState = {
            ...newStateWithHardSlam,
            triggerHardSlamAnimation: false,
          };
          await updateGameState(resetState, syncState.currentPlayer);
          console.log('🔥 Reset triggerHardSlamAnimation after 2 seconds');
        }, 2000);
        
      } catch (error) {
        console.error('❌ Failed to sync Hard Slam to database:', error);
      }
    }
  }, [
    gameState,
    settings.rotationAmplitudeX,
    settings.rotationAmplitudeY,
    settings.rotationAmplitudeZ,
    settings.rotationSpeed,
    settings.shakeDuration,
    settings.shakeIntensity,
    updateGameState,
    setGameState,
    syncState.currentPlayer,
    syncState.allPlayers,
  ]);

  // ===== Wega di sen overrides =====
  const wegaPhase = (syncState.gameState as any)?.wegaPhase as string | undefined;
  const isWegaPlay = wegaPhase === 'playing';
  const isWegaGame = ((syncState.gameState as any)?.gameMode === 'wega_di_sen') ||
    !!wegaPhase;

  // Lokale flip-state per handsteen (alleen voor Wega di sen "playing" fase)
  const [wegaFlipMap, setWegaFlipMap] = useState<Record<number, boolean>>({});
  const flipWegaTile = useCallback((index: number) => {
    if (!isWegaPlay) return;
    setWegaFlipMap((m) => ({ ...m, [index]: !m[index] }));
  }, [isWegaPlay]);
  // Reset flip-map als de hand verandert van lengte (nieuwe ronde / steen gespeeld)
  const handLen = gameState?.playerHand?.length ?? 0;
  useEffect(() => { setWegaFlipMap({}); }, [handLen, isWegaPlay]);

  // Volledig lokale selectie-state voor Wega di sen, zodat realtime sync deze
  // niet kan overschrijven (race-condities veroorzaakten 'tegel selecteert niet').
  const [wegaSelectedIndex, setWegaSelectedIndex] = useState<number | null>(null);
  const wegaSelectHandDomino = useCallback((index: number) => {
    setWegaSelectedIndex((prev) => (prev === index ? null : index));
  }, []);
  useEffect(() => { if (!isWegaPlay) setWegaSelectedIndex(null); }, [isWegaPlay]);
  // Reset selectie wanneer de hand korter wordt (na succesvolle plaatsing)
  useEffect(() => {
    if (wegaSelectedIndex !== null && wegaSelectedIndex >= handLen) {
      setWegaSelectedIndex(null);
    }
  }, [handLen, wegaSelectedIndex]);

  const wegaFindLegalMoves = useCallback((dominoData: DominoData): LegalMove[] => {
    if (!isWegaPlay) return gameHook.findLegalMoves(dominoData);
    if (!dominoData) return [];
    // Wega di sen — strict variant: klassieke regels + alleen kop/staart (tips).
    return gameHook.findLegalMoves(dominoData, { wegaTipsOnly: true });
  }, [isWegaPlay, gameHook]);

  // Wega di sen gebruikt exact dezelfde legale zetten als klassiek.
  // Alleen de hand-flip blijft Wega-specifiek voor de preview/plaatsing.
  const wegaFindLegalMovesForHuman = useCallback((dominoData: DominoData): LegalMove[] => {
    if (!isWegaPlay) return gameHook.findLegalMoves(dominoData);
    if (!dominoData) return [];
    // De hand-flip is puur visueel in de hand-weergave. Voor het bepalen van
    // legale zetten gebruiken we de klassieke regels zonder flip-restrictie,
    // zodat een geflipte steen nog steeds op alle geldige open einden mag
    // worden gelegd (anders verdwijnen targets ten onrechte).
    return gameHook.findLegalMoves(dominoData, { wegaTipsOnly: true });
  }, [isWegaPlay, gameHook]);

  // Dode oude implementatie hieronder (legacy) — vervangen door klassieke regels via gameHook.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _legacyWegaFindLegalMoves_DO_NOT_USE = useCallback((dominoData: DominoData): LegalMove[] => {
    if (!dominoData) return [];
    const board = (gameState?.board || {}) as Record<string, { dominoId: string; value: number }>;
    const boardKeys = Object.keys(board);
    const dominoesMap = (gameState?.dominoes || {}) as Record<string, { x: number; y: number; orientation: 'horizontal' | 'vertical'; data: { value1: number; value2: number } }>;
    const isDoubleTile = dominoData.value1 === dominoData.value2;
    const placementMatchesServerRules = (topX: number, topY: number, orientation: 'horizontal' | 'vertical', flipped: boolean): boolean => {
      const pip1 = flipped ? dominoData.value2 : dominoData.value1;
      const pip2 = flipped ? dominoData.value1 : dominoData.value2;
      const cells = orientation === 'horizontal'
        ? [{ x: topX, y: topY, pip: pip1 }, { x: topX + 1, y: topY, pip: pip2 }]
        : [{ x: topX, y: topY, pip: pip1 }, { x: topX, y: topY + 1, pip: pip2 }];
      let adjMatch = false;
      let adjMismatch = false;
      cells.forEach((cell, idx) => {
        const other = cells[1 - idx];
        ([[cell.x, cell.y - 1], [cell.x, cell.y + 1], [cell.x - 1, cell.y], [cell.x + 1, cell.y]] as Array<[number, number]>).forEach(([nbX, nbY]) => {
          if (nbX === other.x && nbY === other.y) return;
          const nbCell = board[`${nbX},${nbY}`];
          if (!nbCell) return;
          const isEndDir = orientation === 'horizontal' ? nbY === cell.y : nbX === cell.x;
          if (isDoubleTile) {
            if (nbCell.value === cell.pip) adjMatch = true;
            else adjMismatch = true;
          } else if (isEndDir) {
            if (nbCell.value === cell.pip) adjMatch = true;
            else adjMismatch = true;
          } else {
            adjMismatch = true;
          }
        });
      });
      return adjMatch && !adjMismatch;
    };
    // Bepaal of een cel (cx,cy) van zijn tegel een open einde is in richting `dir`.
    // Niet-dubbele stenen: alleen de twee uiteinden (langs de tegel-as) zijn open.
    // Dubbele stenen: alleen één midden-aansluiting per dwarszijde; nooit boven/onder
    // beide helften los van elkaar.
    const isOpenEndDirection = (cx: number, cy: number, dir: 'N' | 'S' | 'E' | 'W'): boolean => {
      const cellInfo = board[`${cx},${cy}`];
      if (!cellInfo) return false;
      const dom = dominoesMap[cellInfo.dominoId];
      if (!dom) return false;
      const isDoubleDom = dom.data.value1 === dom.data.value2;
      if (dom.orientation === 'horizontal') {
        const isLeft = cx === dom.x && cy === dom.y;
        const isRight = cx === dom.x + 1 && cy === dom.y;
        if (isDoubleDom) {
          return isLeft && (dir === 'N' || dir === 'S');
        }
        // Niet-dubbel, horizontaal: alleen aan de vrije uiteinde (outward + 2 dwars)
        if (isLeft) {
          if (board[`${dom.x - 1},${dom.y}`]) return false; // niet vrij
          return dir === 'W' || dir === 'N' || dir === 'S';
        }
        if (isRight) {
          if (board[`${dom.x + 2},${dom.y}`]) return false;
          return dir === 'E' || dir === 'N' || dir === 'S';
        }
        return false;
      }
      // vertical
      const isTop = cx === dom.x && cy === dom.y;
      const isBottom = cx === dom.x && cy === dom.y + 1;
      if (isDoubleDom) {
        return isTop && (dir === 'W' || dir === 'E');
      }
      if (isTop) {
        if (board[`${dom.x},${dom.y - 1}`]) return false;
        return dir === 'N' || dir === 'W' || dir === 'E';
      }
      if (isBottom) {
        if (board[`${dom.x},${dom.y + 2}`]) return false;
        return dir === 'S' || dir === 'W' || dir === 'E';
      }
      return false;
    };
    const moves: LegalMove[] = [];
    // Bepaal of dominoData de momenteel geselecteerde steen is — alleen dan respecteren we de user-flip
    const selIdx = wegaSelectedIndex;
    const selDom = (selIdx !== null && selIdx !== undefined) ? gameState?.playerHand?.[selIdx] : null;
    const isSelectedTile = !!selDom && selDom === dominoData;
    const forcedFlip: boolean | null = (isSelectedTile && selIdx !== null && selIdx !== undefined && wegaFlipMap[selIdx] !== undefined)
      ? !!wegaFlipMap[selIdx]
      : null;
    if (boardKeys.length === 0) {
      moves.push({
        end: { x: 0, y: 0, value: 0, fromDir: 'E' },
        dominoData,
        flipped: forcedFlip ?? false,
        orientation: dominoData.value1 === dominoData.value2 ? 'vertical' : 'horizontal',
        x: 0,
        y: 0,
      });
      return moves;
    }
    const seen = new Set<string>();
    for (const key of boardKeys) {
      const [cx, cy] = key.split(',').map(Number);
      const cellValue = board[key].value;
      const neighbors: Array<{ nx: number; ny: number; dir: 'N' | 'S' | 'E' | 'W' }> = [
        { nx: cx, ny: cy - 1, dir: 'N' },
        { nx: cx, ny: cy + 1, dir: 'S' },
        { nx: cx - 1, ny: cy, dir: 'W' },
        { nx: cx + 1, ny: cy, dir: 'E' },
      ];
      for (const { nx, ny, dir } of neighbors) {
        const k = `${nx},${ny}`;
        if (board[k] || seen.has(k)) continue;
        // Alleen daadwerkelijke open uiteinden van de tegel aan (cx,cy) toelaten
        if (!isOpenEndDirection(cx, cy, dir)) continue;
        seen.add(k);
        // Dubbele steen ligt áltijd dwars t.o.v. de aansluitrichting
        if (isDoubleTile) {
          if (dominoData.value1 !== cellValue) continue;
          const perpOrientation: 'horizontal' | 'vertical' = (dir === 'N' || dir === 'S') ? 'horizontal' : 'vertical';
          const topX = nx;
          const topY = ny;
          const c1 = `${topX},${topY}`;
          const c2 = perpOrientation === 'horizontal' ? `${topX + 1},${topY}` : `${topX},${topY + 1}`;
          if (board[c1] || board[c2]) continue;
          if (!placementMatchesServerRules(topX, topY, perpOrientation, false)) continue;
          moves.push({
            end: { x: nx, y: ny, value: cellValue, fromDir: dir },
            dominoData,
            flipped: false,
            orientation: perpOrientation,
            x: topX,
            y: topY,
          });
          continue;
        }
        const orientation: 'horizontal' | 'vertical' = (dir === 'N' || dir === 'S') ? 'vertical' : 'horizontal';
        let topX = nx, topY = ny;
        const adjacencyOnSecondCell = (orientation === 'horizontal' && dir === 'W') || (orientation === 'vertical' && dir === 'N');
        if (orientation === 'horizontal' && dir === 'W') topX = nx - 1;
        if (orientation === 'vertical' && dir === 'N') topY = ny - 1;
        // Bepaal flip zodat de helft die tegen cellValue ligt matcht.
        // Bij dir W/N ligt cell_keys[2] (= pip2) tegen de bestaande cel, anders cell_keys[1] (= pip1).
        // pip1 = flipped ? v2 : v1 ; pip2 = flipped ? v1 : v2
        let flipped: boolean | null = null;
        if (adjacencyOnSecondCell) {
          // pip2 moet == cellValue → flipped=false als v2==cellValue, anders flipped=true als v1==cellValue
          if (dominoData.value2 === cellValue) flipped = false;
          else if (dominoData.value1 === cellValue) flipped = true;
        } else {
          // pip1 moet == cellValue
          if (dominoData.value1 === cellValue) flipped = false;
          else if (dominoData.value2 === cellValue) flipped = true;
        }
        if (flipped === null) continue;
        // Check second cell free
        const otherKey = orientation === 'horizontal' ? `${topX + 1},${topY}` : `${topX},${topY + 1}`;
        if (board[otherKey]) continue;
        // Respecteer user-flip wanneer de geselecteerde steen handmatig is geflipt
        const finalFlipped = forcedFlip !== null ? forcedFlip : flipped;
        const adjacentPip = adjacencyOnSecondCell
          ? (finalFlipped ? dominoData.value1 : dominoData.value2)
          : (finalFlipped ? dominoData.value2 : dominoData.value1);
        if (adjacentPip !== cellValue) continue;
        if (!placementMatchesServerRules(topX, topY, orientation, finalFlipped)) continue;
        moves.push({
          end: { x: nx, y: ny, value: cellValue, fromDir: dir },
          dominoData,
          flipped: finalFlipped,
          orientation,
          x: topX,
          y: topY,
        });
      }
    }
    return moves;
  }, [isWegaPlay, gameHook, gameState?.board, gameState?.dominoes, wegaSelectedIndex, gameState?.playerHand, wegaFlipMap]);

  // Dode legacy implementatie — vervangen door klassieke regels via gameHook.findLegalMoves.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _legacyWegaFindLegalMovesForHuman = useCallback((dominoData: DominoData): LegalMove[] => {
    if (!isWegaPlay) return gameHook.findLegalMoves(dominoData);
    if (!dominoData) return [];
    const board = (gameState?.board || {}) as Record<string, { dominoId: string; value: number }>;
    const dominoesMap = (gameState?.dominoes || {}) as Record<string, { x: number; y: number; orientation: 'horizontal' | 'vertical'; data: { value1: number; value2: number } }>;
    const isDoubleTile = dominoData.value1 === dominoData.value2;
    const selIdx = wegaSelectedIndex;
    const selDom = (selIdx !== null && selIdx !== undefined) ? gameState?.playerHand?.[selIdx] : null;
    const isSelectedTile = !!selDom && selDom === dominoData;
    const forcedFlip: boolean = (isSelectedTile && selIdx !== null && selIdx !== undefined && wegaFlipMap[selIdx] !== undefined)
      ? !!wegaFlipMap[selIdx] : false;
    const isOpenEndDirection = (cx: number, cy: number, dir: 'N' | 'S' | 'E' | 'W'): boolean => {
      const cellInfo = board[`${cx},${cy}`];
      if (!cellInfo) return false;
      const dom = dominoesMap[cellInfo.dominoId];
      if (!dom) return false;
      const isDoubleDom = dom.data.value1 === dom.data.value2;
      // Bereken de doelcel
      const tx = dir === 'W' ? cx - 1 : dir === 'E' ? cx + 1 : cx;
      const ty = dir === 'N' ? cy - 1 : dir === 'S' ? cy + 1 : cy;
      if (board[`${tx},${ty}`]) return false;
      // Dubbel = spinner: alle 4 zijden zijn open uiteinden
      if (isDoubleDom) return true;
      // Niet-dubbele steen: alleen aan de end-cellen; daar zijn 3 zijden open
      // (outward in-lijn + 2 dwars). De lange zijdes zijn geblokkeerd.
      if (dom.orientation === 'horizontal') {
        const isLeft = cx === dom.x && cy === dom.y;
        const isRight = cx === dom.x + 1 && cy === dom.y;
        if (isLeft) return dir === 'W' || dir === 'N' || dir === 'S';
        if (isRight) return dir === 'E' || dir === 'N' || dir === 'S';
        return false;
      }
      // vertical
      const isTop = cx === dom.x && cy === dom.y;
      const isBottom = cx === dom.x && cy === dom.y + 1;
      if (isTop) return dir === 'N' || dir === 'W' || dir === 'E';
      if (isBottom) return dir === 'S' || dir === 'W' || dir === 'E';
      return false;
    };
    const boardKeys = Object.keys(board);
    if (boardKeys.length === 0) {
      return [{
        end: { x: 0, y: 0, value: 0, fromDir: 'E' },
        dominoData,
        flipped: forcedFlip,
        orientation: isDoubleTile ? 'vertical' : 'horizontal',
        x: 0, y: 0,
      }];
    }
    const moves: LegalMove[] = [];
    const seen = new Set<string>();
    for (const key of boardKeys) {
      const [cx, cy] = key.split(',').map(Number);
      const cellValue = board[key].value;
      const neighbors: Array<{ nx: number; ny: number; dir: 'N' | 'S' | 'E' | 'W' }> = [
        { nx: cx, ny: cy - 1, dir: 'N' },
        { nx: cx, ny: cy + 1, dir: 'S' },
        { nx: cx - 1, ny: cy, dir: 'W' },
        { nx: cx + 1, ny: cy, dir: 'E' },
      ];
      for (const { nx, ny, dir } of neighbors) {
        const k = `${nx},${ny}`;
        if (board[k] || seen.has(k)) continue;
        if (!isOpenEndDirection(cx, cy, dir)) continue;
        if (isDoubleTile) {
          const perpOrientation: 'horizontal' | 'vertical' = (dir === 'N' || dir === 'S') ? 'horizontal' : 'vertical';
          const topX = nx, topY = ny;
          const otherKey = perpOrientation === 'horizontal' ? `${topX + 1},${topY}` : `${topX},${topY + 1}`;
          if (board[otherKey]) continue;
          seen.add(k);
          moves.push({
            end: { x: nx, y: ny, value: cellValue, fromDir: dir },
            dominoData, flipped: false, orientation: perpOrientation,
            x: topX, y: topY,
          });
        } else {
          const orientation: 'horizontal' | 'vertical' = (dir === 'N' || dir === 'S') ? 'vertical' : 'horizontal';
          let topX = nx, topY = ny;
          if (orientation === 'horizontal' && dir === 'W') topX = nx - 1;
          if (orientation === 'vertical' && dir === 'N') topY = ny - 1;
          const otherKey = orientation === 'horizontal' ? `${topX + 1},${topY}` : `${topX},${topY + 1}`;
          if (board[otherKey]) continue;
          seen.add(k);
          moves.push({
            end: { x: nx, y: ny, value: cellValue, fromDir: dir },
            dominoData, flipped: forcedFlip, orientation,
            x: topX, y: topY,
          });
        }
      }
    }
    return moves;
  }, [isWegaPlay, gameHook, gameState?.board, gameState?.dominoes, wegaSelectedIndex, gameState?.playerHand, wegaFlipMap]);

  const wegaExecuteMove = useCallback(async (move: MoveWithEffects) => {
    if (!isWegaPlay) {
      return wrappedExecuteMove(move);
    }
    try {
      // Resolve hand index against the SERVER hand to avoid desyncs between
      // local selectedHandIndex and the authoritative playerHands array.
      const serverHands: any[] = Array.isArray((syncState.gameState as any)?.playerHands)
        ? (syncState.gameState as any).playerHands
        : [];
      const serverHand: Array<{ value1: number; value2: number }> = Array.isArray(serverHands[syncState.playerPosition])
        ? serverHands[syncState.playerPosition]
        : [];
      const tile = move.dominoData;
      let handIndex = -1;
      if (tile) {
        handIndex = serverHand.findIndex(t =>
          (t.value1 === tile.value1 && t.value2 === tile.value2) ||
          (t.value1 === tile.value2 && t.value2 === tile.value1)
        );
      }
      if (handIndex < 0) {
        const fallback = typeof move.index === 'number' ? move.index : (wegaSelectedIndex ?? -1);
        if (fallback >= 0 && fallback < serverHand.length) handIndex = fallback;
      }
      if (handIndex < 0) {
        toast({ title: 'Steen niet in hand', description: 'De geselecteerde steen staat niet meer in je hand. Selecteer een andere.', variant: 'destructive' });
        setWegaSelectedIndex(null);
        return;
      }
      const { data, error } = await supabase.rpc('wega_submit_move' as any, {
        _lobby_id: gameId,
        _hand_index: handIndex,
        _x: move.x,
        _y: move.y,
        _orientation: move.orientation,
        _flipped: !!move.flipped,
      });
      if (error) throw error;
      const r = data as any;
      if (r?.ok) {
        setWegaSelectedIndex(null);
        if (r?.win) {
          toast({ title: r.changa ? '🎉 CHANGA!' : 'Je hebt gewonnen!', description: r.changa ? 'Dubbele uitbetaling!' : 'Spel afgelopen.' });
        }
      } else {
        const stake = (syncState.gameState as any)?.wegaStake || 10;
        toast({
          title: `Foute zet — boete ${r?.penalty || stake} coins per speler`,
          description: r?.reason === 'cell_occupied' ? 'Cel is al bezet'
            : r?.reason === 'no_matching_end' ? 'Geen passende open einde'
            : r?.reason === 'illegal_adjacency' ? 'Pips komen niet overeen'
            : r?.reason === 'pip_mismatch' ? 'Pips komen niet overeen — boete naar tegenstander'
            : r?.reason === 'illegal_position' ? 'Ongeldige positie (lange zijde of geen open einde)'
            : r?.reason === 'not_your_turn' ? 'Niet jouw beurt' : 'Ongeldige zet',
          variant: 'destructive',
        });
      }
    } catch (e: any) {
      toast({ title: 'Fout', description: e?.message || String(e), variant: 'destructive' });
    }
  }, [isWegaPlay, wrappedExecuteMove, gameId, wegaSelectedIndex, syncState.gameState, syncState.playerPosition, toast]);

  const wegaPassMove = useCallback(async (actorPosition?: number) => {
    if (!isWegaPlay) return passMove(actorPosition);
    try {
      const payload = typeof actorPosition === 'number'
        ? { _lobby_id: gameId, _actor_position: actorPosition }
        : { _lobby_id: gameId };
      const { data, error } = await supabase.rpc('wega_pass' as any, payload);
      if (error) throw error;
      const r = data as any;
      const stake = (syncState.gameState as any)?.wegaStake || 10;
      if (r?.blocked) {
        toast({ title: 'Spel geblokkeerd', description: `Speler ${r.winner_position + 1} wint met laagste pips.` });
      } else {
        toast({ title: 'Gepast', description: `Boete: ${r?.penalty || stake} coins${r?.bonus ? ' (openingsbonus x2)' : ''}` });
      }
    } catch (e: any) {
      toast({ title: 'Fout', description: e?.message || String(e), variant: 'destructive' });
    }
  }, [isWegaPlay, passMove, gameId, syncState.gameState, toast]);

  // Auto-pas: globale app-instelling, alleen admin kan toggelen
  const autoPassEnabled = appSettings?.wega_auto_pass === true;
  const autoPassFiredRef = useRef<string>('');
  useEffect(() => {
    // Reset fingerprint zodra het niet meer mijn beurt is, zodat een nieuwe beurt opnieuw beoordeeld wordt
    if (syncState.currentPlayer !== syncState.playerPosition) {
      autoPassFiredRef.current = '';
    }
  }, [syncState.currentPlayer, syncState.playerPosition]);
  useEffect(() => {
    // In Wega di sen mag een speler elke steen op elk open einde leggen.
    // De server controleert of de zet klopt en eindigt het spel bij een foute zet.
    // Daarom passen mensen alleen handmatig via de Pas-knop. Auto-pas is hier
    // bewust uitgezet om te voorkomen dat het systeem ten onrechte namens de
    // verkeerde speler past (waardoor het leek alsof de bot 2x speelde).
    return;
  }, [isWegaPlay, autoPassEnabled, gameState, syncState.currentPlayer, syncState.playerPosition, wegaFindLegalMoves, wegaPassMove, toast]);

  // === Wega di sen bot orchestrator ===
  // Eén human-client (de host = laagste menselijke positie) stuurt alle bot-acties aan
  // namens hen via de nieuwe `_actor_position` parameter in de Wega RPCs.
  const wegaBotActionLockRef = useRef<string>('');
  const wegaBotDrawLocksRef = useRef<Set<string>>(new Set());
  const botClaimChanceRef = useRef<number>(0.95);
  const botErrorChanceRef = useRef<number>(0.05);
  const wegaAdvanceLockRef = useRef<string>('');

  // Ref naar laatste wegaFindLegalMoves zodat bot-effect niet herstart
  // wanneer de menselijke speler een steen selecteert of flipt.
  const wegaFindLegalMovesRef = useRef(wegaFindLegalMoves);
  useEffect(() => { wegaFindLegalMovesRef.current = wegaFindLegalMoves; }, [wegaFindLegalMoves]);
  const wegaFindLegalMovesForHumanRef = useRef(wegaFindLegalMovesForHuman);
  useEffect(() => { wegaFindLegalMovesForHumanRef.current = wegaFindLegalMovesForHuman; }, [wegaFindLegalMovesForHuman]);

  // Laad bot-claim-chance en bot-error-chance uit app_settings (eenmalig)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data: claim } = await supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'wega_bot_claim_chance')
          .maybeSingle();
        if (!cancelled && claim?.setting_value != null) {
          const v = Number(claim.setting_value);
          if (!Number.isNaN(v) && v >= 0 && v <= 1) botClaimChanceRef.current = v;
        }
        const { data: errSetting } = await supabase
          .from('app_settings')
          .select('setting_value')
          .eq('setting_key', 'wega_bot_error_chance')
          .maybeSingle();
        if (!cancelled && errSetting?.setting_value != null) {
          const v = Number(errSetting.setting_value);
          if (!Number.isNaN(v) && v >= 0 && v <= 1) botErrorChanceRef.current = v;
        }
      } catch (err) {
        console.warn('[wega] kon bot-instellingen niet laden', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Host-client schuift claim-fase door bij timeout (elke 500ms checken)
  useEffect(() => {
    if (!isWegaGame || !gameId) return;
    const gs: any = syncState.gameState;
    if (!gs || gs.wegaPhase !== 'claiming_starter') return;
    const humanPositions = syncState.allPlayers
      .filter((p) => !p.is_bot)
      .map((p) => p.position)
      .sort((a, b) => a - b);
    if (humanPositions.length === 0) return;
    if (humanPositions[0] !== syncState.playerPosition) return;

    const interval = setInterval(async () => {
      const startedAt = Number(gs.wegaClaimStartedAt || 0);
      const idx = Number(gs.wegaClaimIndex || 0);
      const elapsed = Date.now() - startedAt;
      if (elapsed < 3100) return;
      const lockKey = `advance:${idx}:${startedAt}`;
      if (wegaAdvanceLockRef.current === lockKey) return;
      wegaAdvanceLockRef.current = lockKey;
      try {
        await supabase.rpc('wega_advance_claim' as any, { _lobby_id: gameId });
      } catch (err) {
        console.warn('[wega] advance failed', err);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isWegaGame, gameId, syncState.gameState, syncState.allPlayers, syncState.playerPosition]);

  useEffect(() => {
    if (!isWegaGame) return;
    if (!gameId) return;
    const gs: any = syncState.gameState;
    if (!gs || gs.isGameOver) return;
    const phase = gs.wegaPhase as string | undefined;
    if (!phase || phase === 'ended') return;

    const humanPositions = syncState.allPlayers
      .filter((p) => !p.is_bot)
      .map((p) => p.position)
      .sort((a, b) => a - b);
    if (humanPositions.length === 0) return;
    if (humanPositions[0] !== syncState.playerPosition) return; // alleen host stuurt bots

    const bots = syncState.allPlayers.filter((p) => p.is_bot);
    if (bots.length === 0) return;

    const hands: Array<Array<{ value1: number; value2: number }>> =
      Array.isArray(gs.playerHands) ? gs.playerHands : [];

    let cancelled = false;

    const run = async () => {
      try {
        if (cancelled) return;
        if (phase === 'drawing') {
          const boneyard: Array<any> = Array.isArray(gs.boneyard) ? gs.boneyard : [];
          const availableIdx = boneyard.map((t, i) => (t ? i : -1)).filter((i) => i >= 0);
          if (availableIdx.length === 0) {
            scheduleBotRetry(250);
            return;
          }
          // Alle bots die nog stenen nodig hebben tegelijk laten trekken,
          // met elk een eigen korte willekeurige vertraging zodat het er
          // natuurlijk uitziet (geen strikte volgorde).
          const hungryBots = bots.filter((b) => (hands[b.position] || []).length < 5);
          if (hungryBots.length === 0) {
            scheduleBotRetry(200);
            return;
          }
          for (const bot of hungryBots) {
            const lockKey = `draw:${bot.position}:${(hands[bot.position] || []).length}`;
            if (wegaBotDrawLocksRef.current.has(lockKey)) continue;
            wegaBotDrawLocksRef.current.add(lockKey);
            const delay = 120 + Math.floor(Math.random() * 380); // 120–500ms
            void (async () => {
              try {
                await new Promise((r) => setTimeout(r, delay));
                if (cancelled) return;
                // Pak vers de actueel beschikbare indices op het moment van trekken
                const latestGs: any = syncState.gameState;
                const latestBy: any[] = Array.isArray(latestGs?.boneyard) ? latestGs.boneyard : boneyard;
                const latestAvail = latestBy.map((t, i) => (t ? i : -1)).filter((i) => i >= 0);
                if (latestAvail.length === 0) return;
                const pick = latestAvail[Math.floor(Math.random() * latestAvail.length)];
                const { error } = await supabase.rpc('wega_claim_boneyard_tile' as any, {
                  _lobby_id: gameId,
                  _tile_index: pick,
                  _actor_position: bot.position,
                });
                if (error && !/already taken|invalid tile index/i.test(error.message || '')) {
                  console.warn('[wegaBot] draw failed', error);
                }
              } finally {
                wegaBotDrawLocksRef.current.delete(lockKey);
              }
            })();
          }
          scheduleBotRetry(250);
          return;
        }

        if (phase === 'claiming_starter') {
          // Nieuwe gestuurde claim-fase: bot claimt huidige steen als hij hem heeft
          const seq: Array<{ value1: number; value2: number }> = Array.isArray(gs.wegaClaimSequence) ? gs.wegaClaimSequence : [];
          const cidx = Number(gs.wegaClaimIndex || 0);
          const currentTile = seq[cidx];
          if (!currentTile) return;
          const startedAt = Number(gs.wegaClaimStartedAt || 0);
          const owner = bots.find((b) => (hands[b.position] || []).some(t =>
            (t.value1 === currentTile.value1 && t.value2 === currentTile.value2) ||
            (t.value1 === currentTile.value2 && t.value2 === currentTile.value1)
          ));
          if (owner) {
            const lockKey = `claim2:${owner.position}:${cidx}:${startedAt}`;
            if (wegaBotActionLockRef.current === lockKey) {
              scheduleBotRetry(250);
              return;
            }
            wegaBotActionLockRef.current = lockKey;
            const claimChance = Number(botClaimChanceRef.current ?? 0.95);
            const willClaim = Math.random() < claimChance;
            if (!willClaim) {
              wegaBotActionLockRef.current = '';
              return; // bot "slaapt" → host-timer schuift door
            }
            const delay = Math.min(800, Math.max(120, botMaxActionMs - 300));
            await new Promise((r) => setTimeout(r, delay));
            if (cancelled) {
              if (wegaBotActionLockRef.current === lockKey) wegaBotActionLockRef.current = '';
              scheduleBotRetry(60);
              return;
            }
            try {
              const { error } = await supabase.rpc('wega_claim_current' as any, {
                _lobby_id: gameId,
                _actor_position: owner.position,
              });
              if (error) throw error;
            } catch (err) {
              console.error('[wegaBot] claim_current failed', err);
            } finally {
              wegaBotActionLockRef.current = '';
            }
          }
          return;
        }

        if (phase === 'playing') {
          const curPos = syncState.currentPlayer;
          const actor = bots.find((b) => b.position === curPos);
          if (!actor) return;
          const hand = hands[actor.position] || [];
          const lockKey = `play:${actor.position}:${hand.length}:${Object.keys(gs.board || {}).length}:${gs.consecutivePasses ?? 0}`;
          if (wegaBotActionLockRef.current === lockKey) {
            scheduleBotRetry(botMaxActionMs);
            return;
          }
          wegaBotActionLockRef.current = lockKey;

          const candidates: Array<{ move: any; index: number }> = [];
          for (let i = 0; i < hand.length; i++) {
            const moves = wegaFindLegalMovesRef.current(hand[i] as any);
            if (moves && moves.length > 0) {
              candidates.push(...moves.map((move) => ({ move, index: i })));
            }
          }
          // Admin-instelbare foutkans: bot kiest soms bewust een verkeerde plaatsing.
          // Server-side validatie eindigt het spel en past de boete toe.
          const errorChance = Number(botErrorChanceRef.current ?? 0);
          const makeMistake = errorChance > 0 && hand.length > 0 && Math.random() < errorChance;
          if (makeMistake) {
            const permissive = wegaFindLegalMovesForHumanRef.current(hand[Math.floor(Math.random() * hand.length)] as any) || [];
            // Filter zetten die toevallig wél kloppen (alleen écht foute zetten gebruiken)
            const wrong = permissive.filter((m: any) => {
              const strict = wegaFindLegalMovesRef.current(m.dominoData) || [];
              return !strict.some((s: any) => s.x === m.x && s.y === m.y && s.orientation === m.orientation);
            });
            if (wrong.length > 0) {
              const w = wrong[Math.floor(Math.random() * wrong.length)];
              const handIdx = hand.findIndex((t: any) => t === w.dominoData
                || (t.value1 === w.dominoData.value1 && t.value2 === w.dominoData.value2));
              if (handIdx >= 0) {
                console.log('[wegaBot] bewust foute zet (errorChance=' + errorChance + ')', w);
                candidates.unshift({ move: w, index: handIdx });
              }
            }
          }
          await new Promise((r) => setTimeout(r, Math.min(1200, Math.max(120, botMaxActionMs - 250))));
          if (cancelled) {
            if (wegaBotActionLockRef.current === lockKey) wegaBotActionLockRef.current = '';
            scheduleBotRetry(60);
            return;
          }

          if (candidates.length > 0) {
            for (const candidate of candidates) {
              const chosen = candidate.move;
              const { data, error } = await supabase.rpc('wega_submit_move' as any, {
                _lobby_id: gameId,
                _hand_index: candidate.index,
                _x: chosen.x,
                _y: chosen.y,
                _orientation: chosen.orientation,
                _flipped: !!chosen.flipped,
                _actor_position: actor.position,
              });
              if (error) throw error;
              const result = data as any;
              if (result?.ok) {
                wegaBotActionLockRef.current = '';
                scheduleBotRetry(120);
                return;
              }
              if (result?.reason === 'not_your_turn') break;
              console.warn('[wegaBot] rejected candidate, trying next', result);
            }
          }
          const { error } = await supabase.rpc('wega_pass' as any, {
            _lobby_id: gameId,
            _actor_position: actor.position,
          });
          if (error) throw error;
          wegaBotActionLockRef.current = '';
          scheduleBotRetry(120);
          return;
        }
      } catch (err) {
        console.error('[wegaBot] action failed', err);
        wegaBotActionLockRef.current = '';
        scheduleBotRetry(300);
      }
    };

    const t = setTimeout(run, 80);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [
    isWegaGame,
    gameId,
    syncState.gameState,
    syncState.allPlayers,
    syncState.playerPosition,
    syncState.currentPlayer,
    botMaxActionMs,
    botTick,
    scheduleBotRetry,
  ]);

  return (
    <div className={`min-h-screen relative ${gameVersion === 'beta' ? 'bg-transparent' : 'bg-background'}`}>
      {gameVersion === 'beta' && (
        <>
          <div
            className="pointer-events-none fixed inset-0 -z-10 bg-cover bg-center"
            style={{
              backgroundImage: `url('${appSettings?.beta_page_background_url || '/lovable-uploads/07b47c70-696f-408c-9981-c04375940eea.png'}')`,
            }}
            aria-hidden="true"
          />
          <div className="pointer-events-none fixed inset-0 -z-10 bg-black/60 backdrop-blur-sm" aria-hidden="true" />
        </>
      )}
      <GameVersionToggle />
      {/* Wega di sen overrides */}
      {(() => {
        const ActiveDominoGame = gameVersion === 'beta' ? DominoGame : DominoGameStable;
        return (
        <ActiveDominoGame
          gameHook={{
          ...gameHook, 
          executeMove: wegaExecuteMove,
          // In Wega di sen gelden de klassieke plaatsingsregels 1-op-1.
          // De UI toont dus alleen zetten die ook qua pips kloppen.
          // findLegalMovesStrict blijft dezelfde bron voor bot-keuzes/auto-pas-detectie.
          findLegalMoves: isWegaPlay
            ? wegaFindLegalMovesForHuman
            : gameHook.findLegalMoves,
          findLegalMovesStrict: gameHook.findLegalMoves,
          drawFromBoneyard: wrappedDrawFromBoneyard,
          drawSpecificFromBoneyard: wrappedDrawSpecificFromBoneyard,
          passMove: wegaPassMove,
          manualBlockedCheck,
          fixTableStones: wrappedFixTableStones,
          startNewGame: wrappedStartNewGame,
          hardSlam: wrappedHardSlam,
          botDebugInfo,
          syncState,
          gameData: syncState.gameData || { background_choice: null },
          wegaFlipMap: isWegaPlay ? wegaFlipMap : undefined,
          flipWegaTile: isWegaPlay ? flipWegaTile : undefined,
          selectHandDomino: isWegaPlay ? wegaSelectHandDomino : gameHook.selectHandDomino,
          gameState: isWegaPlay
            ? { ...gameHook.gameState, selectedHandIndex: wegaSelectedIndex }
            : gameHook.gameState,
          }}
        />
        );
      })()}
      <WegaPhaseOverlay
        lobbyId={gameId || ''}
        gameState={syncState.gameState}
        playerPosition={syncState.playerPosition}
        allPlayers={syncState.allPlayers}
        onChanged={() => { /* realtime listener verzorgt update */ }}
        adminFaceUp={adminBoneyardFaceUp}
        skin={{
          image_url: (syncState.gameData as any)?.domino_skin_url ?? null,
          css_background: (syncState.gameData as any)?.domino_skin_css ?? null,
        }}
      />
      <WegaPlayingOverlay
        lobbyId={gameId || ''}
        gameState={syncState.gameState}
        playerPosition={syncState.playerPosition}
        currentPlayer={syncState.currentPlayer}
        allPlayers={syncState.allPlayers}
        autoPassEnabled={autoPassEnabled}
      />
    </div>
  );
}
