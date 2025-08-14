import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { GameState } from '@/types/domino';

interface SyncedGameState {
  isLoading: boolean;
  isHost: boolean;
  playerPosition: number;
  allPlayers: Array<{ username: string; position: number; is_bot: boolean; user_id?: string }>;
  gameState: GameState | null;
  currentPlayer: number;
  gameData: any;
}

export const useSyncedDominoGameState = (gameId: string, userId: string, ignoringSync = false) => {
  const { toast } = useToast();
  const [syncState, setSyncState] = useState<SyncedGameState>({
    isLoading: true,
    isHost: false,
    playerPosition: 0,
    allPlayers: [],
    gameState: null,
    currentPlayer: 0,
    gameData: null
  });
  const startLockRef = useRef(false);
  const selfUpdateSuppressUntilRef = useRef<number>(0);


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

    // Suppress immediate reloads during our own local updates to avoid state flicker
    if (Date.now() < selfUpdateSuppressUntilRef.current) {
      console.log('⏭️ Skipping load during local update window');
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
        is_bot: p.is_bot || false,
        user_id: p.user_id || undefined
      })) || [];

      // Extract player's hand from game state
      const playerPosition = playerData?.player_position || 0;
      const gameState = gameData?.game_state as any;
      
      let playerHand = [];
      if (gameState && gameState.playerHands && Array.isArray(gameState.playerHands) && gameState.playerHands[playerPosition]) {
        playerHand = gameState.playerHands[playerPosition];
      }

      // Create local game state from database state
      let localGameState = gameState ? {
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
      } : null;

      // Defensive fix: remove any tiles from hands/boneyard that already appear on the table
      if (localGameState) {
        const keyOf = (d: any) => `${Math.min(d.value1, d.value2)}|${Math.max(d.value1, d.value2)}`;
        const placedKeys = new Set<string>();
        for (const id in localGameState.dominoes) {
          placedKeys.add(keyOf(localGameState.dominoes[id].data));
        }
        if (placedKeys.size > 0) {
          // Filter from all player hands
          const sanitizedHands = (localGameState.playerHands || []).map((hand: any[] = []) =>
            hand.filter((d) => !placedKeys.has(keyOf(d)))
          );
          // Ensure array length at least up to current player position
          localGameState.playerHands = sanitizedHands;
          // Sync my visible hand too
          localGameState.playerHand = sanitizedHands[playerPosition] || [];
          // Filter boneyard as well
          localGameState.boneyard = (localGameState.boneyard || []).filter((d) => !placedKeys.has(keyOf(d)));
        }
      }
      
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
        currentPlayer: gameData?.current_player_turn || 0, // ALWAYS use database column as source of truth
        gameData: gameData
      });

      console.log('Sync state updated:', {
        isLoading: false,
        isHost: playerData?.player_position === 0,
        playerPosition: playerData?.player_position || 0,
        allPlayers,
        gameState: localGameState,
        currentPlayer: gameData?.current_player_turn || 0, // ALWAYS use database column as source of truth
        gameData: gameData
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
      // Mark this as a self-initiated update to prevent immediate reload flicker
      selfUpdateSuppressUntilRef.current = Date.now() + 1200;

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
    if (!gameId || !syncState.isHost) return undefined;
    if (startLockRef.current) {
      console.log('🚫 startNewGame ignored - already in progress');
      return undefined;
    }
    startLockRef.current = true;

    try {
      // Create full domino set and shuffle
      const fullSet = [] as Array<{ value1: number; value2: number }>;
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
      const playerHands: any[] = [];
      const playersCount = syncState.allPlayers.length;
      
      for (let p = 0; p < playersCount; p++) {
        playerHands.push(fullSet.slice(p * 7, (p + 1) * 7));
      }
      
      const boneyard = fullSet.slice(playersCount * 7);
  
      // Bepaal wie mag beginnen volgens domino regels
      let starterPlayerIndex = 0;
      
      // Helper functie om te checken of een speler een specifieke domino heeft
      const hasDoubleValue = (playerHand: any[], value: number) => {
        return playerHand.some(domino => domino.value1 === value && domino.value2 === value);
      };
      
      const hasHighestNonDouble = (playerHand: any[], value1: number, value2: number) => {
        return playerHand.some(domino => 
          (domino.value1 === value1 && domino.value2 === value2) ||
          (domino.value1 === value2 && domino.value2 === value1)
        );
      };
      
      // Stap 1: Zoek naar dubbele stenen van hoog naar laag (6|6, 5|5, 4|4, 3|3, 2|2, 1|1, 0|0)
      let foundStarter = false;
      for (let doubleValue = 6; doubleValue >= 0 && !foundStarter; doubleValue--) {
        for (let i = 0; i < playersCount; i++) {
          if (hasDoubleValue(playerHands[i], doubleValue)) {
            starterPlayerIndex = i;
            foundStarter = true;
            console.log(`🎯 Speler ${i} begint met dubbel ${doubleValue}`);
            break;
          }
        }
      }
      
      // Stap 2: Als niemand een dubbele heeft, zoek naar hoogste enkele steen
      if (!foundStarter) {
        // Zoek van hoog naar laag: 6|5, 6|4, 6|3, 6|2, 6|1, 6|0, dan 5|4, 5|3, etc.
        for (let high = 6; high >= 0 && !foundStarter; high--) {
          for (let low = high - 1; low >= 0 && !foundStarter; low--) {
            for (let i = 0; i < playersCount; i++) {
              if (hasHighestNonDouble(playerHands[i], high, low)) {
                starterPlayerIndex = i;
                foundStarter = true;
                console.log(`🎯 Speler ${i} begint met hoogste steen ${high}|${low}`);
                break;
              }
            }
          }
        }
      }
      
      // Fallback: als er iets misgaat, begin gewoon met eerste speler
      if (!foundStarter) {
        console.log('🎯 Fallback: Speler 0 begint');
      }
      
      // Start met VOLLEDIG leeg bord - FORCE RESET + METADATA
      const myName = syncState.allPlayers.find(p => p.position === syncState.playerPosition)?.username || 'Unknown';
      const newGameState: any = {
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
        playerHand: playerHands[syncState.playerPosition] || [],
        // Reset metadata for logging/audit
        lastResetById: userId,
        lastResetByName: myName,
        lastResetAt: new Date().toISOString(),
        resetCounter: ((syncState.gameData?.game_state as any)?.resetCounter || 0) + 1,
        resetReason: 'manual'
      };
  
      console.log('🔥 FORCING EMPTY BOARD - startNewGame:', {
        dominoes: Object.keys(newGameState.dominoes),
        board: Object.keys(newGameState.board),
        openEnds: newGameState.openEnds.length,
        starterPlayer: starterPlayerIndex,
        resetBy: myName,
        resetCounter: newGameState.resetCounter
      });
  
      await updateGameState(newGameState, starterPlayerIndex);
      
      // FORCE herlaad van de game state na het opslaan (na suppressie-venster)
      setTimeout(() => {
        loadGameState();
      }, 1300);

      // Geef de nieuwe state terug zodat de UI direct kan updaten
      return newGameState as GameState;
    } finally {
      startLockRef.current = false;
    }
  }, [gameId, syncState.isHost, syncState.allPlayers, syncState.playerPosition, updateGameState, loadGameState, userId]);



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
          // Skip reload if this update was triggered by ourselves very recently
          if (Date.now() < selfUpdateSuppressUntilRef.current) {
            console.log('⏭️ Skipping realtime reload (self update in progress)');
            return;
          }

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