import { useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { DominoGame } from '@/components/DominoGame';
import { useDominoGame } from '@/hooks/useDominoGame';
import { useSyncedDominoGameState } from '@/hooks/useSyncedDominoGameState';
import { useAuth } from '@/hooks/useAuth';

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  
  // Use the existing synced game state hook
  const { syncState, updateGameState, startNewGame: syncedStartNewGame } = useSyncedDominoGameState(gameId || '', user?.id || '');
  
  // Use the domino game hook
  const gameHook = useDominoGame();
  const { gameState, setGameState } = gameHook;
  
  // Sync the game state when synced state changes
  useEffect(() => {
    if (syncState.gameState && !syncState.isLoading) {
      setGameState(syncState.gameState);
    }
  }, [syncState.gameState, syncState.isLoading, setGameState]);

  // Auto-check for blocked game after each move
  useEffect(() => {
    if (!gameState || gameState.isGameOver || !syncState.allPlayers.length) return;
    
    const hasValidGameState = gameState.board && Object.keys(gameState.board).length > 0;
    if (!hasValidGameState) return;

    // Small delay to ensure all state updates are complete
    const timeoutId = setTimeout(() => {
      console.log('🔍 AUTO Checking for blocked game');
      
      const openEnds = gameHook.regenerateOpenEnds(gameState);
      console.log('🔍 Open ends for blocked check:', openEnds);
      
      if (openEnds.length === 0) {
        console.log('❌ No open ends - game should be blocked');
        // Automatically end the game when blocked
        const updatedGameState = {
          ...gameState,
          isGameOver: true,
          gameEndReason: 'blocked'
        };
        setGameState(updatedGameState);
        updateGameState(updatedGameState);
        return;
      }
      
      const requiredValues = new Set(openEnds.map(end => end.value));
      console.log('🔍 Required values for matching:', Array.from(requiredValues));
      
      // Check all player hands
      const allPlayerHands = syncState.allPlayers.map((_, index) => 
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
      const updatedGameState = {
        ...gameState,
        isGameOver: true,
        winner_position: winnerPosition,
        gameEndReason: 'blocked'
      };
      setGameState(updatedGameState);
      updateGameState(updatedGameState);
      
    }, 100); // Small delay to ensure state consistency
    
    return () => clearTimeout(timeoutId);
  }, [gameState?.board, gameState?.currentPlayer, gameState?.isGameOver, syncState.allPlayers, gameHook, setGameState, updateGameState]);

  // Function to manually trigger blocked game check
  const manualBlockedCheck = useCallback(() => {
    if (!gameState) return;
    
    const openEnds = gameHook.regenerateOpenEnds(gameState);
    if (openEnds.length === 0) {
      console.log('❌ No open ends - game should be blocked');
      const updatedGameState = {
        ...gameState,
        isGameOver: true,
      };
      setGameState(updatedGameState);
      updateGameState(updatedGameState);
      return;
    }
    
    const requiredValues = new Set(openEnds.map(end => end.value));
    
    // Check all player hands
    const allPlayerHands = syncState.allPlayers.map((_, index) => 
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
    const updatedGameState = {
      ...gameState,
      isGameOver: true,
    };
    setGameState(updatedGameState);
    updateGameState(updatedGameState);
  }, [gameState, gameHook, syncState.allPlayers, setGameState, updateGameState]);

  return (
    <div className="min-h-screen bg-background">
      <DominoGame 
        gameHook={{
          ...gameHook, 
          manualBlockedCheck,
          startNewGame: syncedStartNewGame,
          syncState,
          gameData: { background_choice: null }
        }} 
      />
    </div>
  );
}