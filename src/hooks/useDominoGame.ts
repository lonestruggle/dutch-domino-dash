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

  const regenerateOpenEnds = useCallback((state: GameState): OpenEnd[] => {
    console.log('🔍 REGENERATE OPEN ENDS - Starting calculation');
    console.log('🔍 Total dominoes on board:', Object.keys(state.dominoes).length);
    console.log('🔍 Board cells:', Object.keys(state.board).length);
    
    const openEnds: OpenEnd[] = [];
    const boardCoords = Object.keys(state.board);
    
    // Log all dominoes on board
    Object.values(state.dominoes).forEach(domino => {
      console.log(`🔍 Domino on board: ${domino.data.value1}|${domino.data.value2} at (${domino.x},${domino.y}) ${domino.orientation} flipped:${domino.flipped}`);
    });
    
    // Special case: first non-double domino should have two open ends
    if (boardCoords.length === 1) {
      const coord = boardCoords[0];
      const [x, y] = coord.split(',').map(Number);
      const cell = state.board[coord];
      const domino = state.dominoes[cell.dominoId];
      
      console.log(`🔍 Single domino case: ${domino.data.value1}|${domino.data.value2}`);
      
      if (!isDouble(domino.data)) {
        // First non-double domino has two open ends
        if (domino.orientation === 'horizontal') {
          // East and West ends
          openEnds.push({
            x: x + 1,
            y: y,
            value: domino.flipped ? domino.data.value1 : domino.data.value2,
            fromDir: 'E',
          });
          openEnds.push({
            x: x - 1,
            y: y,
            value: domino.flipped ? domino.data.value2 : domino.data.value1,
            fromDir: 'W',
          });
        } else {
          // North and South ends
          openEnds.push({
            x: x,
            y: y - 1,
            value: domino.flipped ? domino.data.value1 : domino.data.value2,
            fromDir: 'N',
          });
          openEnds.push({
            x: x,
            y: y + 1,
            value: domino.flipped ? domino.data.value2 : domino.data.value1,
            fromDir: 'S',
          });
        }
        console.log(`🔍 Single domino open ends:`, openEnds);
        return openEnds;
      }
    }
    
    // Process each cell on the board
    for (const coord in state.board) {
      const [x, y] = coord.split(',').map(Number);
      const cell = state.board[coord];
      const domino = state.dominoes[cell.dominoId];

      console.log(`🔍 Processing cell (${x},${y}) with value ${cell.value} from domino ${domino.data.value1}|${domino.data.value2}`);

      const neighbors = {
        N: [x, y - 1],
        S: [x, y + 1],
        W: [x - 1, y],
        E: [x + 1, y],
      };

      for (const dir in neighbors) {
        const [nx, ny] = neighbors[dir as keyof typeof neighbors];
        const neighborKey = `${nx},${ny}`;
        
        // Skip if neighbor position is occupied
        if (state.board[neighborKey]) {
          console.log(`🔍   Direction ${dir} -> (${nx},${ny}) OCCUPIED`);
          continue;
        }

        // Check double domino connection rules
        if (isDouble(domino.data)) {
          const isVertical = domino.orientation === 'vertical';
          console.log(`🔍   Double domino ${domino.data.value1}|${domino.data.value2} orientation: ${domino.orientation}`);
          
          // Non-spinner doubles only connect perpendicular to their orientation
          if (
            (isVertical && (dir === 'N' || dir === 'S')) ||
            (!isVertical && (dir === 'W' || dir === 'E'))
          ) {
            console.log(`🔍   Direction ${dir} BLOCKED by double orientation rule`);
            continue;
          }
        }

        console.log(`🔍   Direction ${dir} -> (${nx},${ny}) OPEN END with value ${cell.value}`);
        
        // CRITICAL FIX: We need to determine which VALUE is at the EDGE of this cell
        // The cell.value shows what's IN this cell, but we need the value that connects OUTWARD
        const dominoData = domino.data;
        const isHorizontal = domino.orientation === 'horizontal';
        const isFlipped = domino.flipped;
        
        let edgeValue = cell.value; // Default to cell value, but we might need to adjust
        
        // For non-double dominoes, we need to figure out which value faces which direction
        if (!isDouble(dominoData)) {
          // Determine which value of the domino faces which direction
          const [leftTopValue, rightBottomValue] = isFlipped ? [dominoData.value2, dominoData.value1] : [dominoData.value1, dominoData.value2];
          
          if (isHorizontal) {
            // Horizontal domino: left side has leftTopValue, right side has rightBottomValue
            const isLeftCell = coord === `${domino.x},${domino.y}`;
            const isRightCell = coord === `${domino.x + 1},${domino.y}`;
            
            if (dir === 'W' && isLeftCell) edgeValue = leftTopValue;
            else if (dir === 'E' && isRightCell) edgeValue = rightBottomValue;
            else if (dir === 'W' && isRightCell) edgeValue = rightBottomValue; // From right cell looking west
            else if (dir === 'E' && isLeftCell) edgeValue = rightBottomValue; // From left cell looking east
          } else {
            // Vertical domino: top has leftTopValue, bottom has rightBottomValue
            const isTopCell = coord === `${domino.x},${domino.y}`;
            const isBottomCell = coord === `${domino.x},${domino.y + 1}`;
            
            if (dir === 'N' && isTopCell) edgeValue = leftTopValue;
            else if (dir === 'S' && isBottomCell) edgeValue = rightBottomValue;
            else if (dir === 'N' && isBottomCell) edgeValue = rightBottomValue; // From bottom cell looking north
            else if (dir === 'S' && isTopCell) edgeValue = rightBottomValue; // From top cell looking south
          }
        }
        
        console.log(`🔍   CORRECTED EDGE VALUE: ${edgeValue} (was ${cell.value})`);
        
        openEnds.push({
          x: nx,
          y: ny,
          value: edgeValue,
          fromDir: dir as 'N' | 'S' | 'E' | 'W',
        });
      }
    }

    console.log('🔍 FINAL OPEN ENDS:', openEnds.map(end => `(${end.x},${end.y}) value:${end.value} from:${end.fromDir}`));
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

    openEnds.forEach((end) => {
      if (uniqueEnds[`${end.x},${end.y}`]) {
        return;
      }

      let validMove: LegalMove | null = null;
      
      const check = (value: number, flipped: boolean) => {
        if (end.value === value && !validMove) { // Only check if we haven't found a valid move yet
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

          // Store the valid move but don't add it yet
          validMove = { 
            end, 
            dominoData, 
            flipped, 
            orientation: finalOrientation, 
            x, 
            y, 
            fromDomino 
          };
        }
      };

      // Try both values, but only add the first valid one
      check(dominoData.value1, false);
      check(dominoData.value2, true);
      
      // If we found a valid move, add it and mark the position as used
      if (validMove) {
        moves.push(validMove);
        uniqueEnds[`${end.x},${end.y}`] = true;
      }
    });

    return moves;
  }, [regenerateOpenEnds, hasDifferentNeighbor]);

  // BLOCKED GAME CHECK: Adapted from findLegalMoves logic
  const checkBlockedGame = useCallback((openEnds: OpenEnd[], board: Record<string, { dominoId: string; value: number }>, allPlayerHands: DominoData[][], boneyard: DominoData[]): boolean => {
    console.log('🔍 CHECKING BLOCKED GAME - Using findLegalMoves logic approach');
    console.log('🔍 Open ends received:', openEnds);
    console.log('🔍 All player hands:', allPlayerHands.map((hand, i) => `Player ${i}: ${hand.length} tiles`));
    console.log('🔍 Boneyard:', boneyard.length, 'tiles');
    
    if (openEnds.length === 0) {
      console.log('❌ No open ends - game is blocked');
      return true;
    }

    // There should only be 2 open ends in a proper domino game
    if (openEnds.length !== 2) {
      console.log(`⚠️ Expected 2 open ends but got ${openEnds.length} - continuing with analysis`);
    }

    // Extract the required values from open ends
    const requiredValues = openEnds.map(end => end.value);
    console.log('🔍 Required values from open ends:', requiredValues);

    // Check if all open ends require the same value
    const uniqueValues = new Set(requiredValues);
    if (uniqueValues.size === 1) {
      const requiredValue = requiredValues[0];
      console.log(`🔍 All open ends require value: ${requiredValue}`);
      
      // Count how many tiles with this value are already on the board
      let tilesOnBoard = 0;
      Object.values(board).forEach(cell => {
        if (cell.value === requiredValue) {
          tilesOnBoard++;
        }
      });
      
      console.log(`🔍 Tiles with value ${requiredValue} on board: ${tilesOnBoard}/7`);
      
      // If all 7 tiles of this value are on the board, game is blocked
      if (tilesOnBoard >= 7) {
        console.log(`❌ Game is BLOCKED - All 7 tiles with value ${requiredValue} are on the board`);
        return true;
      }
    } else {
      console.log('🔍 Open ends require different values:', Array.from(uniqueValues));
    }

    // Check if ANY player has a matching domino using findLegalMoves logic
    for (let playerIndex = 0; playerIndex < allPlayerHands.length; playerIndex++) {
      const playerHand = allPlayerHands[playerIndex];
      
      for (const domino of playerHand) {
        // Use the same logic as findLegalMoves to check if this domino can be placed
        const foundValidMove = openEnds.some(end => {
          // Check if domino matches this open end (same logic as findLegalMoves)
          return (end.value === domino.value1) || (end.value === domino.value2);
        });
        
        if (foundValidMove) {
          console.log(`✅ Game NOT blocked - Player ${playerIndex} has matching domino ${domino.value1}|${domino.value2}`);
          return false;
        }
      }
    }

    // Check if boneyard has any matching dominoes using same logic
    for (const domino of boneyard) {
      const foundValidMove = openEnds.some(end => {
        return (end.value === domino.value1) || (end.value === domino.value2);
      });
      
      if (foundValidMove) {
        console.log(`✅ Game NOT blocked - Boneyard has matching domino ${domino.value1}|${domino.value2}`);
        return false;
      }
    }

    console.log('❌ Game is BLOCKED - No player hands or boneyard have matching dominoes');
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

      // Skip forbidden positions for the very first domino
      const isFirstDomino = Object.keys(prev.dominoes).length === 0;
      
      if (!isFirstDomino) {
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
        // For single player mode, create array with just the player hand
        const allHands = newState.playerHands || [newPlayerHand];
        const isBlocked = checkBlockedGame(newOpenEnds, newBoard, allHands, newState.boneyard);
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
      
      // After drawing, check if the game is blocked (no boneyard left and no valid moves)
      // BUT ONLY if there are actually dominoes on the board (game has started)
      const boardHasDominoes = Object.keys(prev.board).length > 0;
      const allHands = prev.playerHands || [newPlayerHand];
      const isBlocked = boardHasDominoes && checkBlockedGame(openEnds, prev.board, allHands, newBoneyard);
      newState.isGameOver = isBlocked;
      
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
