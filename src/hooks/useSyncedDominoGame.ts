import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SyncedGameState {
  isLoading: boolean;
  isHost: boolean;
  playerPosition: number;
  allPlayers: Array<{ username: string; position: number }>;
}

export const useSyncedDominoGame = (gameId: string, userId: string) => {
  const { toast } = useToast();
  const [syncState, setSyncState] = useState<SyncedGameState>({
    isLoading: true,
    isHost: false,
    playerPosition: 0,
    allPlayers: []
  });

  // Load initial game state from database
  const loadGameState = useCallback(async () => {
    if (!gameId || !userId) {
      console.log('Missing gameId or userId:', { gameId, userId });
      return;
    }
    
    console.log('Loading game state for gameId:', gameId, 'userId:', userId);
    
    try {
      // Get game data
      const { data: gameData, error: gameError } = await supabase
        .from('games')
        .select('*')
        .eq('lobby_id', gameId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (gameError) {
        console.error('Game error:', gameError);
        throw gameError;
      }

      console.log('Game data:', gameData);

      // Get player position
      const { data: playerData, error: playerError } = await supabase
        .from('lobby_players')
        .select('*')
        .eq('lobby_id', gameId)
        .eq('user_id', userId)
        .maybeSingle();

      if (playerError) {
        console.error('Player error:', playerError);
        throw playerError;
      }

      console.log('Player data:', playerData);

      // Get all players
      const { data: allPlayersData, error: allPlayersError } = await supabase
        .from('lobby_players')
        .select('*')
        .eq('lobby_id', gameId)
        .order('player_position');

      if (allPlayersError) {
        console.error('All players error:', allPlayersError);
        throw allPlayersError;
      }

      console.log('All players data:', allPlayersData);

      const allPlayers = allPlayersData?.map(p => ({
        username: p.username || 'Unknown',
        position: p.player_position
      })) || [];

      setSyncState({
        isLoading: false,
        isHost: playerData?.player_position === 0,
        playerPosition: playerData?.player_position || 0,
        allPlayers
      });

      console.log('Sync state updated:', {
        isLoading: false,
        isHost: playerData?.player_position === 0,
        playerPosition: playerData?.player_position || 0,
        allPlayers
      });

    } catch (error) {
      console.error('Error loading game state:', error);
      toast({
        title: "Error",
        description: "Failed to load game state",
        variant: "destructive"
      });
    }
  }, [gameId, userId, toast]);

  useEffect(() => {
    loadGameState();
    
    // Subscribe to game changes
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'games', filter: `lobby_id=eq.${gameId}` },
        (payload) => {
          console.log('Game updated:', payload);
          loadGameState();
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lobby_players', filter: `lobby_id=eq.${gameId}` },
        (payload) => {
          console.log('Players updated:', payload);
          loadGameState();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadGameState, gameId]);

  return {
    syncState,
    loadGameState
  };
};