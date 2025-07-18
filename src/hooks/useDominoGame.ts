import { useState, useCallback, useRef } from 'react';
import { GameState, DominoData, OpenEnd, LegalMove, DominoState } from '@/types/domino';

const CELL_SIZE = 48;

const isDouble = (data: DominoData) => data?.value1 === data?.value2;

const shuffleArray = <T>(array: T[]): void => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
};

export const useDominoGame = () => {
  const [gameState, setGameState] = useState<GameState>({
    dominoes: {},
    board: {},
    playerHand: [],
    boneyard: [],
    openEnds: [],
    forbiddens: {},
    nextDominoId: 0,
    spinnerId: null,
    isGameOver: false,
    selectedHandIndex: null,
  });

  const gameStateRef = useRef(gameState);
  gameStateRef.current = gameState;

  const resetGame = useCallback(() => {
    setGameState({
      dominoes: {},
      board: {},
      playerHand: [],
      boneyard: [],
      openEnds: [],
      forbiddens: {},
      nextDominoId: 0,
      spinnerId: null,
      isGameOver: false,
      selectedHandIndex: null,
    });
  }, []);

  const placeDominoOnGrid = useCallback((
    id: string,
    data: DominoData,
    x: number,
    y: number,
    orientation: 'horizontal' | 'vertical',
    flipped = false
  ) => {
    const dominoState: DominoState = {
      data,
      x,
      y,
      orientation,
      flipped,
      isSpinner: isDouble(data),
    };

    const pips = flipped ? [data.value2, data.value1] : [data.value1, data.value2];
    const cells = orientation === 'horizontal' 
      ? [[x, y], [x + 1, y]] 
      : [[x, y], [x, y + 1]];

    setGameState(prev => {
      const newState = { ...prev };
      newState.dominoes[id] = dominoState;

      cells.forEach((cell, i) => {
        newState.board[`${cell[0]},${cell[1]}`] = {
          dominoId: id,
          value: pips[i],
        };
      });

      return newState;
    });
  }, []);

  const startGame = useCallback(() => {
    resetGame();
    let fullSet: DominoData[] = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        fullSet.push({ value1: i, value2: j });
      }
    }
    shuffleArray(fullSet);

    const playerHand = fullSet.slice(0, 7);
    const boneyard = fullSet.slice(7);

    // Find highest double or highest total value
    let starter: DominoData;
    let starterIndex = -1;

    // Look for highest double first
    for (let i = 6; i >= 0; i--) {
      starterIndex = playerHand.findIndex(d => d.value1 === i && d.value2 === i);
      if (starterIndex > -1) break;
    }

    // If no double, find highest total value
    if (starterIndex === -1) {
      let highestPip = -1;
      playerHand.forEach((d, i) => {
        const total = d.value1 + d.value2;
        if (total > highestPip) {
          highestPip = total;
          starterIndex = i;
        }
      });
    }

    starter = playerHand.splice(starterIndex, 1)[0];
    const starterId = 'd0';
    const orientation = isDouble(starter) ? 'vertical' : 'horizontal';

    setGameState({
      dominoes: {
        [starterId]: {
          data: starter,
          x: 0,
          y: 0,
          orientation,
          flipped: false,
          isSpinner: isDouble(starter),
        }
      },
      board: orientation === 'horizontal' 
        ? {
            '0,0': { dominoId: starterId, value: starter.value1 },
            '1,0': { dominoId: starterId, value: starter.value2 }
          }
        : {
            '0,0': { dominoId: starterId, value: starter.value1 },
            '0,1': { dominoId: starterId, value: starter.value2 }
          },
      playerHand,
      boneyard,
      openEnds: [],
      forbiddens: {},
      nextDominoId: 1,
      spinnerId: isDouble(starter) ? starterId : null,
      isGameOver: false,
      selectedHandIndex: null,
    });
  }, [resetGame]);

  // EXACT COPY FROM YOUR ORIGINAL CODE
  const regenerateOpenEnds = useCallback((state: GameState): OpenEnd[] => {
    const openEnds: OpenEnd[] = [];
    
    for (const coord in state.board) {
      const [x, y] = coord.split(',').map(Number);
      const cell = state.board[coord];
      const domino = state.dominoes[cell.dominoId];

      const neighbors = {
        N: [x, y - 1],
        S: [x, y + 1],
        W: [x - 1, y],
        E: [x + 1, y],
      };

      for (const dir in neighbors) {
        const [nx, ny] = neighbors[dir as keyof typeof neighbors];
        if (state.board[`${nx},${ny}`]) continue;

        if (isDouble(domino.data)) {
          const isVertical = domino.orientation === 'vertical';
          // Non-spinner doubles only connect perpendicular to their orientation
          if (
            (isVertical && (dir === 'N' || dir === 'S')) ||
            (!isVertical && (dir === 'W' || dir === 'E'))
          ) {
            continue;
          }
        }

        openEnds.push({
          x: nx,
          y: ny,
          value: cell.value,
          fromDir: dir as 'N' | 'S' | 'E' | 'W',
        });
      }
    }

    return openEnds;
  }, []);

  // EXACT COPY FROM YOUR ORIGINAL CODE
  const hasDifferentNeighbor = useCallback((x: number, y: number): boolean => {
    const { board } = gameStateRef.current;
    const neighbors = {
      N: [x, y - 1],
      S: [x, y + 1],
      W: [x - 1, y],
      E: [x + 1, y],
      NE: [x + 1, y - 1],
      NW: [x - 1, y - 1],
      SE: [x + 1, y + 1],
      SW: [x - 1, y + 1]
    };

    let nCount = 0;

    for (const direction in neighbors) {
      const [nx, ny] = neighbors[direction as keyof typeof neighbors];
      const neighborKey = `${nx},${ny}`;
      if (board[neighborKey]) {
        nCount += 1;
      }
    }

    if (nCount > 3) {
      return true;
    }

    return false;
  }, []);

  // EXACT COPY FROM YOUR ORIGINAL CODE
  const findLegalMoves = useCallback((dominoData: DominoData): LegalMove[] => {
    const moves: LegalMove[] = [];
    const selectedIsDouble = isDouble(dominoData);
    const uniqueEnds: Record<string, boolean> = {};
    const currentState = gameStateRef.current;
    const openEnds = regenerateOpenEnds(currentState);

    openEnds.forEach((end) => {
      if (uniqueEnds[`${end.x},${end.y}`]) {
        return;
      }

      const check = (value: number, flipped: boolean) => {
        if (end.value === value) {
          const fromCellKey = {
            N: `${end.x},${end.y + 1}`,
            S: `${end.x},${end.y - 1}`,
            W: `${end.x + 1},${end.y}`,
            E: `${end.x - 1},${end.y}`,
          }[end.fromDir];

          const toCellKey = {
            N: `${end.x},${end.y - 1}`,
            S: `${end.x},${end.y + 1}`,
            W: `${end.x - 1},${end.y}`,
            E: `${end.x + 1},${end.y}`,
          }[end.fromDir];

          const toCellKeyForward = {
            N: `${end.x},${end.y - 2}`,
            S: `${end.x},${end.y + 2}`,
            W: `${end.x - 2},${end.y}`,
            E: `${end.x + 2},${end.y}`,
          }[end.fromDir];

          const toDomino = currentState.dominoes[currentState.board[toCellKey]?.dominoId];
          const toDominoForward = currentState.dominoes[currentState.board[toCellKeyForward]?.dominoId];
          const fromDomino = currentState.dominoes[currentState.board[fromCellKey]?.dominoId];

          if (!fromDomino) {
            return;
          }
          if (toDomino) {
            return;
          }
          if (toDominoForward) {
            return;
          }

          if (currentState.forbiddens[toCellKey]) {
            return;
          }

          if (hasDifferentNeighbor(end.x, end.y)) {
            return;
          }

          const orientation = end.fromDir === 'N' || end.fromDir === 'S' ? 'vertical' : 'horizontal';

          if (fromDomino.isSpinner && fromDomino) {
            // Parallel Moves from double items are forbidden.
            if (moves.find(x => x.end.fromDir === end.fromDir && x.fromDomino === fromDomino)) {
              return;
            }
          }

          if (selectedIsDouble && fromDomino.orientation === 'horizontal' && (end.fromDir === 'N' || end.fromDir === 'S')) {
            return;
          }
          if (selectedIsDouble && fromDomino.orientation === 'vertical' && (end.fromDir === 'E' || end.fromDir === 'W')) {
            return;
          }

          let { x, y } = end;
          let adjustedFlipped = flipped;

          // Adjust position and flipping based on direction to ensure correct pip matching
          if (orientation === 'horizontal') {
            if (end.fromDir === 'W') {
              x -= 1; // Place to the left
              adjustedFlipped = !flipped; // Flip to match the right side of the open end
            }
            // For "E", no adjustment needed as it works fine
          } else {
            if (end.fromDir === 'N') {
              y -= 1; // Place above
              adjustedFlipped = !flipped; // Flip to match the bottom side of the open end
            }
            // For "S", no adjustment needed as it works fine
          }

          moves.push({ end, dominoData, flipped: adjustedFlipped, orientation, x, y, fromDomino });

          uniqueEnds[`${end.x},${end.y}`] = true;
        }
      };

      check(dominoData.value1, false);
      check(dominoData.value2, true);
    });

    return moves;
  }, [regenerateOpenEnds, hasDifferentNeighbor]);

  const executeMove = useCallback((move: LegalMove) => {
    const { index, end, dominoData, flipped, orientation } = move;
    if (index === undefined) {
      return;
    }

    setGameState(prev => {
      const id = `d${prev.nextDominoId}`;
      const { x, y, flipped: adjustedFlipped } = move;

      // Use the pre-calculated position and flipped values from findLegalMoves

      if (isDouble(dominoData)) {
        if (end.fromDir === 'N' || end.fromDir === 'S') {
          if (end.fromDir === 'S') {
            prev.forbiddens[`${x + 1},${y - 1}`] = true;
            prev.forbiddens[`${x - 1},${y - 1}`] = true;
          }
          if (end.fromDir === 'N') {
            prev.forbiddens[`${x - 1},${y + 1}`] = true;
            prev.forbiddens[`${x + 1},${y + 1}`] = true;
          }
        } else {
          if (end.fromDir === 'E') {
            prev.forbiddens[`${x - 1},${y + 1}`] = true;
            prev.forbiddens[`${x - 1},${y - 1}`] = true;
          }
          if (end.fromDir === 'W') {
            prev.forbiddens[`${x + 1},${y + 1}`] = true;
            prev.forbiddens[`${x + 1},${y - 1}`] = true;
          }
        }
      } else {
        let dir = end.fromDir;
        if (dir === 'N') {
          prev.forbiddens[`${x - 1},${y + 2}`] = true;
          prev.forbiddens[`${x + 1},${y + 2}`] = true;
          prev.forbiddens[`${x - 1},${y + 1}`] = true;
          prev.forbiddens[`${x + 1},${y + 1}`] = true;
          prev.forbiddens[`${x},${y + 3}`] = true;
        }
        if (dir === 'S') {
          prev.forbiddens[`${x - 1},${y - 1}`] = true;
          prev.forbiddens[`${x + 1},${y - 1}`] = true;
          prev.forbiddens[`${x - 1},${y}`] = true;
          prev.forbiddens[`${x + 1},${y}`] = true;
          prev.forbiddens[`${x},${y - 2}`] = true;
        }
        if (dir === 'W') {
          prev.forbiddens[`${x + 2},${y + 1}`] = true;
          prev.forbiddens[`${x + 2},${y - 1}`] = true;
          prev.forbiddens[`${x + 1},${y + 1}`] = true;
          prev.forbiddens[`${x + 1},${y - 1}`] = true;
          if (`${x + 3},${y}` !== '1,0') prev.forbiddens[`${x + 3},${y}`] = true;
        }
        if (dir === 'E') {
          prev.forbiddens[`${x - 1},${y - 1}`] = true;
          prev.forbiddens[`${x - 1},${y + 1}`] = true;
          prev.forbiddens[`${x},${y - 1}`] = true;
          prev.forbiddens[`${x},${y + 1}`] = true;
          if (`${x - 2},${y}` !== '-1,0') prev.forbiddens[`${x - 2},${y}`] = true;
        }
      }

      if (!prev.spinnerId && isDouble(dominoData)) {
        prev.spinnerId = id;
      }

      const newPlayerHand = [...prev.playerHand];
      newPlayerHand.splice(index, 1);

      const dominoState: DominoState = {
        data: dominoData,
        x,
        y,
        orientation,
        flipped: adjustedFlipped,
        isSpinner: isDouble(dominoData),
      };

      const pips = adjustedFlipped 
        ? [dominoData.value2, dominoData.value1] 
        : [dominoData.value1, dominoData.value2];

      const cells = orientation === 'horizontal' 
        ? [[x, y], [x + 1, y]] 
        : [[x, y], [x, y + 1]];

      const newBoard = { ...prev.board };
      cells.forEach((cell, i) => {
        newBoard[`${cell[0]},${cell[1]}`] = {
          dominoId: id,
          value: pips[i],
        };
      });

      return {
        ...prev,
        dominoes: { ...prev.dominoes, [id]: dominoState },
        board: newBoard,
        playerHand: newPlayerHand,
        selectedHandIndex: null,
        nextDominoId: prev.nextDominoId + 1,
      };
    });
  }, []);

  const drawFromBoneyard = useCallback(() => {
    if (gameState.isGameOver || gameState.boneyard.length === 0) return;

    setGameState(prev => ({
      ...prev,
      playerHand: [...prev.playerHand, prev.boneyard[prev.boneyard.length - 1]],
      boneyard: prev.boneyard.slice(0, -1),
    }));
  }, [gameState.isGameOver, gameState.boneyard.length]);

  const selectHandDomino = useCallback((index: number) => {
    setGameState(prev => ({
      ...prev,
      selectedHandIndex: prev.selectedHandIndex === index ? null : index,
    }));
  }, []);

  return {
    gameState,
    setGameState,
    startGame,
    placeDominoOnGrid,
    findLegalMoves,
    executeMove,
    drawFromBoneyard,
    selectHandDomino,
    resetGame,
    hasDifferentNeighbor: (x: number, y: number) => hasDifferentNeighbor(x, y),
    regenerateOpenEnds: () => regenerateOpenEnds(gameStateRef.current),
  };
};