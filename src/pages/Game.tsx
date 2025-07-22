import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { DominoGame } from '@/components/DominoGame';
import { useSyncedDominoGameState } from '@/hooks/useSyncedDominoGameState';
import { useDominoGame } from '@/hooks/useDominoGame';
import { useBotManager } from '@/hooks/useBotManager';

interface GameData {
  id: string;
  lobby_id: string;
  status: string;
  current_player_turn: number;
  game_state: any;
  winner_position: number | null;
  background_choice?: string;
}

export default function Game() {
  const params = useParams();
  const gameId = params.gameId;
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);
  const [ignoringSync, setIgnoringSync] = useState(false); // Flag to ignore sync during our own updates

  console.log('Game params:', params);
  console.log('Game ID extracted:', gameId);

  // Initialize synced game state hook
  const syncedGameHook = useSyncedDominoGameState(
    (gameId && isAuthenticated) ? gameId : '', 
    (user?.id && isAuthenticated) ? user.id : '',
    ignoringSync // Pass ignore flag to prevent realtime sync during our updates
  );

  // Initialize local domino game logic
  const dominoGameHook = useDominoGame();

  // Sync database state to local state - COMPLETE SYNC FOR ALL PLAYERS
  useEffect(() => {
    // Don't sync if we're in the middle of our own update
    if (ignoringSync) {
      console.log('🚫 Ignoring sync - we are updating');
      return;
    }
    
    if (syncedGameHook.syncState.gameState && !syncedGameHook.syncState.isLoading) {
      console.log('🔄 Complete sync from database to local state');
      
      const dbState = syncedGameHook.syncState.gameState;
      const myPosition = syncedGameHook.syncState.playerPosition;
      
      // ALWAYS sync the complete state from database
      // All players must see exactly the same board, boneyard, dominoes
      dominoGameHook.setGameState({
        // Shared state (must be identical for all players)
        board: dbState.board || {},
        dominoes: dbState.dominoes || {},
        boneyard: dbState.boneyard || [],
        openEnds: dbState.openEnds || [],
        forbiddens: dbState.forbiddens || {},
        nextDominoId: dbState.nextDominoId || 0,
        spinnerId: dbState.spinnerId || null,
        isGameOver: dbState.isGameOver || false,
        currentPlayer: dbState.currentPlayer || 0,
        
        // Player specific data
        playerHand: (dbState as any).playerHands?.[myPosition] || [],
        playerHands: (dbState as any).playerHands || [],
        selectedHandIndex: null // Reset selection on sync
      });
      
      console.log('✅ Complete sync done - all players see same state');
    }
  }, [syncedGameHook.syncState.gameState, syncedGameHook.syncState.isLoading, syncedGameHook.syncState.playerPosition, ignoringSync]);

  // Wrap executeMove to also update database - SIMPLIFIED SYNC
  const wrappedExecuteMove = useCallback(async (move: any) => {
    console.log('🎯 Move attempt:', move);
    
    // Input validation - sanitize move data
    if (!move || typeof move !== 'object') {
      console.log('❌ Invalid move data');
      toast({
        title: "Invalid move",
        description: "Move data is invalid",
        variant: "destructive"
      });
      return;
    }

    // Validate move structure
    if (!move.end || typeof move.end.x !== 'number' || typeof move.end.y !== 'number') {
      console.log('❌ Invalid move coordinates');
      toast({
        title: "Invalid move",
        description: "Invalid move coordinates",
        variant: "destructive"
      });
      return;
    }

    // Check if it's the current player's turn - only for human players
    const currentPlayerPosition = syncedGameHook.syncState.playerPosition;
    const currentPlayerTurn = syncedGameHook.syncState.currentPlayer;
    
    // Only check turn for human players (not bots)
    const isBot = move.isBot || false;
    if (!isBot && currentPlayerPosition !== currentPlayerTurn) {
      console.log('❌ Not your turn!');
      toast({
        title: "Not your turn",
        description: "Wait for your turn to play",
        variant: "destructive"
      });
      return;
    }

    // Server-side validation via database function - skip for bots
    if (!isBot) {
      try {
        const { data: isValidMove, error } = await supabase
          .rpc('validate_game_move', {
            _game_id: game?.id,
            _player_position: currentPlayerPosition,
            _move_data: move
          });

        if (error) {
          console.error('Move validation error:', error);
          toast({
            title: "Validation failed",
            description: "Could not validate move",
            variant: "destructive"
          });
          return;
        }

        if (!isValidMove) {
          console.log('❌ Invalid move rejected by server');
          toast({
            title: "Invalid move",
            description: "Move rejected by server validation",
            variant: "destructive"
          });
          return;
        }
      } catch (validationError) {
        console.error('Move validation exception:', validationError);
        toast({
          title: "Validation error",
          description: "Could not validate move",
          variant: "destructive"
        });
        return;
      }
    } else {
      console.log('🤖 Skipping server validation for bot move');
    }
    
    const dbState = syncedGameHook.syncState.gameState;
    if (!dbState || !(dbState as any).playerHands) {
      console.log('❌ Missing game state');
      return;
    }
    
    // Execute move locally first for immediate feedback
    console.log('🎯 BEFORE LOCAL MOVE - Board state:', Object.keys(dbState.board || {}));
    
    // Add the selected hand index to the move
    const moveWithIndex = {
      ...move,
      index: move.index !== undefined ? move.index : dominoGameHook.gameState.selectedHandIndex
    };
    
    console.log('🎯 MOVE WITH INDEX:', { move: moveWithIndex, selectedIndex: dominoGameHook.gameState.selectedHandIndex });
    dominoGameHook.executeMove(moveWithIndex);
    console.log('🎯 AFTER LOCAL MOVE - Local board state:', Object.keys(dominoGameHook.gameState?.board || {}));
    
    // Build the new game state manually for database save (don't wait for React state update)
    setTimeout(async () => {
      // Manually build what the new state should be
      const { end, dominoData, flipped, orientation } = moveWithIndex;
      const handIndex = moveWithIndex.index;
      
      // Get current player's hand from database and remove played domino
      const currentPlayerHand = [...((dbState as any).playerHands[currentPlayerTurn] || [])];
      if (handIndex !== undefined && handIndex !== null && handIndex < currentPlayerHand.length) {
        currentPlayerHand.splice(handIndex, 1);
      }
      
      // Build new domino and board state manually
      const dominoId = `d${dbState.nextDominoId || 0}`;
      let { x, y } = end;
      let adjustedFlipped = flipped;
      
      // Apply position adjustments (same as executeMove)
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
      
      // Create new board state
      const newBoard = { ...dbState.board };
      const newDominoes = { ...dbState.dominoes };
      
      // Add new domino
      newDominoes[dominoId] = {
        data: dominoData,
        x, y, orientation,
        flipped: adjustedFlipped,
        isSpinner: dominoData.value1 === dominoData.value2
      };
      
      // Add new board cells
      const pips = adjustedFlipped ? [dominoData.value2, dominoData.value1] : [dominoData.value1, dominoData.value2];
      const cells = orientation === 'horizontal' ? [[x, y], [x + 1, y]] : [[x, y], [x, y + 1]];
      
      cells.forEach((cell, i) => {
        newBoard[`${cell[0]},${cell[1]}`] = {
          dominoId: dominoId,
          value: pips[i],
        };
      });

      // Create new complete game state for database
      const newGameState: any = {
        board: newBoard,
        dominoes: newDominoes,
        boneyard: dbState.boneyard || [],
        openEnds: [], // Will be calculated below
        forbiddens: dbState.forbiddens || {},
        nextDominoId: (dbState.nextDominoId || 0) + 1,
        spinnerId: dbState.spinnerId || (dominoData.value1 === dominoData.value2 ? dominoId : null),
        isGameOver: currentPlayerHand.length === 0, // Check for win condition
        
        // Update player hands with correct data
        playerHands: [...((dbState as any).playerHands || [])]
      };
      
      // Update current player's hand
      newGameState.playerHands[currentPlayerTurn] = currentPlayerHand;
      
      // Calculate open ends after the move using the NEW state
      if (dominoGameHook.regenerateOpenEnds) {
        const calculatedOpenEnds = dominoGameHook.regenerateOpenEnds(newGameState);
        newGameState.openEnds = calculatedOpenEnds;
        console.log('🎯 Calculated open ends after move:', calculatedOpenEnds.map(end => ({
          position: `${end.x},${end.y}`,
          value: end.value,
          direction: end.fromDir
        })));
      }
      
      // Next player
      const nextPlayer = (currentPlayerTurn + 1) % syncedGameHook.syncState.allPlayers.length;
      
      // Add currentPlayer field
      newGameState.currentPlayer = nextPlayer;
      
      console.log('💾 Saving to database:', {
        currentPlayer: currentPlayerTurn,
        nextPlayer,
        handSize: currentPlayerHand.length,
        boardKeys: Object.keys(newGameState.board),
        dominoKeys: Object.keys(newGameState.dominoes)
      });
      
      // Make sure we explicitly set the currentPlayer in the game state
      newGameState.currentPlayer = nextPlayer;
      
      console.log('💾 COMPLETE GAME STATE BEING SAVED:', {
        dominoes: Object.keys(newGameState.dominoes),
        board: Object.keys(newGameState.board),
        currentPlayer: newGameState.currentPlayer
      });
      
      await syncedGameHook.updateGameState(newGameState, nextPlayer);
    }, 200);
  }, [dominoGameHook, syncedGameHook, toast]);

  // Create bot-specific move function that doesn't check for human player turn
  const botExecuteMove = useCallback(async (move: any) => {
    console.log('🤖 Bot move attempt:', move);
    return wrappedExecuteMove({ ...move, isBot: true });
  }, [wrappedExecuteMove]);

  // Create pass function for bots
  const passMove = useCallback(async () => {
    console.log('🤖 Bot is passing turn');
    const currentPlayerTurn = syncedGameHook.syncState.currentPlayer;
    const nextPlayer = (currentPlayerTurn + 1) % syncedGameHook.syncState.allPlayers.length;
    
    const dbState = syncedGameHook.syncState.gameState;
    if (!dbState) return;
    
    // Keep same game state but advance to next player
    const newGameState = {
      ...dbState,
      currentPlayer: nextPlayer
    };
    
    await syncedGameHook.updateGameState(newGameState, nextPlayer);
  }, [syncedGameHook]);

  // Wrap drawFromBoneyard to also update database - SIMPLIFIED SYNC
  const wrappedDrawFromBoneyard = useCallback(async () => {
    const currentPlayerPosition = syncedGameHook.syncState.playerPosition;
    const currentPlayerTurn = syncedGameHook.syncState.currentPlayer;
    
    if (currentPlayerPosition !== currentPlayerTurn) {
      console.log('❌ Not your turn to draw!');
      toast({
        title: "Not your turn",
        description: "Wait for your turn to draw",
        variant: "destructive"
      });
      return;
    }
    
    const dbState = syncedGameHook.syncState.gameState;
    if (!dbState || !(dbState as any).playerHands || !(dbState as any).boneyard?.length) {
      console.log('❌ Missing game state for draw or boneyard empty');
      return;
    }
    
    console.log('🔥 DRAWING FROM BONEYARD - Current hand size:', dominoGameHook.gameState.playerHand.length);
    console.log('🔥 DRAWING FROM BONEYARD - Boneyard size:', dominoGameHook.gameState.boneyard.length);
    
    // Get the domino that will be drawn BEFORE drawing
    const drawnDomino = (dbState as any).boneyard[(dbState as any).boneyard.length - 1];
    console.log('🎯 Drawing domino:', drawnDomino);
    
    // Block sync completely during the entire draw operation
    setIgnoringSync(true);
    
    try {
      // Execute draw locally first
      dominoGameHook.drawFromBoneyard();
      
      // Create new complete game state for database using the database state as base
      const newBoneyard = [...((dbState as any).boneyard || [])];
      newBoneyard.pop(); // Remove last domino
      
      const newPlayerHands = [...((dbState as any).playerHands || [])];
      newPlayerHands[currentPlayerPosition] = [...newPlayerHands[currentPlayerPosition], drawnDomino];
      
      const newGameState = {
        board: dbState.board,
        dominoes: dbState.dominoes,
        boneyard: newBoneyard,
        openEnds: dbState.openEnds,
        forbiddens: dbState.forbiddens,
        nextDominoId: dbState.nextDominoId,
        spinnerId: dbState.spinnerId,
        isGameOver: dbState.isGameOver,
        playerHands: newPlayerHands,
        currentPlayer: currentPlayerTurn // KEEP SAME PLAYER - drawing doesn't end turn!
      };
      
      console.log('💾 Saving draw to database:', {
        currentPlayer: currentPlayerTurn,
        stayingSamePlayer: true,
        boneyardSize: newBoneyard.length,
        handSize: newPlayerHands[currentPlayerPosition].length,
        drawnDomino
      });
      
      // Save to database but DON'T change player turn
      await syncedGameHook.updateGameState(newGameState, currentPlayerTurn);
      
      console.log('✅ Draw saved to database');
      
    } catch (error) {
      console.error('❌ Error during draw:', error);
    } finally {
      // Re-enable sync after database update completes
      setTimeout(() => {
        setIgnoringSync(false);
        console.log('🔓 Re-enabling sync after draw');
      }, 500);
    }
  }, [dominoGameHook, syncedGameHook, toast]);

  // Initialize bot manager for AI players
  useBotManager({
    currentPlayer: syncedGameHook.syncState.currentPlayer,
    players: syncedGameHook.syncState.allPlayers.map(p => ({
      player_position: p.position,
      username: p.username,
      is_bot: p.username.includes('🤖') || p.username.includes('Bot') || p.username.includes('Dave') || p.username.includes('Betty') || p.username.includes('Raja') || p.username.includes('Sam'),
      bot_name: p.username.includes('🤖') || p.username.includes('Bot') || p.username.includes('Dave') || p.username.includes('Betty') || p.username.includes('Raja') || p.username.includes('Sam') ? p.username : null
    })),
    gameState: syncedGameHook.syncState.gameState, // Use SAME state as human players
    executeMove: botExecuteMove,
    drawFromBoneyard: wrappedDrawFromBoneyard,
    findLegalMoves: (dominoData: any) => {
      // CRITICAL: Bots must use EXACT same logic as human players including hasDifferentNeighbor!
      const dbState = syncedGameHook.syncState.gameState;
      if (!dbState) return [];
      
      console.log('🤖 Bot using EXACT database open ends with hasDifferentNeighbor validation');
      
      // CRITICAL: Add the hasDifferentNeighbor function that bots were missing!
      const hasDifferentNeighbor = (x: number, y: number): boolean => {
        const { board } = dbState;
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
      };
      
      const moves: any[] = [];
      const selectedIsDouble = dominoData.value1 === dominoData.value2;
      const uniqueEnds: Record<string, boolean> = {};
      
      // Use EXACT same open ends from database - no regeneration!
      const openEnds = dbState.openEnds || [];

      openEnds.forEach((end: any) => {
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

            const toDomino = dbState.dominoes[dbState.board[toCellKey]?.dominoId];
            const toDominoForward = dbState.dominoes[dbState.board[toCellKeyForward]?.dominoId];
            const fromDomino = dbState.dominoes[dbState.board[fromCellKey]?.dominoId];

            if (!fromDomino) return;
            if (toDomino) return;
            if (toDominoForward) return;
            if (dbState.forbiddens?.[toCellKey]) return;

            // CRITICAL: Add the missing hasDifferentNeighbor validation!
            if (hasDifferentNeighbor(end.x, end.y)) {
              return;
            }

            const orientation = end.fromDir === 'N' || end.fromDir === 'S' ? 'vertical' : 'horizontal';

            if (fromDomino.isSpinner && fromDomino) {
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
            let finalOrientation: 'horizontal' | 'vertical' = orientation;

            // For doubles, flip the orientation like in original code
            if (selectedIsDouble) {
              finalOrientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
            }

            // Adjust position and flipping based on direction to ensure correct pip matching
            if (finalOrientation === 'horizontal') {
              if (end.fromDir === 'W') {
                x -= 1; // Place to the left
                // Don't flip for horizontal placement to the left
              }
              // For "E", no adjustment needed as it works fine
            } else {
              if (end.fromDir === 'N') {
                y -= 1; // Place above
                // Don't flip for vertical placement above
              }
              // For "S", no adjustment needed as it works fine
            }

            moves.push({ end, dominoData, flipped: adjustedFlipped, orientation: finalOrientation, x, y, fromDomino });
            uniqueEnds[`${end.x},${end.y}`] = true;
          }
        };

        check(dominoData.value1, false);
        check(dominoData.value2, true);
      });

      console.log('🤖 Bot found legal moves with hasDifferentNeighbor validation:', moves.length);
      return moves;
    },
    passMove,
    isGameOver: dominoGameHook.gameState?.isGameOver || false
  });

  // Create combined hook for DominoGame component
  const combinedGameHook = {
    ...dominoGameHook,
    executeMove: wrappedExecuteMove,
    drawFromBoneyard: wrappedDrawFromBoneyard,
    passMove, // Add passMove function
    syncState: syncedGameHook.syncState,
    startNewGame: syncedGameHook.startNewGame,
    gameData: game
  };

  const fetchGame = async () => {
    if (!gameId) return;

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('lobby_id', gameId)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching game:', error);
      toast({
        title: "Error",
        description: "Failed to load game",
        variant: "destructive"
      });
      return;
    }

    setGame(data);
    setLoading(false);
  };

  useEffect(() => {
    // Wait for auth to finish loading
    if (authLoading) return;
    
    if (!isAuthenticated) {
      navigate('/lobbies');
      return;
    }

    fetchGame();
  }, [gameId, isAuthenticated, authLoading, navigate]);

  if (!isAuthenticated || authLoading) {
    return null;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-2 text-muted-foreground">Loading game...</p>
        </div>
      </div>
    );
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Game Not Found</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              The game you're looking for doesn't exist or hasn't started yet.
            </p>
            <Button onClick={() => navigate('/lobbies')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Lobbies
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Button 
            variant="outline" 
            onClick={() => navigate(`/lobby/${gameId}`)}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Lobby
          </Button>
          <h1 className="text-3xl font-bold">Multiplayer Domino Game</h1>
        </div>

        <DominoGame gameHook={combinedGameHook} />
      </div>
    </div>
  );
}