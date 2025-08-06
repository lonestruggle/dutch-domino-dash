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
    headTailDistance: 3,
    headTailProtectionEnabled: true,
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
      headTailDistance: 3,
      headTailProtectionEnabled: true,
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
      headTailDistance: 3,
      headTailProtectionEnabled: true,
    });
  }, [resetGame]);

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

  const regenerateOpenEnds = useCallback((state: GameState): OpenEnd[] => {
    console.log('🔍 REGENERATE OPEN ENDS - Starting calculation');
    console.log('🔍 Total dominoes on board:', Object.keys(state.dominoes).length);
    console.log('🔍 Board cells:', Object.keys(state.board).length);
    
    const openEnds: OpenEnd[] = [];
    const boardCoords = Object.keys(state.board);
    
    // Special case: first domino should have two open ends
    if (boardCoords.length === 1) {
      const coord = boardCoords[0];
      const [x, y] = coord.split(',').map(Number);
      const cell = state.board[coord];
      const domino = state.dominoes[cell.dominoId];
      
      console.log(`🔍 Single domino case: ${domino.data.value1}|${domino.data.value2}`);
      
      if (!isDouble(domino.data)) {
        // First non-double domino has two open ends
        if (domino.orientation === 'horizontal') {
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
    
    // Find true chain ends - only cells that can actually have dominoes placed
    for (const coord in state.board) {
      const [x, y] = coord.split(',').map(Number);
      const cell = state.board[coord];
      const domino = state.dominoes[cell.dominoId];

      console.log(`🔍 Checking cell (${x},${y}) with value ${cell.value} from domino ${domino.data.value1}|${domino.data.value2}`);

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
          console.log(`🔍 Position (${nx},${ny}) is occupied, skipping`);
          continue;
        }

        // Apply the same validation as findLegalMoves
        
        // Check if forbidden
        if (state.forbiddens[neighborKey]) {
          console.log(`🔍 Position (${nx},${ny}) is forbidden, skipping`);
          continue;
        }

        // Check hasDifferentNeighbor (more than 3 neighbors blocks placement)
        if (hasDifferentNeighbor(nx, ny)) {
          console.log(`🔍 Position (${nx},${ny}) has too many neighbors, skipping`);
          continue;
        }

        // Check collision with forward position (same as findLegalMoves)
        const toCellKeyForward = {
          N: `${nx},${ny - 1}`,
          S: `${nx},${ny + 1}`,
          W: `${nx - 1},${ny}`,
          E: `${nx + 1},${ny}`,
        }[dir];

        if (toCellKeyForward && state.board[toCellKeyForward]) {
          console.log(`🔍 Forward position ${toCellKeyForward} blocked for direction ${dir}`);
          continue;
        }

        // Check double domino connection rules
        if (isDouble(domino.data)) {
          const isVertical = domino.orientation === 'vertical';
          
          // Non-spinner doubles only connect perpendicular to their orientation
          if (
            (isVertical && (dir === 'N' || dir === 'S')) ||
            (!isVertical && (dir === 'W' || dir === 'E'))
          ) {
            console.log(`🔍 Double domino orientation rule blocks direction ${dir}`);
            continue;
          }
        }

        // Use the cell value directly - this is already correctly set when domino was placed
        let edgeValue = cell.value;
        
        console.log(`🔍 VALID OPEN END FOUND: (${nx},${ny}) value:${edgeValue} from:${dir} (from cell ${coord})`);
        
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
  }, [hasDifferentNeighbor]);

  // EXACT COPY FROM YOUR ORIGINAL CODE
  const findLegalMoves = useCallback((dominoData: DominoData): LegalMove[] => {
    const moves: LegalMove[] = [];
    const selectedIsDouble = isDouble(dominoData);
    const uniqueEnds: Record<string, boolean> = {};
    const currentState = gameStateRef.current;
    
    console.log(`🎲 FINDING LEGAL MOVES for ${dominoData.value1}|${dominoData.value2}`);
    console.log(`🎲 Total dominoes on board: ${Object.keys(currentState.dominoes).length}`);
    console.log(`🎲 Is double: ${selectedIsDouble}`);
    
    // EERSTE DOMINO: Als het bord leeg is, kan de eerste domino overal geplaatst worden
    if (Object.keys(currentState.dominoes).length === 0) {
      const orientation = selectedIsDouble ? 'vertical' : 'horizontal';
      
      // Maak een grid van mogelijke posities rond het zichtbare gebied
      for (let x = -10; x <= 10; x += 2) {
        for (let y = -10; y <= 10; y += 2) {
          moves.push({
            end: { x: x, y: y, value: dominoData.value1, fromDir: 'E' },
            dominoData,
            flipped: false,
            orientation,
            x: x,
            y: y
          });
        }
      }
      
      console.log(`🎲 Empty board: generated ${moves.length} moves`);
      return moves;
    }
    
    
    const openEnds = regenerateOpenEnds(currentState);
    console.log(`🎲 Found ${openEnds.length} open ends:`, openEnds.map(end => `(${end.x},${end.y}) value:${end.value}`));

    // NIEUWE LOGICA: Voorkom dat kop en staart naar elkaar toe bouwen
    const preventHeadTailCollision = (candidateMove: any, allOpenEnds: OpenEnd[]) => {
      const totalDominoes = Object.keys(currentState.dominoes).length;
      
      console.log(`🎲 Collision check: ${totalDominoes} dominoes, isDouble: ${isDouble(candidateMove.dominoData)}, protection: ${currentState.headTailProtectionEnabled}`);
      
      // Check if protection is disabled
      if (!currentState.headTailProtectionEnabled) {
        console.log(`🎲 ✅ ALLOWED: Head-tail protection is disabled`);
        return true;
      }
      
      // UITZONDERING 1: Eerste 3 stenen mogen overal
      if (totalDominoes <= 2) { // Aangepast van 3 naar 2 omdat we de 3e steen willen plaatsen
        console.log(`🎲 ✅ ALLOWED: First 3 stones exception (currently ${totalDominoes})`);
        return true;
      }
      
      // UITZONDERING 2: Dubbele stenen mogen altijd (hebben voorrang)
      if (isDouble(candidateMove.dominoData)) {
        console.log(`🎲 ✅ ALLOWED: Double domino exception`);
        return true;
      }
      
      // Alleen controleren als er precies 2 open ends zijn (kop en staart)
      if (allOpenEnds.length !== 2) {
        console.log(`🎲 ✅ ALLOWED: Not head-tail situation (${allOpenEnds.length} open ends)`);
        return true;
      }
      
      const [end1, end2] = allOpenEnds;
      
      // Bepaal welk end we gebruiken voor deze move
      const currentEnd = candidateMove.end;
      const otherEnd = allOpenEnds.find(end => 
        !(end.x === currentEnd.x && end.y === currentEnd.y)
      );
      
      if (!otherEnd) {
        return true;
      }
      
      // Bereken waar deze move zou worden geplaatst (beide cellen van de domino)
      const moveCells = candidateMove.orientation === 'horizontal' 
        ? [
            { x: candidateMove.x, y: candidateMove.y },
            { x: candidateMove.x + 1, y: candidateMove.y }
          ]
        : [
            { x: candidateMove.x, y: candidateMove.y },
            { x: candidateMove.x, y: candidateMove.y + 1 }
          ];
      
      // Check of een van de cellen van deze move binnen de geconfigureerde afstand van het andere open end komt
      const tooClose = moveCells.some(cell => {
        const distance = Math.abs(cell.x - otherEnd.x) + Math.abs(cell.y - otherEnd.y);
        return distance <= currentState.headTailDistance;
      });
      
      if (tooClose) {
        console.log(`🚫 BLOCKED: Move would bring head/tail within ${currentState.headTailDistance} grids of each other`);
        return false;
      }
      
      console.log(`🎲 ✅ ALLOWED: Distance check passed`);
      return true;
    };

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
      
      // Check beide condities: blokkering EN kop/staart collision
      if (validMove && preventHeadTailCollision(validMove, openEnds)) {
        moves.push(validMove);
        uniqueEnds[`${end.x},${end.y}`] = true;
      }
    });

    // PRIORITEIT: Dubbele stenen krijgen voorrang (alle dubbels hebben gelijke prioriteit)
    moves.sort((a, b) => {
      const aIsDouble = a.dominoData.value1 === a.dominoData.value2;
      const bIsDouble = b.dominoData.value1 === b.dominoData.value2;
      
      // Eerst: dubbels vs niet-dubbels (alle dubbels hebben gelijke prioriteit)
      if (aIsDouble && !bIsDouble) return -1; // Dubbel eerst
      if (!aIsDouble && bIsDouble) return 1;  // Dubbel eerst
      
      // Binnen dubbels: geen specifieke volgorde, behoud originele volgorde
      if (aIsDouble && bIsDouble) return 0;
      
      // Binnen niet-dubbels: som van waarden (hoogste eerst)
      const aSum = a.dominoData.value1 + a.dominoData.value2;
      const bSum = b.dominoData.value1 + b.dominoData.value2;
      return bSum - aSum;
    });

    return moves;
  }, [regenerateOpenEnds, hasDifferentNeighbor]);

  // KOPIE VAN findLegalMoves - VOOR ALTIJD TONEN BLUE LEGAL MOVES
  const findAllPossibleMoves = useCallback((): LegalMove[] => {
    const moves: LegalMove[] = [];
    const currentState = gameStateRef.current;
    
    // Voor elke steen in de hand, bereken alle mogelijke zetten
    currentState.playerHand.forEach((dominoData, index) => {
      const dominoMoves = findLegalMoves(dominoData).map(move => ({
        ...move,
        index
      }));
      moves.push(...dominoMoves);
    });
    
    // PRIORITEIT: Dubbele stenen krijgen voorrang (alle dubbels hebben gelijke prioriteit)  
    moves.sort((a, b) => {
      const aIsDouble = a.dominoData.value1 === a.dominoData.value2;
      const bIsDouble = b.dominoData.value1 === b.dominoData.value2;
      
      if (aIsDouble && !bIsDouble) return -1; // Dubbel eerst
      if (!aIsDouble && bIsDouble) return 1;  // Dubbel eerst
      
      // Binnen dubbels: geen specifieke volgorde
      if (aIsDouble && bIsDouble) return 0;
      
      // Binnen niet-dubbels: hoogste waarden eerst
      const aSum = a.dominoData.value1 + a.dominoData.value2;
      const bSum = b.dominoData.value1 + b.dominoData.value2;
      return bSum - aSum;
    });
    
    return moves;
  }, [findLegalMoves]);

  // BLOCKED GAME CHECK: Game is only blocked if NO moves possible AND boneyard is empty
  const checkBlockedGame = useCallback((openEnds: OpenEnd[], board: Record<string, { dominoId: string; value: number }>, allPlayerHands: DominoData[][], boneyard: DominoData[]): boolean => {
    console.log('🔍 CHECKING BLOCKED GAME - Using findLegalMoves for each tile');
    console.log('🔍 All player hands:', allPlayerHands.map((hand, i) => `Player ${i}: ${hand.length} tiles`));
    console.log('🔍 Boneyard:', boneyard.length, 'tiles');
    
    // IMPORTANT: If board is empty, game cannot be blocked
    const boardHasDominoes = Object.keys(board).length > 0;
    if (!boardHasDominoes) {
      console.log('✅ Board is empty - game cannot be blocked');
      return false;
    }
    
    // CRITICAL: If boneyard still has tiles, game cannot be blocked
    // Players should draw from boneyard until they can play or boneyard is empty
    if (boneyard.length > 0) {
      console.log('✅ Boneyard still has tiles - game cannot be blocked (should draw instead)');
      return false;
    }
    
    // Only check for blocked game if boneyard is empty
    console.log('🔍 Boneyard is empty - checking if any players can make moves...');
    
    // Check all players' hands for legal moves
    for (let playerIndex = 0; playerIndex < allPlayerHands.length; playerIndex++) {
      const hand = allPlayerHands[playerIndex];
      console.log(`🔍 Checking Player ${playerIndex} hand:`, hand);
      
      for (let tileIndex = 0; tileIndex < hand.length; tileIndex++) {
        const tile = hand[tileIndex];
        const legalMoves = findLegalMoves(tile);
        
        if (legalMoves.length > 0) {
          console.log(`✅ Player ${playerIndex} can place tile [${tile.value1}|${tile.value2}] - ${legalMoves.length} legal moves found`);
          return false; // Game is NOT blocked
        }
      }
    }
    
    console.log('❌ NO LEGAL MOVES FOUND AND BONEYARD EMPTY - Game is BLOCKED');
    return true; // Game is blocked

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
          // Mark the double domino positions themselves as forbidden first
          prev.forbiddens[`${x},${y}`] = true;
          if (orientation === 'horizontal') {
            prev.forbiddens[`${x + 1},${y}`] = true;
          } else {
            prev.forbiddens[`${x},${y + 1}`] = true;
          }
          
          // Then add comprehensive forbidden positions around it
          let dir = end.fromDir;
          if (dir === 'N') {
            // Forbidden positions around North direction for doubles
            prev.forbiddens[`${x - 1},${y + 2}`] = true;
            prev.forbiddens[`${x + 1},${y + 2}`] = true;
            prev.forbiddens[`${x - 1},${y + 1}`] = true;
            prev.forbiddens[`${x + 1},${y + 1}`] = true;
            prev.forbiddens[`${x - 1},${y}`] = true;     // Direct adjacent
            prev.forbiddens[`${x + 1},${y}`] = true;     // Direct adjacent
            prev.forbiddens[`${x},${y + 3}`] = true;
            prev.forbiddens[`${x},${y + 2}`] = true;
          }
          if (dir === 'S') {
            // Forbidden positions around South direction for doubles
            prev.forbiddens[`${x - 1},${y - 1}`] = true;
            prev.forbiddens[`${x + 1},${y - 1}`] = true;
            prev.forbiddens[`${x - 1},${y - 2}`] = true;
            prev.forbiddens[`${x + 1},${y - 2}`] = true;
            prev.forbiddens[`${x - 1},${y}`] = true;     // Direct adjacent
            prev.forbiddens[`${x + 1},${y}`] = true;     // Direct adjacent
            prev.forbiddens[`${x},${y - 2}`] = true;
            prev.forbiddens[`${x},${y - 3}`] = true;
          }
          if (dir === 'E') {
            // Forbidden positions around East direction for doubles
            prev.forbiddens[`${x - 1},${y + 1}`] = true;
            prev.forbiddens[`${x - 1},${y - 1}`] = true;
            prev.forbiddens[`${x - 2},${y + 1}`] = true;
            prev.forbiddens[`${x - 2},${y - 1}`] = true;
            prev.forbiddens[`${x},${y + 1}`] = true;     // Direct adjacent
            prev.forbiddens[`${x},${y - 1}`] = true;     // Direct adjacent
            prev.forbiddens[`${x - 2},${y}`] = true;
            prev.forbiddens[`${x - 3},${y}`] = true;
          }
          if (dir === 'W') {
            // Forbidden positions around West direction for doubles
            prev.forbiddens[`${x + 1},${y + 1}`] = true;
            prev.forbiddens[`${x + 1},${y - 1}`] = true;
            prev.forbiddens[`${x + 2},${y + 1}`] = true;
            prev.forbiddens[`${x + 2},${y - 1}`] = true;
            prev.forbiddens[`${x},${y + 1}`] = true;     // Direct adjacent
            prev.forbiddens[`${x},${y - 1}`] = true;     // Direct adjacent
            prev.forbiddens[`${x + 2},${y}`] = true;
            prev.forbiddens[`${x + 3},${y}`] = true;
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

  // New function to draw a specific domino from boneyard by index
  const drawSpecificFromBoneyard = useCallback((index: number) => {
    console.log('🎯 DRAW SPECIFIC START - index:', index, 'boneyard size:', gameStateRef.current.boneyard.length);
    
    if (gameStateRef.current.isGameOver || gameStateRef.current.boneyard.length === 0 || index >= gameStateRef.current.boneyard.length) {
      console.log('❌ Cannot draw specific - invalid conditions');
      return;
    }

    setGameState(prev => {
      // Draw the specific domino from the boneyard
      const drawnDomino = prev.boneyard[index];
      const newPlayerHand = [...prev.playerHand, drawnDomino];
      const newBoneyard = prev.boneyard.filter((_, i) => i !== index);
      
      console.log('🎯 Drawn specific domino:', drawnDomino);
      
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
      };
      
      // Check if the game is blocked
      const boardHasDominoes = Object.keys(prev.board).length > 0;
      const allHands = prev.playerHands || [newPlayerHand];
      const isBlocked = boardHasDominoes && checkBlockedGame(openEnds, prev.board, allHands, newBoneyard);
      if (isBlocked) {
        console.log('🔄 Game is blocked after drawing from boneyard');
        newState.isGameOver = isBlocked;
      }
      
      return newState;
    });
  }, [regenerateOpenEnds, checkBlockedGame]);

  // Function to rotate a domino on the board
  const rotateDomino = useCallback((dominoId: string) => {
    setGameState(prev => {
      const domino = prev.dominoes[dominoId];
      if (!domino) return prev;
      
      // Check if rotation is possible (not if it would cause collision)
      const newOrientation: 'horizontal' | 'vertical' = domino.orientation === 'horizontal' ? 'vertical' : 'horizontal';
      
      // Calculate new position to avoid collisions
      let newX = domino.x;
      let newY = domino.y;
      
      // For doubles, adjust position when rotating
      if (isDouble(domino.data)) {
        if (domino.orientation === 'horizontal' && newOrientation === 'vertical') {
          // Horizontal double to vertical - might need to adjust Y
          // Keep the center point the same
        } else if (domino.orientation === 'vertical' && newOrientation === 'horizontal') {
          // Vertical double to horizontal - might need to adjust X
          // Keep the center point the same
        }
      }
      
      // Create new domino state
      const rotatedDomino = {
        ...domino,
        orientation: newOrientation,
        x: newX,
        y: newY
      };
      
      // Update board cells
      const newBoard = { ...prev.board };
      const newDominoes = { ...prev.dominoes };
      
      // Remove old board positions
      const oldCells = domino.orientation === 'horizontal' 
        ? [`${domino.x},${domino.y}`, `${domino.x + 1},${domino.y}`]
        : [`${domino.x},${domino.y}`, `${domino.x},${domino.y + 1}`];
      
      oldCells.forEach(cell => delete newBoard[cell]);
      
      // Add new board positions
      const pips = domino.flipped ? [domino.data.value2, domino.data.value1] : [domino.data.value1, domino.data.value2];
      const newCells = newOrientation === 'horizontal' 
        ? [`${newX},${newY}`, `${newX + 1},${newY}`]
        : [`${newX},${newY}`, `${newX},${newY + 1}`];
      
      newCells.forEach((cell, index) => {
        newBoard[cell] = { dominoId, value: pips[index] };
      });
      
      newDominoes[dominoId] = rotatedDomino;
      
      // Regenerate open ends
      const tempState = { ...prev, dominoes: newDominoes, board: newBoard };
      const newOpenEnds = regenerateOpenEnds(tempState);
      
      return {
        ...tempState,
        openEnds: newOpenEnds,
      };
    });
  }, [regenerateOpenEnds]);

  return {
    gameState,
    setGameState,
    startGame,
    placeDominoOnGrid,
    findLegalMoves,
    findAllPossibleMoves, // NIEUWE FUNCTIE VOOR ALTIJD TONEN BLUE MOVES
    executeMove,
    drawFromBoneyard,
    drawSpecificFromBoneyard,
    selectHandDomino,
    resetGame,
    rotateDomino,
    hasDifferentNeighbor: (x: number, y: number) => hasDifferentNeighbor(x, y),
    regenerateOpenEnds: (state?: GameState) => regenerateOpenEnds(state || gameStateRef.current),
    manualBlockedCheck: () => {
      const currentState = gameStateRef.current;
      const openEnds = regenerateOpenEnds(currentState);
      const allHands = currentState.playerHands || [currentState.playerHand];
      const isBlocked = checkBlockedGame(openEnds, currentState.board, allHands, currentState.boneyard);
      
      console.log('🔧 MANUAL BLOCKED CHECK:', isBlocked ? 'BLOCKED' : 'NOT BLOCKED');
      
      setGameState(prev => ({
        ...prev,
        isGameOver: isBlocked
      }));
    },
    hardSlam: () => {
      // Activate hard slam for next move (don't apply immediately)
      setGameState(prevState => ({
        ...prevState,
        hardSlamNextMove: true,
        hardSlamUsesRemaining: Math.max(0, (prevState.hardSlamUsesRemaining || 0) - 1)
      }));
    },
    // New functions for head-tail distance control
    setHeadTailDistance: (distance: number) => {
      setGameState(prev => ({
        ...prev,
        headTailDistance: distance
      }));
    },
    setHeadTailProtectionEnabled: (enabled: boolean) => {
      setGameState(prev => ({
        ...prev,
        headTailProtectionEnabled: enabled
      }));
    },
  };
};
