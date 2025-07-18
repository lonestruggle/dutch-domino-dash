import { useState, useEffect, useCallback, useRef } from 'react';
import { useDominoGame } from './useDominoGame';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GameState, LegalMove } from '@/types/domino';

interface SyncedGameState {
  isLoading: boolean;
  isHost: boolean;
  playerPosition: number;
  allPlayers: Array<{ username: string; position: number }>;
}

export const useSyncedDominoGame = (gameId: string, userId: string) => {
  const localGame = useDominoGame();
  const { toast } = useToast();
  const [syncState, setSyncState] = useState<SyncedGameState>({
    isLoading: true,
    isHost: false,
    playerPosition: 0,
    allPlayers: []
  });
  
  const [isGameInitialized, setIsGameInitialized] = useState(false);
  const gameStateRef = useRef<GameState | null>(null);

  // Load initial game state from database
  const loadGameState = useCallback(async () => {
    if (!gameId || !userId) return;
    
    try {
      // Get game data
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('lobby_id', gameId)
        .maybeSingle();

      if (gameError) throw gameError;

      // Get player position
      const { data: playerData, error: playerError } = await supabase
        .from('lobby_players')
        .select('*')
        .eq('lobby_id', gameId)
        .eq('user_id', userId)
        .maybeSingle();

      if (playerError) throw playerError;

      // Get all players
      const { data: allPlayersData, error: playersError } = await supabase
        .from('lobby_players')
        .select('username, player_position')
        .eq('lobby_id', gameId)
        .order('player_position');

      if (playersError) throw playersError;

      if (playerData && allPlayersData) {
        setSyncState({
          isLoading: false,
          isHost: playerData.player_position === 0,
          playerPosition: playerData.player_position,
          allPlayers: allPlayersData.map(p => ({ 
            username: p.username || 'Anonymous', 
            position: p.player_position 
          }))
        });

        // Only load saved game state if there is one and it's meaningful
        if (gameData && gameData.game_state && typeof gameData.game_state === 'object') {
          const savedState = gameData.game_state as any;
          // Check if the game actually has meaningful state (more than just defaults)
          if (savedState.dominoes && Object.keys(savedState.dominoes).length > 0) {
            console.log('Loading saved game state:', savedState);
            gameStateRef.current = savedState;
            setIsGameInitialized(true);
          } else {
            // No meaningful game state, wait for host to start game
            console.log('No saved game state, waiting for game to start');
            setIsGameInitialized(false);
          }
        } else {
          setIsGameInitialized(false);
        }
      }
    } catch (error) {
      console.error('Error loading game state:', error);
      toast({
        title: "Error",
        description: "Failed to load game state",
        variant: "destructive"
      });
    }
  }, [gameId, userId, toast]);

  // Save game state to database
  const saveGameState = useCallback(async (gameState: GameState) => {
    if (!gameId) return;
    
    try {
      console.log('Saving game state:', gameState);
      await supabase
        .from('games')
        .update({ 
          game_state: gameState as any,
          updated_at: new Date().toISOString()
        })
        .eq('lobby_id', gameId);
    } catch (error) {
      console.error('Error saving game state:', error);
    }
  }, [gameId]);

  // Synced start new game (only host can do this)
  const startSyncedNewGame = useCallback(async () => {
    if (!syncState.isHost) {
      toast({
        title: "Alleen de host kan het spel starten",
        description: "Wacht tot de host een nieuw spel start",
        variant: "destructive"
      });
      return;
    }

    console.log('Host starting new game...');
    
    // Reset the saved game state and use local game state
    gameStateRef.current = null;
    localGame.startNewGame();
    setIsGameInitialized(true);
    
    // Save the new game state after it initializes
    setTimeout(async () => {
      console.log('Saving new game state after initialization...');
      await saveGameState(localGame.gameState);
      
      // Notify all players that a new game started
      await supabase
        .from('games')
        .update({ 
          status: 'active',
          current_player_turn: 0,
          updated_at: new Date().toISOString()
        })
        .eq('lobby_id', gameId);
        
      toast({
        title: "Nieuw spel gestart!",
        description: "Alle spelers kunnen nu spelen",
        variant: "default"
      });
    }, 1000);
  }, [syncState.isHost, localGame, saveGameState, gameId, toast]);

  // Synced execute move
  const executeSyncedMove = useCallback(async (move: LegalMove) => {
    localGame.executeMove(move);
    
    // Save state after move
    setTimeout(async () => {
      await saveGameState(localGame.gameState);
    }, 100);
  }, [localGame, saveGameState]);

  // Set up real-time subscription
  useEffect(() => {
    if (!gameId) return;

    console.log('Setting up real-time subscription for game:', gameId);
    
    const channel = supabase
      .channel(`game-sync-${gameId}`)
      .on(
        'postgres_changes',
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'games', 
          filter: `lobby_id=eq.${gameId}` 
        },
        (payload) => {
          console.log('Game state updated via real-time:', payload);
          if (payload.new && payload.new.game_state) {
            // Only update if we're not the one who made the change
            const newGameState = payload.new.game_state as GameState;
            if (newGameState && Object.keys(newGameState.dominoes || {}).length > 0) {
              console.log('Applying received game state from other player');
              gameStateRef.current = newGameState;
              setIsGameInitialized(true);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Real-time subscription status:', status);
      });

    return () => {
      console.log('Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [gameId]);

  // Initial load
  useEffect(() => {
    loadGameState();
  }, [loadGameState]);

  return {
    // Pass through most local game functionality
    gameState: gameStateRef.current || localGame.gameState,
    findLegalMoves: localGame.findLegalMoves,
    selectDomino: localGame.selectDomino,
    drawFromBoneyard: localGame.drawFromBoneyard,
    resetGame: localGame.resetGame,
    hasDifferentNeighbor: localGame.hasDifferentNeighbor,
    // Override specific functions with synced versions
    startNewGame: startSyncedNewGame,
    executeMove: executeSyncedMove,
    // Add sync state
    syncState,
    isGameInitialized,
    saveGameState: () => saveGameState(localGame.gameState)
  };
};