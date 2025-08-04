import { useEffect, useState, useCallback } from 'react';
import { usePresence, useList } from '@liveblocks/react';
import { LiveList } from '@liveblocks/client';
import { DominoGame } from '@/components/DominoGame';
import { useDominoGame } from '@/hooks/useDominoGame';
import { GameState, DominoData } from '@/types/domino';

// Define a type for the presence data
interface Presence {
  username: string | null;
  position: number | null;
}

interface Storage {
  game_state: GameState | null;
  background_choice: string | null;
}

// Custom hook to sync game state with Liveblocks
const useSyncedDominoGame = (roomId: string) => {
  const [allPlayers] = usePresence<Presence>({ fallback: { username: null, position: null } });
  const [gameData, setGameData] = useList<Storage>("game_data");
  const [playerPosition, setPlayerPosition] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Initialize the domino game hook
  const gameHook = useDominoGame();
  const { gameState, setGameState } = gameHook;

  // Function to find an available player position
  const findAvailablePosition = useCallback(() => {
    for (let i = 0; i < 4; i++) {
      if (!Object.values(allPlayers).some(player => player?.position === i)) {
        return i;
      }
    }
    return null; // No available positions
  }, [allPlayers]);

  // Assign player position on mount
  useEffect(() => {
    const position = findAvailablePosition();
    if (position !== null) {
      setPlayerPosition(position);
      // Update presence with username and position
      window.liveblocks.room.updatePresence({ position, username: `Player ${position + 1}` });
    }
  }, [findAvailablePosition]);

  // Sync game state from Liveblocks to local state
  useEffect(() => {
    setIsLoading(true);
    window.liveblocks.room.getStorage<Storage>().then((storage) => {
      const initialGameState = storage.root.game_state;
      if (initialGameState) {
        setGameState(initialGameState);
      }
      setIsLoading(false);
    });
  }, [setGameState, setIsLoading]);

  // Sync local game state to Liveblocks
  useEffect(() => {
    if (gameState) {
      window.liveblocks.room.updateStorage({
        root: { game_state: gameState },
      });
    }
  }, [gameState]);

  // Function to manually trigger blocked game check
  const manualBlockedCheck = useCallback(() => {
    if (!gameState) return;
    
    const openEnds = gameHook.regenerateOpenEnds(gameState);
    if (openEnds.length === 0) {
      console.log('❌ No open ends - game should be blocked');
      setGameState(prev => ({
        ...prev,
        isGameOver: true,
      }));
      return;
    }
    
    const requiredValues = new Set(openEnds.map(end => end.value));
    
    // Check all player hands
    const allPlayerHands = Object.values(allPlayers).map(player => 
      gameState.playerHands?.[player.position || 0] || []
    );
    
    const somePlayerCanPlay = allPlayerHands.some(hand => 
      hand.some(domino => 
        requiredValues.has(domino.value1) || requiredValues.has(domino.value2)
      )
    );
    
    if (somePlayerCanPlay) {
      console.log('✅ Some player can play - game continues');
      return;
    }
    
    // Check boneyard
    const boneyardHasMatching = gameState.boneyard?.some(domino => 
      requiredValues.has(domino.value1) || requiredValues.has(domino.value2)
    );
    
    if (boneyardHasMatching) {
      console.log('✅ Boneyard has matching tiles - game continues');
      return;
    }
    
    console.log('❌ GAME IS BLOCKED - Manually ending game');
    setGameState(prev => ({
      ...prev,
      isGameOver: true,
    }));
  }, [gameState, gameHook, allPlayers, setGameState]);

  return {
    syncState: {
      allPlayers,
      playerPosition,
      isLoading,
    },
    gameHook,
    manualBlockedCheck,
    gameData: gameData[0],
  };
};

