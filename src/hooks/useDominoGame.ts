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
      rotation: (Math.random() - 0.5) * 15, // Random rotation between -7.5 and +7.5 degrees
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

    // Start with empty board - speler met hoogste dubbel mag zelf kiezen
    setGameState({
      dominoes: {},
      board: {},
      playerHand,
      boneyard,
      openEnds: [],
      forbiddens: {},
      nextDominoId: 0,
      spinnerId: null,
      isGameOver: false,
      selectedHandIndex: null,
    });
  }, [resetGame]);

  // EXACT COPY FROM YOUR ORIGINAL CODE
  const regenerateOpenEnds = useCallback((state: GameState): OpenEnd[] => {
    const openEnds: OpenEnd[] = [];
    const boardCoords = Object.keys(state.board);
    
    // Special case: first non-double domino should have FOUR open ends (one in each direction)
    if (boardCoords.length === 2 && Object.keys(state.dominoes).length === 1) {
      const dominoId = Object.keys(state.dominoes)[0];
      const domino = state.dominoes[dominoId];
      
      if (!isDouble(domino.data)) {
        console.log('🔍 First non-double domino detected:', domino.data, 'at', domino.x, domino.y, 'orientation:', domino.orientation, 'flipped:', domino.flipped);
        console.log('🔍 BOARD STATE DEBUG:', state.board);
        console.log('🔍 DOMINOES STATE DEBUG:', state.dominoes);
        
        // Get the board positions to determine actual values
        const leftCellKey = `${domino.x},${domino.y}`;
        const rightCellKey = domino.orientation === 'horizontal' ? `${domino.x + 1},${domino.y}` : `${domino.x},${domino.y + 1}`;
        
        const leftValue = state.board[leftCellKey]?.value;
        const rightValue = state.board[rightCellKey]?.value;
        
        console.log('🔍 Board keys - left:', leftCellKey, 'right:', rightCellKey);
        console.log('🔍 Board values - left/top:', leftValue, 'right/bottom:', rightValue);
        
        if (domino.orientation === 'horizontal') {
          // Horizontal domino: left cell and right cell
          openEnds.push({
            x: domino.x - 1,
            y: domino.y,
            value: leftValue, // Value from left cell
            fromDir: 'W',
          });
          openEnds.push({
            x: domino.x + 2,
            y: domino.y,
            value: rightValue, // Value from right cell
            fromDir: 'E',
          });
          openEnds.push({
            x: domino.x,
            y: domino.y - 1,
            value: leftValue, // Value from left cell
            fromDir: 'N',
          });
          openEnds.push({
            x: domino.x + 1,
            y: domino.y - 1,
            value: rightValue, // Value from right cell
            fromDir: 'N',
          });
          openEnds.push({
            x: domino.x,
            y: domino.y + 1,
            value: leftValue, // Value from left cell
            fromDir: 'S',
          });
          openEnds.push({
            x: domino.x + 1,
            y: domino.y + 1,
            value: rightValue, // Value from right cell
            fromDir: 'S',
          });
        } else {
          // Vertical domino: top cell and bottom cell
          openEnds.push({
            x: domino.x,
            y: domino.y - 1,
            value: leftValue, // Value from top cell
            fromDir: 'N',
          });
          openEnds.push({
            x: domino.x,
            y: domino.y + 2,
            value: rightValue, // Value from bottom cell
            fromDir: 'S',
          });
          openEnds.push({
            x: domino.x - 1,
            y: domino.y,
            value: leftValue, // Value from top cell
            fromDir: 'W',
          });
          openEnds.push({
            x: domino.x - 1,
            y: domino.y + 1,
            value: rightValue, // Value from bottom cell
            fromDir: 'W',
          });
          openEnds.push({
            x: domino.x + 1,
            y: domino.y,
            value: leftValue, // Value from top cell
            fromDir: 'E',
          });
          openEnds.push({
            x: domino.x + 1,
            y: domino.y + 1,
            value: rightValue, // Value from bottom cell
            fromDir: 'E',
          });
        }
        
        console.log('🔍 Generated', openEnds.length, 'open ends for first domino:', openEnds);
        return openEnds;
      }
    }
    
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
    console.log('🔍 FIND LEGAL MOVES called for domino:', dominoData);
    const moves: LegalMove[] = [];
    const selectedIsDouble = isDouble(dominoData);
    console.log('🔍 Is this domino a double?', selectedIsDouble);
    const uniqueEnds: Record<string, boolean> = {};
    const currentState = gameStateRef.current;
    
    // EERSTE DOMINO: Als het bord leeg is, kan de eerste domino in het centrum geplaatst worden
    if (Object.keys(currentState.dominoes).length === 0) {
      const centerX = 0;
      const centerY = 0;
      const orientation = selectedIsDouble ? 'vertical' : 'horizontal';
      
      moves.push({
        end: { x: centerX, y: centerY, value: dominoData.value1, fromDir: 'E' },
        dominoData,
        flipped: false,
        orientation,
        x: centerX,
        y: centerY
      });
      
      return moves;
    }
    
    const openEnds = regenerateOpenEnds(currentState);
    console.log('🔍 LEGAL MOVES DEBUG - Open ends:', openEnds);
    console.log('🔍 LEGAL MOVES DEBUG - Domino data:', dominoData);

    openEnds.forEach((end) => {
      if (uniqueEnds[`${end.x},${end.y}`]) {
        console.log('❌ Skipping duplicate end at:', end.x, end.y);
        return;
      }

      const check = (value: number, flipped: boolean) => {
        console.log(`🔍 Checking end at (${end.x}, ${end.y}) with value ${end.value} against domino value ${value}, flipped: ${flipped}`);
        
        if (end.value === value) {
          console.log(`✅ Value match! Checking placement constraints...`);
          
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

          console.log(`🔍 Keys - from: ${fromCellKey}, to: ${toCellKey}, forward: ${toCellKeyForward}`);
          console.log(`🔍 Dominoes - from: ${!!fromDomino}, to: ${!!toDomino}, forward: ${!!toDominoForward}`);

          if (!fromDomino) {
            console.log(`❌ No fromDomino - rejected`);
            return;
          }
          if (toDomino) {
            console.log(`❌ toDomino exists - rejected`);
            return;
          }
          if (toDominoForward) {
            console.log(`❌ toDominoForward exists - rejected`);
            return;
          }

          if (currentState.forbiddens[toCellKey]) {
            console.log(`❌ Position forbidden - rejected`);
            return;
          }

          if (hasDifferentNeighbor(end.x, end.y)) {
            console.log(`❌ Has different neighbor - rejected`);
            return;
          }

          const orientation = end.fromDir === 'N' || end.fromDir === 'S' ? 'vertical' : 'horizontal';

          if (fromDomino.isSpinner && fromDomino) {
            // Parallel Moves from double items are forbidden.
            if (moves.find(x => x.end.fromDir === end.fromDir && x.fromDomino === fromDomino)) {
              console.log(`❌ Parallel move from spinner - rejected`);
              return;
            }
          }

          if (selectedIsDouble && fromDomino.orientation === 'horizontal' && (end.fromDir === 'N' || end.fromDir === 'S')) {
            console.log(`❌ Double constraint H/NS - rejected`);
            return;
          }
          if (selectedIsDouble && fromDomino.orientation === 'vertical' && (end.fromDir === 'E' || end.fromDir === 'W')) {
            console.log(`❌ Double constraint V/EW - rejected`);
            return;
          }

          let { x, y } = end;
          let finalOrientation: 'horizontal' | 'vertical' = orientation;

          // For doubles, flip the orientation like in original code
          if (selectedIsDouble) {
            finalOrientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
          }

          // KRITIEKE FIX: Consistente positionering en flipping voor alle richtingen
          if (finalOrientation === 'horizontal') {
            if (end.fromDir === 'W') {
              x -= 1; // Plaats links
              flipped = !flipped; // Belangrijk: Flip de steen voor westelijke richting
            }
          } else { // vertical
            if (end.fromDir === 'N') {
              y -= 1; // Plaats boven
              flipped = !flipped; // Belangrijk: Flip de steen voor noordelijke richting
            }
          }

          console.log(`✅ MOVE ACCEPTED! Final position: (${x}, ${y}), orientation: ${finalOrientation}, flipped: ${flipped}`);

          moves.push({ 
            end, 
            dominoData, 
            flipped, 
            orientation: finalOrientation, 
            x, 
            y, 
            fromDomino 
          });

          uniqueEnds[`${end.x},${end.y}`] = true;
        } else {
          console.log(`❌ Value mismatch: ${end.value} !== ${value}`);
        }
      };

      check(dominoData.value1, false);
      check(dominoData.value2, true);
    });

    return moves;
  }, [regenerateOpenEnds, hasDifferentNeighbor]);

  // NEW SIMPLIFIED BLOCKED GAME CHECK - BOARD-BASED
  const checkBlockedGame = useCallback((openEnds: OpenEnd[], board: Record<string, { dominoId: string; value: number }>): boolean => {
    console.log('🔍 CHECKING BLOCKED GAME - Board-based approach');
    console.log('🔍 Open ends:', openEnds);
    
    if (openEnds.length === 0) {
      console.log('❌ No open ends - game is blocked');
      return true;
    }

    // Get all unique open end values
    const uniqueOpenEndValues = [...new Set(openEnds.map(end => end.value))];
    console.log('🔍 Unique open end values:', uniqueOpenEndValues);

    // For each unique open end value, check if all dominoes with that value are already on the board
    for (const value of uniqueOpenEndValues) {
      // Count total dominoes that have this value in a complete domino set
      let totalDominoesWithValue = 0;
      for (let i = 0; i <= 6; i++) {
        if (i === value) totalDominoesWithValue++; // (value, value)
        if (i !== value) totalDominoesWithValue++; // (i, value) where i != value
      }
      
      // Count how many dominoes with this value are already on the board
      let dominoesOnBoardWithValue = 0;
      for (const cellKey in board) {
        if (board[cellKey].value === value) {
          dominoesOnBoardWithValue++;
        }
      }
      
      console.log(`🔍 Value ${value}: ${dominoesOnBoardWithValue}/${totalDominoesWithValue} on board`);
      
      // If not all dominoes with this value are on the board, this end is not blocked
      if (dominoesOnBoardWithValue < totalDominoesWithValue) {
        console.log(`✅ Value ${value} is not blocked - game can continue`);
        return false;
      }
    }
    
    console.log('❌ ALL open end values are blocked - game is blocked');
    return true;
  }, []);

  const executeMove = useCallback((move: LegalMove) => {
    const { index, end, dominoData, flipped, orientation } = move;
    if (index === undefined) {
      return;
    }

    setGameState(prev => {
      const id = `d${prev.nextDominoId}`;
      
      // Gebruik de reeds berekende waarden uit move object zonder verdere aanpassingen
      // De flipped waarde is reeds correct berekend in findLegalMoves
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

      // ROTATIE FIX: Genereer rotatie hier in lokale state
      // Deze rotatie wordt later ook gebruikt voor database synchronisatie
      const dominoRotation = (Math.random() - 0.5) * 15; // Random rotation tussen -7.5 en +7.5 graden

      const dominoState: DominoState = {
        data: dominoData,
        x,
        y,
        orientation,
        flipped: adjustedFlipped,
        isSpinner: isDouble(dominoData),
        rotation: dominoRotation, // Gebruik consistente rotatie
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

      // Check for win condition - if player has no more dominoes
      const isGameWon = newPlayerHand.length === 0;
      
      // Apply Hard Slam effect if activated
      let finalDominoes = { ...prev.dominoes, [id]: dominoState };
      let newState;
      
      if (prev.hardSlamNextMove) {
        console.log('💥 HARD SLAM EFFECT - Starting shake animation and randomizing rotations!');
        
        // Helper function to check if two dominoes overlap after rotation
        const checkOverlap = (domino1: any, domino2: any) => {
          // Simple bounding box check with rotation consideration
          const size1 = domino1.orientation === 'horizontal' ? { w: 88, h: 44 } : { w: 44, h: 88 };
          const size2 = domino2.orientation === 'horizontal' ? { w: 88, h: 44 } : { w: 44, h: 88 };
          
          // Add some padding to prevent tight overlaps
          const padding = 10;
          const distance = Math.sqrt(Math.pow(domino1.x - domino2.x, 2) + Math.pow(domino1.y - domino2.y, 2));
          const minDistance = Math.max(size1.w + size2.w, size1.h + size2.h) / 2 + padding;
          
          return distance < minDistance / 48; // Convert to grid units
        };
        
        // Apply new random rotations to all existing dominoes (not the new one)
        const dominoIds = Object.keys(prev.dominoes);
        dominoIds.forEach((dominoId, index) => {
          let attempts = 0;
          let newRotation;
          let hasOverlap;
          
          do {
            newRotation = (Math.random() - 0.5) * 60; // Random rotation between -30 and +30 degrees
            
            // Create temp domino with new rotation
            const tempDomino = {
              ...finalDominoes[dominoId],
              rotation: newRotation
            };
            
            // Check for overlaps with other dominoes
            hasOverlap = false;
            for (let i = 0; i < dominoIds.length; i++) {
              if (i !== index && dominoIds[i] !== dominoId) {
                const otherDomino = finalDominoes[dominoIds[i]];
                if (checkOverlap(tempDomino, otherDomino)) {
                  hasOverlap = true;
                  break;
                }
              }
            }
            
            attempts++;
          } while (hasOverlap && attempts < 10); // Max 10 attempts to find non-overlapping rotation
          
          // Apply the rotation (even if it still overlaps after 10 attempts, use smaller rotation)
          finalDominoes[dominoId] = {
            ...finalDominoes[dominoId],
            rotation: hasOverlap ? (Math.random() - 0.5) * 30 : newRotation // Smaller rotation if still overlapping
          };
        });
        
        // Geef nieuwe domino ook een rotatie om consistent te zijn
        finalDominoes[id] = {
          ...finalDominoes[id],
          rotation: (Math.random() - 0.5) * 15 // Kleine rotatie voor nieuwe domino
        };
        
        // Create state with hard slam animation active
        newState = {
          ...prev,
          dominoes: finalDominoes,
          board: newBoard,
          playerHand: newPlayerHand,
          selectedHandIndex: null,
          nextDominoId: prev.nextDominoId + 1,
          isGameOver: isGameWon,
          hardSlamNextMove: false, // Reset hard slam flag
          isHardSlamming: true, // Start shake animation
        };
        
        // Stop the shake animation after 1 second
        setTimeout(() => {
          setGameState(currentState => ({
            ...currentState,
            isHardSlamming: false
          }));
        }, 1000);
        
      } else {
        // Regular move without hard slam
        newState = {
          ...prev,
          dominoes: finalDominoes,
          board: newBoard,
          playerHand: newPlayerHand,
          selectedHandIndex: null,
          nextDominoId: prev.nextDominoId + 1,
          isGameOver: isGameWon,
        };
      }
      
      // Generate new open ends and check for blocked game
      const newOpenEnds = regenerateOpenEnds(newState);
      newState.openEnds = newOpenEnds; // FIXED: Actually store the open ends in state
      
      if (!isGameWon) {
        const isBlocked = checkBlockedGame(newOpenEnds, newBoard);
        newState.isGameOver = isBlocked;
      }
      
      return newState;
    });
  }, [regenerateOpenEnds, checkBlockedGame]);

  const drawFromBoneyard = useCallback(() => {
    console.log('🎯 LOCAL DRAW START - boneyard size:', gameStateRef.current.boneyard.length);
    console.log('🎯 LOCAL DRAW START - hand size:', gameStateRef.current.playerHand.length);
    
    if (gameStateRef.current.isGameOver || gameStateRef.current.boneyard.length === 0) {
      console.log('❌ Cannot draw - game over or empty boneyard');
      return;
    }

    setGameState(prev => {
      console.log('🔥 EXECUTING LOCAL DRAW STATE UPDATE');
      console.log('🔥 Before draw - hand size:', prev.playerHand.length);
      console.log('🔥 Before draw - boneyard size:', prev.boneyard.length);
      
      // Draw a domino from the boneyard
      const drawnDomino = prev.boneyard[prev.boneyard.length - 1];
      const newPlayerHand = [...prev.playerHand, drawnDomino];
      const newBoneyard = prev.boneyard.slice(0, -1);
      
      console.log('🎯 Drawn domino:', drawnDomino);
      console.log('🔥 After draw - hand size:', newPlayerHand.length);
      console.log('🔥 After draw - boneyard size:', newBoneyard.length);
      
      // Check if the newly drawn domino can be played
      const openEnds = regenerateOpenEnds(prev);
      const canPlay = openEnds.some(end => 
        drawnDomino.value1 === end.value || drawnDomino.value2 === end.value
      );
      
      // If the drawn domino can be played, auto-select it
      const selectedIndex = canPlay ? newPlayerHand.length - 1 : prev.selectedHandIndex;
      
      const newState = {
        ...prev,
        playerHand: newPlayerHand,
        boneyard: newBoneyard,
        selectedHandIndex: selectedIndex,
        // Don't change current player - only change when a domino is actually played
      };
      
      // After drawing, if boneyard is now empty, check if the game is blocked using board-based approach
      if (newBoneyard.length === 0) {
        const isBlocked = checkBlockedGame(openEnds, prev.board);
        newState.isGameOver = isBlocked;
      }
      
      console.log('✅ LOCAL DRAW COMPLETE - returning new state');
      return newState;
    });
  }, [regenerateOpenEnds, checkBlockedGame]);

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
    regenerateOpenEnds: (state?: GameState) => regenerateOpenEnds(state || gameStateRef.current),
    hardSlam: () => {
      // Activate hard slam for next move (don't apply immediately)
      setGameState(prevState => ({
        ...prevState,
        hardSlamNextMove: true,
        hardSlamUsesRemaining: Math.max(0, (prevState.hardSlamUsesRemaining || 0) - 1)
      }));
    },
  };
};
