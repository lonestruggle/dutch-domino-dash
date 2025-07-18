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

  // Sync database state to local state when it changes (from other players)
  useEffect(() => {
    if (syncedGameHook.syncState.gameState && !syncedGameHook.syncState.isLoading) {
      console.log('🔄 Syncing database state to local state');
      
      // Only sync the shared parts of the game state, not the local player hand
      const dbState = syncedGameHook.syncState.gameState;
      const myPosition = syncedGameHook.syncState.playerPosition;
      const myHand = (dbState as any).playerHands?.[myPosition] || [];
      
      console.log('My hand from DB:', myHand);
      
      // Update local game state with shared data + my hand from database
      dominoGameHook.setGameState({
        ...dbState,
        playerHand: myHand // Use my hand from database
      });
    }
  }, [syncedGameHook.syncState.gameState, syncedGameHook.syncState.isLoading]); // React to game state changes

  // Wrap executeMove to also update database
  const wrappedExecuteMove = useCallback(async (move: any) => {
    console.log('wrappedExecuteMove called with move:', move);
    
    // Get the current hand BEFORE executing the move
    const currentDbState = syncedGameHook.syncState.gameState;
    const currentPlayerPosition = syncedGameHook.syncState.playerPosition;
    
    console.log('🔍 DEBUG: Before move execution:');
    console.log('Current DB state hands:', currentDbState ? (currentDbState as any).playerHands : 'no state');
    console.log('Current player position:', currentPlayerPosition);
    console.log('Current player from sync state:', syncedGameHook.syncState.currentPlayer);
    
    if (!currentDbState || !(currentDbState as any).playerHands) {
      console.log('Cannot execute move - missing game state');
      return;
    }
    
    const originalHand = (currentDbState as any).playerHands[currentPlayerPosition];
    console.log('Original hand from DB:', originalHand);
    const currentPlayerHand = [...originalHand];
    
    // Find and remove the played domino from the hand
    const playedDominoIndex = currentPlayerHand.findIndex(domino => 
      (domino.value1 === move.dominoData.value1 && domino.value2 === move.dominoData.value2) ||
      (domino.value1 === move.dominoData.value2 && domino.value2 === move.dominoData.value1)
    );
    
    if (playedDominoIndex === -1) {
      console.log('Cannot find played domino in hand');
      return;
    }
    
    // Remove the played domino
    currentPlayerHand.splice(playedDominoIndex, 1);
    
    // Execute the move locally
    dominoGameHook.executeMove(move);
    
    // Wait a bit longer for the state to update, then sync to database
    setTimeout(() => {
      console.log('Attempting to sync to database...');
      
      // Get the current database state to preserve other players' hands
      const dbState = syncedGameHook.syncState.gameState;
      const currentState = dominoGameHook.gameState;
      
      
      if (dbState && (dbState as any).playerHands && currentState) {
        console.log('🔍 DETAILED DEBUG - Before database update:');
        console.log('Current DB state board:', Object.keys(dbState.board || {}));
        console.log('Current local state board:', Object.keys(currentState.board || {}));
        console.log('Current DB dominoes:', Object.keys((dbState as any).dominoes || {}));  
        console.log('Current local dominoes:', Object.keys(currentState.dominoes || {}));
        console.log('Current DB player hands:', (dbState as any).playerHands?.map((hand: any) => hand.length));
        console.log('Current local player hands:', currentState.playerHands?.map((hand: any) => hand.length));
        
        // Create updated database state with current player's updated hand
        const updatedDbState = {
          ...currentState, // Use current state as base (board, dominoes, etc.)
          playerHands: [...(dbState as any).playerHands] // Copy existing hands from DB
        };
        
        // Update current player's hand with the correctly calculated hand
        updatedDbState.playerHands[currentPlayerPosition] = currentPlayerHand;
        
        console.log('🔍 DETAILED DEBUG - What we will save to DB:');
        console.log('Updated DB state board:', Object.keys(updatedDbState.board || {}));
        console.log('Updated DB dominoes:', Object.keys(updatedDbState.dominoes || {}));
        console.log('Updated DB player hands:', updatedDbState.playerHands?.map((hand: any) => hand.length));
        
        // Determine next player (simple rotation)
        const nextPlayer = (syncedGameHook.syncState.currentPlayer + 1) % syncedGameHook.syncState.allPlayers.length;
        
        console.log('Syncing move to database:', {
          currentPlayer: syncedGameHook.syncState.currentPlayer,
          nextPlayer,
          playerPosition: syncedGameHook.syncState.playerPosition,
          handSize: currentPlayerHand.length
        });
        
        syncedGameHook.updateGameState(updatedDbState, nextPlayer);
        
        // After updating database, reload game state for both players
        setTimeout(() => {
          syncedGameHook.loadGameState();
        }, 100);
      } else {
        console.log('Cannot sync - missing required data:', {
          hasDbState: !!dbState,
          hasPlayerHands: !!(dbState && (dbState as any).playerHands),
          hasCurrentState: !!currentState
        });
      }
    }, 300);
  }, [dominoGameHook.executeMove, syncedGameHook.syncState, syncedGameHook.updateGameState]);

  // Wrap drawFromBoneyard to also update database
  const wrappedDrawFromBoneyard = useCallback(async () => {
    // First draw locally
    dominoGameHook.drawFromBoneyard();
    
    // Wait for state to update, then sync to database
    setTimeout(() => {
      const dbState = syncedGameHook.syncState.gameState;
      const currentState = dominoGameHook.gameState;
      
      if (dbState && (dbState as any).playerHands && currentState) {
        // Create updated database state with current player's updated hand and boneyard
        const updatedDbState = {
          ...currentState, // Use current state as base (includes updated boneyard)
          playerHands: [...(dbState as any).playerHands] // Copy existing hands from DB
        };
        
        // Update current player's hand
        updatedDbState.playerHands[syncedGameHook.syncState.playerPosition] = currentState.playerHand;
        
        // Determine next player (simple rotation)
        const nextPlayer = (syncedGameHook.syncState.currentPlayer + 1) % syncedGameHook.syncState.allPlayers.length;
        
        console.log('Syncing draw to database:', {
          currentPlayer: syncedGameHook.syncState.currentPlayer,
          nextPlayer,
          boneyardSize: currentState.boneyard.length,
          handSize: currentState.playerHand.length
        });
        
        syncedGameHook.updateGameState(updatedDbState, nextPlayer);
      }
    }, 200);
  }, [dominoGameHook.drawFromBoneyard, dominoGameHook.gameState, syncedGameHook.syncState, syncedGameHook.updateGameState]);

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