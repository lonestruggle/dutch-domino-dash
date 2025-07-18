import { useState, useEffect, useCallback } from 'react';
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

  // Load initial game state from database
  const loadGameState = useCallback(async () => {
    try {
      // Get game data
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('lobby_id', gameId)
        .single();

      if (gameError) throw gameError;

      // Get player position
      const { data: playerData, error: playerError } = await supabase
        .from('lobby_players')
        .select('*')
        .eq('lobby_id', gameId)
        .eq('user_id', userId)
        .single();

      if (playerError) throw playerError;

      // Get all players
      const { data: allPlayersData, error: playersError } = await supabase
        .from('lobby_players')
        .select('username, player_position')
        .eq('lobby_id', gameId)
        .order('player_position');

      if (playersError) throw playersError;

      setSyncState({
        isLoading: false,
        isHost: playerData.player_position === 0,
        playerPosition: playerData.player_position,
        allPlayers: allPlayersData.map(p => ({ 
          username: p.username || 'Anonymous', 
          position: p.player_position 
        }))
      });

      // If there's a saved game state, restore it
      if (gameData.game_state && typeof gameData.game_state === 'object') {
        const savedState = gameData.game_state as any;
        if (savedState.dominoes && Object.keys(savedState.dominoes).length > 0) {
          // Restore the game state directly
          localGame.resetGame();
          setTimeout(() => {
            // Apply saved state (simplified - in real scenario you'd need to reconstruct the state properly)
            console.log('Restoring game state:', savedState);
          }, 100);
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
  }, [gameId, userId, localGame, toast]);

  // Save game state to database
  const saveGameState = useCallback(async (gameState: GameState) => {
    try {
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
        title: "Not allowed",
        description: "Only the host can start a new game",
        variant: "destructive"
      });
      return;
    }

    localGame.startNewGame();
    
    // Save the new game state after a delay to let it initialize
    setTimeout(async () => {
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
    }, 200);
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

    const channel = supabase
      .channel(`game-sync-${gameId}`)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'games', 
          filter: `lobby_id=eq.${gameId}` 
        },
        (payload) => {
          console.log('Game state updated:', payload);
          // Reload game state when it changes
          if (payload.eventType === 'UPDATE' && payload.new) {
            loadGameState();
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, loadGameState]);

  // Initial load
  useEffect(() => {
    loadGameState();
  }, [loadGameState]);

  return {
    // Pass through all local game functionality
    ...localGame,
    // Override specific functions with synced versions
    startNewGame: startSyncedNewGame,
    executeMove: executeSyncedMove,
    // Add sync state
    syncState,
    saveGameState: () => saveGameState(localGame.gameState)
  };
};