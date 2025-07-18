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
      const newBoard = { ...prev.board };
      const newDominoes = { ...prev.dominoes };

      newDominoes[id] = dominoState;
      
      cells.forEach((cell, i) => {
        newBoard[`${cell[0]},${cell[1]}`] = {
          dominoId: id,
          value: pips[i],
        };
      });

      return {
        ...prev,
        dominoes: newDominoes,
        board: newBoard,
      };
    });
  }, []);

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

  const findLegalMoves = useCallback((dominoData: DominoData, state?: GameState): LegalMove[] => {
    const currentState = state || gameStateRef.current;
    const moves: LegalMove[] = [];
    const selectedIsDouble = isDouble(dominoData);
    const uniqueEnds: Record<string, boolean> = {};
    const openEnds = regenerateOpenEnds(currentState);

    openEnds.forEach((end) => {
      if (uniqueEnds[`${end.x},${end.y}`]) return;

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

          const fromDomino = currentState.dominoes[currentState.board[fromCellKey]?.dominoId];
          const toDomino = currentState.dominoes[currentState.board[toCellKey]?.dominoId];
          const toDominoForward = currentState.dominoes[currentState.board[toCellKeyForward]?.dominoId];

          if (!fromDomino || toDomino || toDominoForward || currentState.forbiddens[toCellKey]) {
            return;
          }

          const orientation = (end.fromDir === 'N' || end.fromDir === 'S') ? 'vertical' : 'horizontal';

          if (fromDomino.isSpinner && moves.find(x => x.end.fromDir === end.fromDir && x.fromDomino === fromDomino)) {
            return;
          }

          if (selectedIsDouble && fromDomino.orientation === 'horizontal' && (end.fromDir === 'N' || end.fromDir === 'S')) {
            return;
          }
          if (selectedIsDouble && fromDomino.orientation === 'vertical' && (end.fromDir === 'E' || end.fromDir === 'W')) {
            return;
          }

          moves.push({ end, dominoData, flipped, orientation, fromDomino });
          uniqueEnds[`${end.x},${end.y}`] = true;
        }
      };

      check(dominoData.value1, false);
      check(dominoData.value2, true);
    });

    return moves;
  }, [regenerateOpenEnds]);

  const executeMove = useCallback((move: LegalMove) => {
    const { index, end, dominoData, flipped, orientation } = move;
    if (index === undefined) return;

    setGameState(prev => {
      const id = `d${prev.nextDominoId}`;
      let { x, y } = end;
      let adjustedFlipped = flipped;

      // Adjust position and flipping based on direction
      if (orientation === 'horizontal') {
        if (end.fromDir === 'W') {
          x -= 1;
          adjustedFlipped = !flipped;
        }
      } else {
        if (end.fromDir === 'N') {
          y -= 1;
          adjustedFlipped = !flipped;
        }
      }

      // Update forbiddens
      const newForbiddens = { ...prev.forbiddens };
      
      if (isDouble(dominoData)) {
        if (end.fromDir === 'N' || end.fromDir === 'S') {
          if (end.fromDir === 'S') {
            newForbiddens[`${x + 1},${y - 1}`] = true;
            newForbiddens[`${x - 1},${y - 1}`] = true;
          }
          if (end.fromDir === 'N') {
            newForbiddens[`${x - 1},${y + 1}`] = true;
            newForbiddens[`${x + 1},${y + 1}`] = true;
          }
        } else {
          if (end.fromDir === 'E') {
            newForbiddens[`${x - 1},${y + 1}`] = true;
            newForbiddens[`${x - 1},${y - 1}`] = true;
          }
          if (end.fromDir === 'W') {
            newForbiddens[`${x + 1},${y + 1}`] = true;
            newForbiddens[`${x + 1},${y - 1}`] = true;
          }
        }
      } else {
        const dir = end.fromDir;
        if (dir === 'N') {
          newForbiddens[`${x - 1},${y + 2}`] = true;
          newForbiddens[`${x + 1},${y + 2}`] = true;
          newForbiddens[`${x - 1},${y + 1}`] = true;
          newForbiddens[`${x + 1},${y + 1}`] = true;
          newForbiddens[`${x},${y + 3}`] = true;
        }
        // Add other directions...
      }

      // Place domino
      const dominoState: DominoState = {
        data: dominoData,
        x,
        y,
        orientation,
        flipped: adjustedFlipped,
        isSpinner: isDouble(dominoData),
      };

      const pips = adjustedFlipped ? [dominoData.value2, dominoData.value1] : [dominoData.value1, dominoData.value2];
      const cells = orientation === 'horizontal' ? [[x, y], [x + 1, y]] : [[x, y], [x, y + 1]];

      const newBoard = { ...prev.board };
      const newDominoes = { ...prev.dominoes };
      
      newDominoes[id] = dominoState;
      cells.forEach((cell, i) => {
        newBoard[`${cell[0]},${cell[1]}`] = {
          dominoId: id,
          value: pips[i],
        };
      });

      const newHand = [...prev.playerHand];
      newHand.splice(index, 1);

      return {
        ...prev,
        dominoes: newDominoes,
        board: newBoard,
        playerHand: newHand,
        selectedHandIndex: null,
        nextDominoId: prev.nextDominoId + 1,
        spinnerId: !prev.spinnerId && isDouble(dominoData) ? id : prev.spinnerId,
        forbiddens: newForbiddens,
      };
    });
  }, []);

  const selectDomino = useCallback((index: number) => {
    setGameState(prev => ({
      ...prev,
      selectedHandIndex: prev.selectedHandIndex === index ? null : index,
    }));
  }, []);

  const drawFromBoneyard = useCallback(() => {
    setGameState(prev => {
      if (prev.isGameOver || prev.boneyard.length === 0) return prev;
      
      const newBoneyard = [...prev.boneyard];
      const drawnDomino = newBoneyard.pop()!;
      
      return {
        ...prev,
        playerHand: [...prev.playerHand, drawnDomino],
        boneyard: newBoneyard,
      };
    });
  }, []);

  const startNewGame = useCallback(() => {
    const fullSet: DominoData[] = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        fullSet.push({ value1: i, value2: j });
      }
    }
    shuffleArray(fullSet);

    const playerHand = fullSet.slice(0, 7);
    const boneyard = fullSet.slice(7);

    // Find highest double or highest value starter
    let starterIndex = -1;
    for (let i = 6; i >= 0; i--) {
      starterIndex = playerHand.findIndex(d => d.value1 === i && d.value2 === i);
      if (starterIndex > -1) break;
    }

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

    const starter = playerHand.splice(starterIndex, 1)[0];
    const starterId = 'd0';
    const orientation = isDouble(starter) ? 'vertical' : 'horizontal';

    setGameState({
      dominoes: {},
      board: {},
      playerHand,
      boneyard,
      openEnds: [],
      forbiddens: {},
      nextDominoId: 1,
      spinnerId: isDouble(starter) ? starterId : null,
      isGameOver: false,
      selectedHandIndex: null,
    });

    // Place starter domino
    setTimeout(() => {
      const dominoState: DominoState = {
        data: starter,
        x: 0,
        y: 0,
        orientation,
        flipped: false,
        isSpinner: isDouble(starter),
      };

      const pips = [starter.value1, starter.value2];
      const cells = orientation === 'horizontal' ? [[0, 0], [1, 0]] : [[0, 0], [0, 1]];

      setGameState(prev => {
        const newBoard = { ...prev.board };
        const newDominoes = { ...prev.dominoes };

        newDominoes[starterId] = dominoState;
        cells.forEach((cell, i) => {
          newBoard[`${cell[0]},${cell[1]}`] = {
            dominoId: starterId,
            value: pips[i],
          };
        });

        return {
          ...prev,
          dominoes: newDominoes,
          board: newBoard,
        };
      });
    }, 100);
  }, []);

  return {
    gameState,
    findLegalMoves,
    executeMove,
    selectDomino,
    drawFromBoneyard,
    startNewGame,
    resetGame,
  };
};