import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSimpleAuth } from '@/hooks/useSimpleAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft } from 'lucide-react';
import { DominoGame } from '@/components/DominoGame';
import { useSyncedDominoGameState } from '@/hooks/useSyncedDominoGameState';
import { useDominoGame } from '@/hooks/useDominoGame';

interface GameData {
  id: string;
  lobby_id: string;
  status: string;
  current_player_turn: number;
  game_state: any;
  winner_position: number | null;
}

export default function Game() {
  const params = useParams();
  const gameId = params.gameId;
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useSimpleAuth();
  const { toast } = useToast();
  const [game, setGame] = useState<GameData | null>(null);
  const [loading, setLoading] = useState(true);

  console.log('Game params:', params);
  console.log('Game ID extracted:', gameId);

  // Initialize synced game state hook
  const syncedGameHook = useSyncedDominoGameState(
    (gameId && isAuthenticated) ? gameId : '', 
    (user?.id && isAuthenticated) ? user.id : ''
  );

  // Initialize local domino game logic
  const dominoGameHook = useDominoGame();

  // Sync database state to local state - COMPLETE SYNC FOR ALL PLAYERS
  useEffect(() => {
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
  }, [syncedGameHook.syncState.gameState, syncedGameHook.syncState.isLoading, syncedGameHook.syncState.playerPosition]);

  // Wrap executeMove to also update database - SIMPLIFIED SYNC
  const wrappedExecuteMove = useCallback(async (move: any) => {
    console.log('🎯 Move attempt:', move);
    
    // Check if it's the current player's turn
    const currentPlayerPosition = syncedGameHook.syncState.playerPosition;
    const currentPlayerTurn = syncedGameHook.syncState.currentPlayer;
    
    if (currentPlayerPosition !== currentPlayerTurn) {
      console.log('❌ Not your turn!');
      toast({
        title: "Not your turn",
        description: "Wait for your turn to play",
        variant: "destructive"
      });
      return;
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
      index: dominoGameHook.gameState.selectedHandIndex
    };
    
    console.log('🎯 MOVE WITH INDEX:', { move: moveWithIndex, selectedIndex: dominoGameHook.gameState.selectedHandIndex });
    dominoGameHook.executeMove(moveWithIndex);
    console.log('🎯 AFTER LOCAL MOVE - Local board state:', Object.keys(dominoGameHook.gameState?.board || {}));
    
    // Build the new game state manually for database save (don't wait for React state update)
    setTimeout(async () => {
      // Use the local state AFTER the React update has processed
      // But we need to wait a bit more for the state to actually update
      const currentState = dominoGameHook.gameState;
      if (!currentState) return;
      
      // Get current player's hand from database
      const currentPlayerHand = [...((dbState as any).playerHands[currentPlayerPosition] || [])];
      
      // Remove the played domino from hand using the index
      const handIndex = moveWithIndex.index;
      if (handIndex !== undefined && handIndex !== null && handIndex < currentPlayerHand.length) {
        currentPlayerHand.splice(handIndex, 1);
      }

      // Create new complete game state for database
      const newGameState: any = {
        // Use the CURRENT local state which now contains the new domino
        board: currentState.board,
        dominoes: currentState.dominoes,
        boneyard: currentState.boneyard || [],
        openEnds: currentState.openEnds || [],
        forbiddens: currentState.forbiddens || {},
        nextDominoId: currentState.nextDominoId,
        spinnerId: currentState.spinnerId,
        isGameOver: currentState.isGameOver || false,
        
        // Update player hands with correct data
        playerHands: [...((dbState as any).playerHands || [])]
      };
      
      // Update current player's hand
      newGameState.playerHands[currentPlayerPosition] = currentPlayerHand;
      
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
    if (!dbState || !(dbState as any).playerHands) {
      console.log('❌ Missing game state for draw');
      return;
    }
    
    // Execute draw locally first
    dominoGameHook.drawFromBoneyard();
    
    // Wait for local state to update, then sync to database
    setTimeout(async () => {
      const currentState = dominoGameHook.gameState;
      if (!currentState) return;
      
      // Create new complete game state for database
      const newGameState = {
        // Use current local state
        board: currentState.board,
        dominoes: currentState.dominoes,
        boneyard: currentState.boneyard, // Updated boneyard
        openEnds: currentState.openEnds,
        forbiddens: currentState.forbiddens,
        nextDominoId: currentState.nextDominoId,
        spinnerId: currentState.spinnerId,
        isGameOver: currentState.isGameOver,
        
        // Update player hands
        playerHands: [...((dbState as any).playerHands || [])],
        currentPlayer: currentState.currentPlayer
      };
      
      // Update current player's hand with new domino
      newGameState.playerHands[currentPlayerPosition] = currentState.playerHand;
      
      // Next player
      const nextPlayer = (currentPlayerTurn + 1) % syncedGameHook.syncState.allPlayers.length;
      
      console.log('💾 Saving draw to database:', {
        currentPlayer: currentPlayerTurn,
        nextPlayer,
        boneyardSize: currentState.boneyard.length,
        handSize: currentState.playerHand.length
      });
      
      await syncedGameHook.updateGameState(newGameState, nextPlayer);
    }, 200);
  }, [dominoGameHook, syncedGameHook, toast]);

  // Create combined hook for DominoGame component
  const combinedGameHook = {
    ...dominoGameHook,
    executeMove: wrappedExecuteMove,
    drawFromBoneyard: wrappedDrawFromBoneyard,
    syncState: syncedGameHook.syncState,
    startNewGame: syncedGameHook.startNewGame
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