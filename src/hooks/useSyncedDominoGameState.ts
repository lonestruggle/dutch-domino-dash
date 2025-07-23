import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GameState } from '@/types/domino';

interface SyncedGameState {
  isLoading: boolean;
  isHost: boolean;
  playerPosition: number;
  allPlayers: Array<{ username: string; position: number; is_bot: boolean }>;
  gameState: GameState | null;
  currentPlayer: number;
}

export const useSyncedDominoGameState = (gameId: string, userId: string, ignoringSync = false) => {
  const { toast } = useToast();
  const [syncState, setSyncState] = useState<SyncedGameState>({
    isLoading: true,
    isHost: false,
    playerPosition: 0,
    allPlayers: [],
    gameState: null,
    currentPlayer: 0
  });

  // Load initial game state from database
  const loadGameState = useCallback(async () => {
    if (!gameId || !userId) {
      console.log('Missing gameId or userId:', { gameId, userId });
      return;
    }
    
    if (ignoringSync) {
      console.log('🚫 IGNORING LOAD GAME STATE - we are in the middle of an update');
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
        position: p.player_position,
        is_bot: p.is_bot || false
      })) || [];

      // Extract player's hand from game state
      const playerPosition = playerData?.player_position || 0;
      const gameState = gameData?.game_state as any;
      
      let playerHand = [];
      if (gameState && gameState.playerHands && Array.isArray(gameState.playerHands) && gameState.playerHands[playerPosition]) {
        playerHand = gameState.playerHands[playerPosition];
      }

      // Create local game state from database state
      const localGameState = gameState ? {
        dominoes: gameState.dominoes || {},
        board: gameState.board || {},
        playerHand: [...playerHand], // Create a copy to avoid circular reference
        playerHands: gameState.playerHands || [], // Keep original playerHands from database
        boneyard: gameState.boneyard || [],
        openEnds: gameState.openEnds || [],
        forbiddens: gameState.forbiddens || {},
        nextDominoId: gameState.nextDominoId || 0,
        spinnerId: gameState.spinnerId || null,
        isGameOver: gameState.isGameOver || false,
        selectedHandIndex: gameState.selectedHandIndex || null,
        currentPlayer: gameData?.current_player_turn || 0, // ALWAYS use database column as source of truth
        // Hard slam properties for synchronization
        hardSlamUsesRemaining: gameState.hardSlamUsesRemaining,
        hardSlamNextMove: gameState.hardSlamNextMove,
        isHardSlamming: gameState.isHardSlamming
      } : null;
      
      console.log('🔍 LOADED FROM DATABASE:', {
        dominoes: Object.keys(gameState?.dominoes || {}),
        board: Object.keys(gameState?.board || {}),
        currentPlayer: gameData?.current_player_turn
      });

      setSyncState({
        isLoading: false,
        isHost: playerData?.player_position === 0,
        playerPosition: playerData?.player_position || 0,
        allPlayers,
        gameState: localGameState,
        currentPlayer: gameData?.current_player_turn || 0 // ALWAYS use database column as source of truth
      });

      console.log('Sync state updated:', {
        isLoading: false,
        isHost: playerData?.player_position === 0,
        playerPosition: playerData?.player_position || 0,
        allPlayers,
        gameState: localGameState,
        currentPlayer: gameData?.current_player_turn || 0 // ALWAYS use database column as source of truth
      });

      console.log('🎯 CURRENT PLAYER DEBUG:', {
        databaseColumn: gameData?.current_player_turn,
        gameStateField: gameState?.currentPlayer,
        finalCurrentPlayer: gameData?.current_player_turn || 0
      });

    } catch (error) {
      console.error('Error loading game state:', error);
      toast({
        title: "Error",
        description: "Failed to load game state",
        variant: "destructive"
      });
    }
  }, [gameId, userId, toast, ignoringSync]);

  // Update game state in database
  const updateGameState = useCallback(async (newGameState: any, newCurrentPlayer?: number) => {
    if (!gameId) return;

    try {
      const { error } = await supabase
        .from('games')
        .update({
          game_state: newGameState as any,
          current_player_turn: newCurrentPlayer !== undefined ? newCurrentPlayer : syncState.currentPlayer,
          updated_at: new Date().toISOString()
        })
        .eq('lobby_id', gameId);

      if (error) {
        console.error('Error updating game state:', error);
        toast({
          title: "Error",
          description: "Failed to update game state",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error updating game state:', error);
    }
  }, [gameId, syncState.currentPlayer, toast]);

  // Start new game (updates database)
  const startNewGame = useCallback(async () => {
    if (!gameId || !syncState.isHost) return;

    // Create full domino set and shuffle
    const fullSet = [];
    for (let i = 0; i <= 6; i++) {
      for (let j = i; j <= 6; j++) {
        fullSet.push({ value1: i, value2: j });
      }
    }
    
    // Shuffle the domino set
    for (let i = fullSet.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [fullSet[i], fullSet[j]] = [fullSet[j], fullSet[i]];
    }

    // Create hands for each player
    const playerHands = [];
    const playersCount = syncState.allPlayers.length;
    
    for (let p = 0; p < playersCount; p++) {
      playerHands.push(fullSet.slice(p * 7, (p + 1) * 7));
    }
    
    const boneyard = fullSet.slice(playersCount * 7);

    // Het spel begint met een leeg bord - zoek eerste menselijke speler
    let starterPlayerIndex = 0;
    
    // Zoek de eerste menselijke speler (geen bot)
    for (let i = 0; i < playersCount; i++) {
      const player = syncState.allPlayers[i];
      if (!player.is_bot) {
        starterPlayerIndex = i;
        break;
      }
    }
    
    // Start met VOLLEDIG leeg bord - FORCE RESET
    const newGameState = {
      dominoes: {}, // VOLLEDIG LEEG
      board: {}, // VOLLEDIG LEEG  
      playerHands,
      boneyard,
      openEnds: [], // GEEN OPEN ENDS
      forbiddens: {},
      nextDominoId: 0, // Start bij 0
      spinnerId: null,
      isGameOver: false,
      selectedHandIndex: null,
      playerHand: playerHands[syncState.playerPosition] || []
    };

    console.log('🔥 FORCING EMPTY BOARD - startNewGame:', {
      dominoes: Object.keys(newGameState.dominoes),
      board: Object.keys(newGameState.board),
      openEnds: newGameState.openEnds.length,
      starterPlayer: starterPlayerIndex
    });

    await updateGameState(newGameState, starterPlayerIndex);
    
    // FORCE herlaad van de game state na het opslaan
    setTimeout(() => {
      loadGameState();
    }, 500);
  }, [gameId, syncState.isHost, syncState.allPlayers, syncState.playerPosition, updateGameState]);

  // Load initial game state and listen for updates
  useEffect(() => {
    loadGameState();
    
    // Subscribe to game changes - when other player makes a move
    const channel = supabase
      .channel(`game-${gameId}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games', filter: `lobby_id=eq.${gameId}` },
        (payload) => {
          console.log('🔄 Game updated by other player, reloading state...', payload);
          console.log('🔄 BEFORE RELOAD - Current dominoes:', Object.keys(syncState.gameState?.dominoes || {}));
          // Reload the game state when other player makes a move
          loadGameState().then(() => {
            console.log('🔄 AFTER RELOAD - Reloaded dominoes:', Object.keys(syncState.gameState?.dominoes || {}));
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [gameId, userId]);

  return {
    syncState,
    loadGameState,
    updateGameState,
    startNewGame
  };
};