export default function Game() {
  const roomId = "domino-game-room"; // Replace with your actual room ID
  const syncedGameHook = useSyncedDominoGame(roomId);
  const { gameHook, syncState } = syncedGameHook;
  const { gameState, setGameState } = gameHook;

  // Auto-check for blocked game after each move
  useEffect(() => {
    if (!gameState || gameState.isGameOver || !syncedGameHook.syncState?.allPlayers) return;
    
    const hasValidGameState = gameState.board && Object.keys(gameState.board).length > 0;
    if (!hasValidGameState) return;

    // Small delay to ensure all state updates are complete
    const timeoutId = setTimeout(() => {
      const currentPlayer = gameState.currentPlayer;
      
      console.log('🔍 AUTO Checking for blocked game on turn:', currentPlayer);
      
      const openEnds = syncedGameHook.gameHook.regenerateOpenEnds(gameState);
      console.log('🔍 Open ends for blocked check:', openEnds);
      
      if (openEnds.length === 0) {
        console.log('❌ No open ends - game should be blocked');
        // Automatically end the game when blocked
        syncedGameHook.gameHook.setGameState(prev => ({
          ...prev,
          isGameOver: true,
          gameEndReason: 'blocked'
        }));
        return;
      }
      
      const requiredValues = new Set(openEnds.map(end => end.value));
      console.log('🔍 Required values for matching:', Array.from(requiredValues));
      
      // Check all player hands
      const allPlayerHands = syncedGameHook.syncState.allPlayers.map((_, index) => 
        gameState.playerHands?.[index] || []
      );
      
      const somePlayerCanPlay = allPlayerHands.some(hand => 
        hand.some(domino => 
          requiredValues.has(domino.value1) || requiredValues.has(domino.value2)
        )
      );
      
      if (somePlayerCanPlay) {
        console.log('✅ Some player can play - game continues');
        return;
      }
      
      // Check boneyard
      const boneyardHasMatching = gameState.boneyard?.some(domino => 
        requiredValues.has(domino.value1) || requiredValues.has(domino.value2)
      );
      
      if (boneyardHasMatching) {
        console.log('✅ Boneyard has matching tiles - game continues');
        return;
      }
      
      console.log('❌ GAME IS BLOCKED - Automatically ending game');
      
      // Calculate points for all players to determine winner
      const playerPoints = allPlayerHands.map(hand => 
        hand.reduce((sum, domino) => sum + domino.value1 + domino.value2, 0)
      );
      
      console.log('🏆 Player points for blocked game:', playerPoints);
      
      // Find player with minimum points
      const minPoints = Math.min(...playerPoints);
      const winnerPosition = playerPoints.findIndex(points => points === minPoints);
      
      console.log('🏆 Winner position:', winnerPosition, 'with', minPoints, 'points');
      
      // Automatically end the game when blocked
      syncedGameHook.gameHook.setGameState(prev => ({
        ...prev,
        isGameOver: true,
        winner_position: winnerPosition,
        gameEndReason: 'blocked'
      }));
      
    }, 100); // Small delay to ensure state consistency
    
    return () => clearTimeout(timeoutId);
  }, [gameState?.board, gameState?.currentPlayer, gameState?.isGameOver, syncedGameHook.syncState?.allPlayers, syncedGameHook.gameHook]);

  // Function to manually trigger blocked game check
  const manualBlockedCheck = useCallback(() => {
    if (!gameState) return;
    
    const openEnds = gameHook.regenerateOpenEnds(gameState);
    if (openEnds.length === 0) {
      console.log('❌ No open ends - game should be blocked');
      setGameState(prev => ({
        ...prev,
        isGameOver: true,
      }));
      return;
    }
    
    const requiredValues = new Set(openEnds.map(end => end.value));
    
    // Check all player hands
    const allPlayerHands = syncState?.allPlayers?.map((_, index) => 
      gameState.playerHands?.[index] || []
    );
    
    const somePlayerCanPlay = allPlayerHands.some(hand => 
      hand.some(domino => 
        requiredValues.has(domino.value1) || requiredValues.has(domino.value2)
      )
    );
    
    if (somePlayerCanPlay) {
      console.log('✅ Some player can play - game continues');
      return;
    }
    
    // Check boneyard
    const boneyardHasMatching = gameState.boneyard?.some(domino => 
      requiredValues.has(domino.value1) || requiredValues.has(domino.value2)
    );
    
    if (boneyardHasMatching) {
      console.log('✅ Boneyard has matching tiles - game continues');
      return;
    }
    
    console.log('❌ GAME IS BLOCKED - Manually ending game');
    setGameState(prev => ({
      ...prev,
      isGameOver: true,
    }));
  }, [gameState, gameHook, syncState?.allPlayers, setGameState]);

  return (
    <div className="min-h-screen bg-background">
      <DominoGame gameHook={{...gameHook, manualBlockedCheck}} />
    </div>
  );
}
