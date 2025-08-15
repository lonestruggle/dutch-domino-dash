
import { useEffect, useCallback, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { DominoGame } from '@/components/DominoGame';
import { useDominoGame } from '@/hooks/useDominoGame';
import { useSyncedDominoGameState } from '@/hooks/useSyncedDominoGameState';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGameVisualSettings } from '@/hooks/useGameVisualSettings';
import type { GameState } from '@/types/domino';

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const savedRef = useRef(false);
  
  // Hard slam functionality
  const { hardSlamMode, startShakeAnimation, disarmHardSlam } = useGameVisualSettings();
  
  // Use the existing synced game state hook
  const { syncState, updateGameState, startNewGame: syncedStartNewGame } = useSyncedDominoGameState(gameId || '', user?.id || '');
  
  // Use the domino game hook
  const gameHook = useDominoGame();
  const { gameState, setGameState } = gameHook;

  // Ref om Changa-detectie te markeren tussen pre- en post-move
  const changaRef = useRef(false);
  
  // Sync the game state when synced state changes
  useEffect(() => {
    if (syncState.gameState && !syncState.isLoading) {
      setGameState(syncState.gameState);
    }
  }, [syncState.gameState, syncState.isLoading, setGameState]);

  // Sync my local hand/boneyard/board to Supabase after local actions to avoid duplicates
  const syncLocalToRemote = useCallback(() => {
    if (!syncState.gameState || !syncState.gameData) return;
    const remote = syncState.gameState as any;
    const myPos = syncState.playerPosition || 0;
    const nextHands = Array.isArray(remote.playerHands) ? [...remote.playerHands] : [];
    nextHands[myPos] = gameState.playerHand || [];

    const newStateToSave = {
      ...remote,
      dominoes: gameState.dominoes,
      board: gameState.board,
      boneyard: gameState.boneyard,
      forbiddens: gameState.forbiddens,
      openEnds: gameState.openEnds,
      nextDominoId: gameState.nextDominoId,
      spinnerId: gameState.spinnerId,
      isGameOver: gameState.isGameOver,
      playerHand: gameState.playerHand,
      playerHands: nextHands,
      gameEndReason: (gameState as any).gameEndReason,
      winner_position: (gameState as any).winner_position,
    };
    updateGameState(newStateToSave);
  }, [syncState.gameState, syncState.gameData, syncState.playerPosition, gameState, updateGameState]);

  // Wrap local actions and then sync
  const wrappedExecuteMove = useCallback((move: any) => {
    // Pre-move: detecteer CHANGA (ook bij dubbel)
    const myHand = gameState.playerHand || [];
    const isLastStone = myHand.length === 1;
    let isChangaCandidate = false;

    if (isLastStone && move?.dominoData) {
      const currentOpenEnds = gameHook.regenerateOpenEnds(gameState) || [];
      const endValues = currentOpenEnds.map(e => e.value);
      const v1 = move.dominoData.value1;
      const v2 = move.dominoData.value2;

      if (v1 === v2) {
        // Dubbel: CHANGA als er minimaal twee open einden met deze waarde zijn
        const sameCount = endValues.filter(v => v === v1).length;
        isChangaCandidate = sameCount >= 2;
      } else {
        // Niet-dubbel: CHANGA als beide waardes aanwezig zijn in de open einden
        const set = new Set(endValues);
        isChangaCandidate = set.has(v1) && set.has(v2);
      }
    }

    changaRef.current = isChangaCandidate;

    // Execute the move
    const moveResult = (gameHook as any).executeMove(move);
    
    // Trigger shake animation and auto-disarm Hard Slam after placing a tile
    if (hardSlamMode) {
      console.log('🔥 Hard Slam Mode is active - triggering shake animation');
      console.log('🔥 hardSlamMode value:', hardSlamMode);
      const shakeResult = startShakeAnimation();
      console.log('🔥 Shake animation result:', shakeResult);
      
      // Add delay before disarming to ensure animation has time to start
      setTimeout(() => {
        console.log('🔥 Disarming Hard Slam mode after shake');
        disarmHardSlam();
      }, 100);
    } else {
      console.log('🔥 Hard Slam Mode is NOT active, no shake animation');
    }

    // Markeer CHANGA direct en veilig op basis van de nieuwste state
    setTimeout(() => {
      if (!changaRef.current) return;
      const myPos = syncState.playerPosition || 0;
      setGameState(prev => {
        if (prev.isGameOver) return prev;
        const after = { ...(prev as any), isGameOver: true, gameEndReason: 'changa', winner_position: myPos } as any;
        updateGameState(after);
        return after;
      });
      // Optionele feedback
      toast({ title: 'CHANGA!', description: 'Je hebt gewonnen met CHANGA!' });
      changaRef.current = false;
    }, 50);

    setTimeout(syncLocalToRemote, 60);
    
    return moveResult;
  }, [gameHook, gameState, syncState.playerPosition, setGameState, updateGameState, syncLocalToRemote, toast, hardSlamMode, startShakeAnimation, disarmHardSlam]);

  const wrappedDrawFromBoneyard = useCallback(() => {
    (gameHook as any).drawFromBoneyard();
    setTimeout(syncLocalToRemote, 60);
  }, [gameHook, syncLocalToRemote]);

  const wrappedStartNewGame = useCallback(async () => {
    // Reset opslagvlag voor scorebord zodat nieuwe uitslag later kan worden opgeslagen
    savedRef.current = false;

    const blank: GameState = {
      dominoes: {},
      board: {},
      playerHand: [],
      playerHands: [],
      boneyard: [],
      openEnds: [],
      forbiddens: {},
      nextDominoId: 0,
      spinnerId: null,
      isGameOver: false,
      selectedHandIndex: null,
    };
    // Optimistische reset van UI
    setGameState(blank);
    // Start nieuw spel in backend en gebruik de teruggegeven state voor directe UI update
    const newState = await syncedStartNewGame();
    if (newState) {
      setGameState(newState);
    }
  }, [setGameState, syncedStartNewGame]);

  // Auto-check for blocked game after each move
  useEffect(() => {
    if (!gameState || gameState.isGameOver || !syncState.allPlayers.length) return;

    // Als iemand leeg is of CHANGA reeds gemarkeerd, geen blocked-check uitvoeren
    const anyEmptyHand =
      (gameState.playerHand?.length === 0) ||
      (gameState.playerHands || []).some(h => Array.isArray(h) && h.length === 0);
    if (anyEmptyHand || (gameState as any).gameEndReason === 'changa') return;
    
    const hasValidGameState = gameState.board && Object.keys(gameState.board).length > 0;
    if (!hasValidGameState) return;

    // Small delay to ensure all state updates are complete
    const timeoutId = setTimeout(() => {
      console.log('🔍 AUTO Checking for blocked game - CURRENT STATE');
      console.log('🔍 Game state at time of check:', {
        totalDominoes: Object.keys(gameState.dominoes).length,
        totalBoardCells: Object.keys(gameState.board).length,
        isGameOver: gameState.isGameOver
      });

      // Herhaal guard binnen timeout
      const stateNow: any = gameState;
      const anyEmptyNow = (stateNow.playerHand?.length === 0) || (stateNow.playerHands || []).some((h: any) => Array.isArray(h) && h.length === 0);
      if (anyEmptyNow || stateNow.gameEndReason === 'changa') {
        return;
      }
      
      // Use the CURRENT game state (not a stale reference)
      const currentOpenEnds = gameHook.regenerateOpenEnds(gameState);
      console.log('🔍 CURRENT Open ends for blocked check:', currentOpenEnds.map(end => `value:${end.value} at (${end.x},${end.y})`));
      
      if (currentOpenEnds.length === 0) {
        console.log('❌ No open ends - game should be blocked');
        // Automatically end the game when blocked
        const blockedState: GameState = {
          ...gameState,
          isGameOver: true,
          gameEndReason: 'blocked'
        };
        setGameState(blockedState);
        updateGameState(blockedState);
        return;
      }
      
      // NIEUWE BLOCKED GAME REGELS
      // Het spel is geblokkeerd als alle open ends hetzelfde getal vereisen 
      // EN alle 7 stenen van dat getal al op tafel liggen
      // Van elk getal (0,1,2,3,4,5,6) zijn er precies 7 stenen in een domino set
      
      const requiredValues = new Set(currentOpenEnds.map(end => end.value));
      console.log('🔍 Required values for matching (open ends):', Array.from(requiredValues));
      
      // Check if all open ends require the same value
      if (requiredValues.size === 1) {
        const requiredValue = Array.from(requiredValues)[0];
        console.log(`🔍 All open ends require value: ${requiredValue}`);
        
        // Count how many different domino tiles with this value are on the board
        // For example, for value "3" there are 7 tiles: [0|3], [1|3], [2|3], [3|3], [3|4], [3|5], [3|6]
        const tilesWithValue = new Set();
        Object.values(gameState.dominoes).forEach(domino => {
          if (domino.data.value1 === requiredValue || domino.data.value2 === requiredValue) {
            // Create unique identifier for each domino type
            const dominoKey = `${Math.min(domino.data.value1, domino.data.value2)}|${Math.max(domino.data.value1, domino.data.value2)}`;
            tilesWithValue.add(dominoKey);
            console.log(`🔍 Found tile with value ${requiredValue}: ${domino.data.value1}|${domino.data.value2} -> key: ${dominoKey}`);
          }
        });
        
        console.log(`🔍 All tiles with value ${requiredValue} on board:`, Array.from(tilesWithValue));
        console.log(`🔍 Count: ${tilesWithValue.size} (need 7 for blocked game)`);
        
        // Extra check: also count what's still in hands and boneyard
        const allPlayerHands = gameState.playerHands || [gameState.playerHand];
        const remainingTilesWithValue = new Set();
        
        // Check all player hands
        allPlayerHands.forEach((hand, playerIndex) => {
          hand.forEach(domino => {
            if (domino.value1 === requiredValue || domino.value2 === requiredValue) {
              const tileKey = `${Math.min(domino.value1, domino.value2)}|${Math.max(domino.value1, domino.value2)}`;
              remainingTilesWithValue.add(tileKey);
              console.log(`🔍 Player ${playerIndex} has tile with value ${requiredValue}: ${domino.value1}|${domino.value2}`);
            }
          });
        });
        
        // Check boneyard
        gameState.boneyard.forEach(domino => {
          if (domino.value1 === requiredValue || domino.value2 === requiredValue) {
            const tileKey = `${Math.min(domino.value1, domino.value2)}|${Math.max(domino.value1, domino.value2)}`;
            remainingTilesWithValue.add(tileKey);
            console.log(`🔍 Boneyard has tile with value ${requiredValue}: ${domino.value1}|${domino.value2}`);
          }
        });
        
        console.log(`🔍 Remaining tiles with value ${requiredValue} in hands/boneyard:`, Array.from(remainingTilesWithValue));
        console.log(`🔍 Total unique tile types with value ${requiredValue}: ${tilesWithValue.size + remainingTilesWithValue.size}`);
        
        console.log(`🔍 Different domino types with value ${requiredValue} on board: ${tilesWithValue.size}/7`);
        console.log('🔍 Domino types on board:', Array.from(tilesWithValue));
        
        // If all 7 tiles of this value are on the board, the game is blocked
        if (tilesWithValue.size >= 7) {
          console.log('❌ GAME IS BLOCKED - All tiles of required value are on board');
          
          // Calculate points for all players to determine winner
          const allPlayerHands = syncState.allPlayers.map((_, index) => 
            gameState.playerHands?.[index] || []
          );
          
          const playerPoints = allPlayerHands.map(hand => 
            hand.reduce((sum, domino) => sum + domino.value1 + domino.value2, 0)
          );
          
          console.log('🏆 Player points for blocked game:', playerPoints);
          
          // Find player with minimum points
          const minPoints = Math.min(...playerPoints);
          const winnerPosition = playerPoints.findIndex(points => points === minPoints);
          
          console.log('🏆 Winner position:', winnerPosition, 'with', minPoints, 'points');
          
          // Automatically end the game when blocked
          const blockedState: GameState = {
            ...gameState,
            isGameOver: true,
            winner_position: winnerPosition,
            gameEndReason: 'blocked'
          };
          setGameState(blockedState);
          updateGameState(blockedState);
          return;
        }
      }
      
      console.log('✅ Game not blocked - either different values required or not all tiles used');
      
    }, 100); // Small delay to ensure state consistency
    
    return () => clearTimeout(timeoutId);
  }, [gameState?.board, gameState?.currentPlayer, gameState?.isGameOver, syncState.allPlayers, gameHook, setGameState, updateGameState]);

  // Function to manually trigger blocked game check
  const manualBlockedCheck = useCallback(() => {
    if (!gameState) return;
    
    // IMPORTANT: If board is empty, game cannot be blocked
    const boardHasDominoes = gameState.board && Object.keys(gameState.board).length > 0;
    if (!boardHasDominoes) {
      console.log('✅ Board is empty - game cannot be blocked');
      return;
    }
    
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

  // Sla automatisch de uitslag op naar het scoreboard zodra het spel eindigt
  useEffect(() => {
    if (!gameState?.isGameOver || !syncState?.gameData || savedRef.current) return;

    savedRef.current = true;

    (async () => {
      try {
        // Zorg dat er een actief seizoen bestaat (maak er één aan indien nodig en toegestaan)
        const { data: season, error: seasonErr } = await supabase
          .from('seasons')
          .select('id')
          .eq('is_active', true)
          .maybeSingle();

        if (!season && !seasonErr) {
          const defaultName = `Seizoen ${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
          const { error: createSeasonErr } = await supabase.rpc('start_new_season', { _name: defaultName });
          if (createSeasonErr) {
            console.warn('start_new_season failed (non-blocking):', createSeasonErr);
          }
        }

        const hands = gameState.playerHands || [];
        const winnerPos = (gameState as any).winner_position !== undefined
          ? (gameState as any).winner_position
          : hands.findIndex(h => Array.isArray(h) && h.length === 0);

        const winnerUserId = winnerPos >= 0 && (syncState.allPlayers[winnerPos] as any)?.user_id
          ? (syncState.allPlayers[winnerPos] as any).user_id
          : null;

        const wonByChanga = (gameState as any).gameEndReason === 'changa';

        const players = syncState.allPlayers.map((p: any, index: number) => {
          const hand = hands[index] || [];
          const pips_remaining = hand.reduce((sum: number, d: any) => sum + d.value1 + d.value2, 0);
          if (!p.user_id) return null; // sla bots of onbekenden over
          return {
            user_id: p.user_id,
            player_position: index,
            points_scored: 0,
            pips_remaining,
            won: index === winnerPos,
            hard_slams_used: 0,
            turns_played: 0,
            won_by_changa: index === winnerPos ? wonByChanga : false,
          };
        }).filter(Boolean);

        const { error } = await supabase.rpc('record_game_outcome', {
          _game_id: syncState.gameData.id,
          _lobby_id: syncState.gameData.lobby_id,
          _winner_user_id: winnerUserId,
          _is_blocked: (gameState as any).gameEndReason === 'blocked',
          _players: players,
        });

        if (error) {
          console.error('record_game_outcome error', error);
          toast({
            title: 'Opslaan mislukt',
            description: error.message || 'Kon uitslag niet opslaan.',
            variant: 'destructive'
          });
        } else {
          toast({ 
            title: wonByChanga ? 'Uitslag: CHANGA' : 'Uitslag opgeslagen', 
            description: wonByChanga ? 'Scorebord bijgewerkt — gewonnen met CHANGA!' : 'Scorebord bijgewerkt.' 
          });
        }
      } catch (err: any) {
        console.error('Result save flow error', err);
        toast({
          title: 'Opslaan mislukt',
          description: err?.message || 'Onbekende fout bij opslaan.',
          variant: 'destructive'
        });
      }
    })();
  }, [gameState?.isGameOver, syncState?.gameData, toast]);

  return (
    <div className="min-h-screen bg-background">
      <DominoGame 
        gameHook={{
          ...gameHook, 
          executeMove: wrappedExecuteMove,
          drawFromBoneyard: wrappedDrawFromBoneyard,
          manualBlockedCheck,
          startNewGame: wrappedStartNewGame,
          syncState,
          gameData: syncState.gameData || { background_choice: null }
        }}
      />
    </div>
  );
}
