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
      
      // KRITIEKE FIX: Gebruik EXACT dezelfde flipped waarde als berekend in move
      // Geen extra manipulatie hier om inconsistentie te voorkomen
      const { x, y, flipped: adjustedFlipped } = move;
      
      // Geen verdere aanpassingen aan flipped status nodig
      // We gebruiken de waarde die al in adjustedFlipped zit
      
      // Create new board state
      const newBoard = { ...dbState.board };
      const newDominoes = { ...dbState.dominoes };
      
      // ROTATIE FIX: Gebruik rotatie uit database als die er is, anders genereer nieuwe
      const existingDomino = dbState.dominoes?.[dominoId];
      const dominoRotation = existingDomino?.rotation !== undefined ? existingDomino.rotation : (Math.random() - 0.5) * 15;
      
      console.log(`🔥 SYNC: ${dominoId} - db rotation: ${existingDomino?.rotation}, using: ${dominoRotation}`);
      
      // Add new domino - gebruik rotatie uit lokale state of genereer nieuwe
      newDominoes[dominoId] = {
        data: dominoData,
        x, y, orientation,
        flipped: adjustedFlipped,
        isSpinner: dominoData.value1 === dominoData.value2,
        rotation: dominoRotation // Gebruik consistente rotatie
      };
      
      // Apply Hard Slam effect if it was activated
      if (dominoGameHook.gameState?.hardSlamNextMove) {
        console.log('💥 Hard Slam effect - applying new rotations to all existing dominoes in database sync');
        
        // Helper function to check if two dominoes overlap
        const checkOverlap = (domino1: any, domino2: any) => {
          const distance = Math.sqrt(Math.pow(domino1.x - domino2.x, 2) + Math.pow(domino1.y - domino2.y, 2));
          return distance < 2.5; // Min distance in grid units
        };
        
        const dominoIds = Object.keys(newDominoes).filter(id => id !== dominoId);
        dominoIds.forEach((existingDominoId, index) => {
          if (existingDominoId !== dominoId) { // Don't change the newly placed domino
            let attempts = 0;
            let newRotation;
            let hasOverlap;
            
            do {
              newRotation = (Math.random() - 0.5) * 60; // Random rotation between -30 and +30 degrees
              
              // Create temp domino with new rotation
              const tempDomino = {
                ...newDominoes[existingDominoId],
                rotation: newRotation
              };
              
              // Check for overlaps with other dominoes
              hasOverlap = false;
              for (const otherId of dominoIds) {
                if (otherId !== existingDominoId) {
                  const otherDomino = newDominoes[otherId];
                  if (checkOverlap(tempDomino, otherDomino)) {
                    hasOverlap = true;
                    break;
                  }
                }
              }
              
              attempts++;
            } while (hasOverlap && attempts < 8); // Max 8 attempts
            
            // Apply the rotation
            newDominoes[existingDominoId] = {
              ...newDominoes[existingDominoId],
              rotation: hasOverlap ? (Math.random() - 0.5) * 30 : newRotation // Smaller rotation if still overlapping
            };
          }
        });
      }
      
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
        hardSlamNextMove: false, // Reset hard slam flag after applying
        isHardSlamming: dominoGameHook.gameState?.hardSlamNextMove || false, // Copy slam animation state
        
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

  // Hard slam wrapper function
  const wrappedHardSlam = useCallback(async () => {
    console.log('🎯 Hard Slam activated for next move!');
    
    // Just activate the flag - effect will happen on next domino placement
    dominoGameHook.hardSlam();
    
    try {
      // Update hard slam usage in database
      const currentPlayerData = syncedGameHook.syncState.allPlayers?.find(
        p => p.position === (syncedGameHook.syncState.gameState as any)?.currentPlayer
      );
      
      if (currentPlayerData) {
        const { error: updateError } = await supabase
          .from('lobby_players')
          .update({ 
            hard_slam_uses_remaining: Math.max(0, (currentPlayerData as any).hard_slam_uses_remaining - 1)
          })
          .eq('lobby_id', gameId)
          .eq('player_position', (syncedGameHook.syncState.gameState as any)?.currentPlayer);
          
        if (updateError) {
          console.error('Failed to update hard slam usage:', updateError);
        }
      }
      
      toast({
        title: "Hard Slam Activated! 💥",
        description: "Your next domino placement will shake up all the stones!",
        variant: "default"
      });
      
    } catch (error) {
      console.error('Hard slam error:', error);
      toast({
        title: "Error",
        description: "Failed to activate hard slam",
        variant: "destructive"
      });
    }
  }, [dominoGameHook, syncedGameHook, gameId, toast]);

  // BOTS DISABLED TEMPORARILY
  console.log('🤖 Bots zijn tijdelijk uitgeschakeld');

  // Create combined hook for DominoGame component
  const combinedGameHook = {
    ...dominoGameHook,
    executeMove: wrappedExecuteMove,
    drawFromBoneyard: wrappedDrawFromBoneyard,
    passMove, // Add passMove function
    hardSlam: wrappedHardSlam, // Add hard slam function
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
