
import { useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { DominoGame } from '@/components/DominoGame';
import { useDominoGame } from '@/hooks/useDominoGame';
import { PersistedGameState, useSyncedDominoGameState } from '@/hooks/useSyncedDominoGameState';
import { useBotAI } from '@/hooks/useBotAI';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useGameVisualSettings } from '@/hooks/useGameVisualSettings';
import type { GameState, LegalMove, ShakeAnimationProfile } from '@/types/domino';

type MoveWithEffects = LegalMove & { localHardSlamActive?: boolean };

interface GameOutcomePlayerPayload {
  user_id: string;
  player_position: number;
  points_scored: number;
  pips_remaining: number;
  won: boolean;
  hard_slams_used: number;
  turns_played: number;
  won_by_changa: boolean;
}

interface BotDebugInfo {
  status: string;
  details: string;
  isBotTurn: boolean;
  currentPlayer: number;
  controllerPosition: number | null;
  turnKey: string;
  legalMoves: number;
  boneyardSize: number;
  updatedAt: number;
}

const buildConsolidatedState = (
  remoteState: PersistedGameState | null,
  currentState: GameState,
  myPos: number,
  actorPos?: number
): PersistedGameState => {
  const remote = remoteState ?? ({} as PersistedGameState);
  const remoteHands = Array.isArray(remote.playerHands) ? [...remote.playerHands] : [];
  const nextHands = Array.isArray(currentState.playerHands) ? [...currentState.playerHands] : remoteHands;
  const effectiveActor = typeof actorPos === 'number' ? actorPos : myPos;

  if (!Array.isArray(currentState.playerHands)) {
    nextHands[effectiveActor] = currentState.playerHand || [];
  }

  const localPlayerHand = nextHands[myPos] || currentState.playerHand || [];

  return {
    ...remote,
    dominoes: currentState.dominoes,
    board: currentState.board,
    boneyard: currentState.boneyard,
    forbiddens: currentState.forbiddens,
    openEnds: currentState.openEnds,
    nextDominoId: currentState.nextDominoId,
    spinnerId: currentState.spinnerId,
    isGameOver: currentState.isGameOver,
    playerHand: localPlayerHand,
    playerHands: nextHands,
    gameEndReason: currentState.gameEndReason,
    winner_position: currentState.winner_position,
    hardSlamNextMove: currentState.hardSlamNextMove,
    isHardSlamming: currentState.isHardSlamming,
    hardSlamDominoId: currentState.hardSlamDominoId,
    triggerHardSlamAnimation: currentState.triggerHardSlamAnimation,
    hardSlamAnimationProfile: currentState.hardSlamAnimationProfile,
  };
};

export default function Game() {
  const { gameId } = useParams<{ gameId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const savedRef = useRef(false);
  const executeMoveSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const drawSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passMoveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardSlamResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const botTurnExecutionRef = useRef<string | null>(null);
  const botTurnObservedAtRef = useRef<Record<string, number>>({});
  const [botDebugInfo, setBotDebugInfo] = useState<BotDebugInfo>({
    status: 'init',
    details: 'Bot debug gestart',
    isBotTurn: false,
    currentPlayer: 0,
    controllerPosition: null,
    turnKey: '-',
    legalMoves: 0,
    boneyardSize: 0,
    updatedAt: Date.now(),
  });
  
  // Hard slam functionality
  const { disarmHardSlam, settings } = useGameVisualSettings();
  const { calculateBestMove } = useBotAI();
  
  // Use the existing synced game state hook
  const { syncState, updateGameState, startNewGame: syncedStartNewGame } = useSyncedDominoGameState(gameId || '', user?.id || '');
  
  // Use the domino game hook with shake animation support
  const gameHook = useDominoGame(syncState.playerPosition);
  const { gameState, setGameState } = gameHook;

  // Ref om Changa-detectie te markeren tussen pre- en post-move
  const changaRef = useRef(false);

  useEffect(() => {
    return () => {
      if (executeMoveSyncTimeoutRef.current) clearTimeout(executeMoveSyncTimeoutRef.current);
      if (drawSyncTimeoutRef.current) clearTimeout(drawSyncTimeoutRef.current);
      if (passMoveTimeoutRef.current) clearTimeout(passMoveTimeoutRef.current);
      if (hardSlamResetTimeoutRef.current) clearTimeout(hardSlamResetTimeoutRef.current);
    };
  }, []);
  
  // Sync the game state when synced state changes
  useEffect(() => {
    if (syncState.gameState && !syncState.isLoading) {
      setGameState(syncState.gameState);
    }
  }, [syncState.gameState, syncState.isLoading, setGameState]);

  // Removed syncLocalToRemote - now using SINGLE consolidated updates instead of double updates

  // Wrap local actions and then sync - SINGLE CONSOLIDATED UPDATE
  const wrappedExecuteMove = useCallback((move: MoveWithEffects) => {
    console.log('🎬 🎯 WRAPPED EXECUTE MOVE CALLED!', move);
    const actorPosition = typeof move.actorPosition === 'number' ? move.actorPosition : syncState.currentPlayer;
    console.log('🎯 Acting player position:', actorPosition);
    console.log('🔥 localHardSlamActive:', move?.localHardSlamActive);
    
    // Turn validation removed - database controls turns completely now
    
    // Pre-move: detecteer CHANGA (ook bij dubbel)
    const actorHand = gameState.playerHands?.[actorPosition] || (actorPosition === syncState.playerPosition ? gameState.playerHand : []);
    const isLastStone = actorHand.length === 1;
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

    const hardSlamDominoId = move?.localHardSlamActive ? `d${gameState.nextDominoId}` : undefined;
    const hardSlamAnimationProfile: ShakeAnimationProfile | undefined = (move?.localHardSlamActive && hardSlamDominoId)
      ? {
          eventId: `${hardSlamDominoId}-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
          seed: Math.floor(Math.random() * 0x7fffffff),
          startedAtMs: Date.now(),
          intensity: settings.shakeIntensity,
          duration: settings.shakeDuration,
          rotationAmplitudeX: settings.rotationAmplitudeX,
          rotationAmplitudeY: settings.rotationAmplitudeY,
          rotationAmplitudeZ: settings.rotationAmplitudeZ,
          rotationSpeed: settings.rotationSpeed,
        }
      : undefined;

    if (move?.localHardSlamActive && hardSlamDominoId) {
      // Arm hard slam BEFORE move execution so executeMove can apply the effect on this move.
      setGameState((currentState) => ({
        ...currentState,
        hardSlamNextMove: true,
        isHardSlamming: true,
        hardSlamDominoId,
        triggerHardSlamAnimation: true,
        hardSlamAnimationProfile,
      }));
    }

    // Execute the move locally
    gameHook.executeMove({ ...move, actorPosition });
    
    if (!syncState.allPlayers.length) return;

    // Calculate next player turn using the actual acting player (human or bot).
    const nextPlayerTurn = (actorPosition + 1) % syncState.allPlayers.length;
    console.log('🎯 Advancing turn from', actorPosition, 'to', nextPlayerTurn);

    // SINGLE CONSOLIDATED DATABASE UPDATE - capture fresh state
    if (executeMoveSyncTimeoutRef.current) {
      clearTimeout(executeMoveSyncTimeoutRef.current);
    }

    executeMoveSyncTimeoutRef.current = setTimeout(() => {
      executeMoveSyncTimeoutRef.current = null;
      setGameState(currentState => {
        console.log('🔄 SINGLE CONSOLIDATED UPDATE - capturing fresh state');
        
        // Prepare consolidated state with turn advancement
        const myPos = syncState.playerPosition || 0;
        let finalState: PersistedGameState = {
          ...buildConsolidatedState(syncState.gameState, currentState, myPos, actorPosition),
          // Reset hard slam game logic after domino placement
          isHardSlamming: false,
          triggerHardSlamAnimation: Boolean(move?.localHardSlamActive),
          hardSlamDominoId: move?.localHardSlamActive ? hardSlamDominoId : currentState.hardSlamDominoId,
          hardSlamAnimationProfile: move?.localHardSlamActive ? hardSlamAnimationProfile : currentState.hardSlamAnimationProfile,
        };

        // Check for CHANGA and update state accordingly
        if (changaRef.current) {
          finalState = {
            ...finalState,
            isGameOver: true,
            gameEndReason: 'changa',
            winner_position: actorPosition
          };
          const winnerLabel = actorPosition === syncState.playerPosition
            ? 'Je hebt gewonnen met CHANGA!'
            : `${syncState.allPlayers[actorPosition]?.username || 'Een speler'} won met CHANGA!`;
          toast({ title: 'CHANGA!', description: winnerLabel });
          changaRef.current = false;
        }

        // SINGLE database update with consolidated state AND turn advancement
        updateGameState(finalState, nextPlayerTurn);
        
        return currentState; // Return current state to avoid double setting
      });
    }, 150); // Slightly longer delay for better state consistency
  }, [gameHook, gameState, setGameState, settings.rotationAmplitudeX, settings.rotationAmplitudeY, settings.rotationAmplitudeZ, settings.rotationSpeed, settings.shakeDuration, settings.shakeIntensity, syncState.allPlayers, syncState.allPlayers.length, syncState.currentPlayer, syncState.gameState, syncState.playerPosition, toast, updateGameState]);

  const wrappedDrawFromBoneyard = useCallback(async (actorPosition?: number) => {
    console.log('🎲 Draw from boneyard - turn validation removed, database controls turns');
    const actingPosition = typeof actorPosition === 'number' ? actorPosition : syncState.currentPlayer;

    // Execute draw locally - database will validate turn
    gameHook.drawFromBoneyard(actingPosition);
    
    // Keep current turn after drawing from boneyard
    if (drawSyncTimeoutRef.current) {
      clearTimeout(drawSyncTimeoutRef.current);
    }

    drawSyncTimeoutRef.current = setTimeout(() => {
      drawSyncTimeoutRef.current = null;
      setGameState(currentState => {
        console.log('🔄 Drawing with MANDATORY turn advancement');
        
        // Prepare consolidated state
        const myPos = syncState.playerPosition || 0;
        const finalState = buildConsolidatedState(syncState.gameState, currentState, myPos, actingPosition);

        // NO turn advancement for boneyard draw - player stays on turn
        console.log('🎯 DRAW - No turn advancement, player stays on turn:', syncState.currentPlayer);

        // Keep current player on turn (no advancement)
        updateGameState(finalState, syncState.currentPlayer);
        
        return currentState;
      });
    }, 150);
  }, [gameHook, setGameState, syncState.currentPlayer, syncState.gameState, syncState.playerPosition, updateGameState]);

  const wrappedStartNewGame = useCallback(async () => {
    // Reset opslagvlag voor scorebord zodat nieuwe uitslag later kan worden opgeslagen
    savedRef.current = false;

    // Reset alle shake states bij nieuw spel
    if (disarmHardSlam) {
      disarmHardSlam();
    }

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
  }, [disarmHardSlam, setGameState, syncedStartNewGame]);

  // Auto-check for blocked game after each move
  useEffect(() => {
    if (!gameState || gameState.isGameOver || !syncState.allPlayers.length) return;

    // Als iemand leeg is of CHANGA reeds gemarkeerd, geen blocked-check uitvoeren
    const anyEmptyHand =
      (gameState.playerHand?.length === 0) ||
      (gameState.playerHands || []).some(h => Array.isArray(h) && h.length === 0);
    if (anyEmptyHand || gameState.gameEndReason === 'changa') return;
    
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
      const anyEmptyNow = (gameState.playerHand?.length === 0) || (gameState.playerHands || []).some((h) => Array.isArray(h) && h.length === 0);
      if (anyEmptyNow || gameState.gameEndReason === 'changa') {
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
        // Game over - no turn advancement needed, keep current turn
        updateGameState(blockedState, syncState.currentPlayer);
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
          // Game over - no turn advancement needed, keep current turn
          updateGameState(blockedState, syncState.currentPlayer);
          return;
        }
      }
      
      console.log('✅ Game not blocked - either different values required or not all tiles used');
      
    }, 100); // Small delay to ensure state consistency
    
    return () => clearTimeout(timeoutId);
  }, [gameState, syncState.allPlayers, syncState.currentPlayer, gameHook, setGameState, updateGameState]);

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
      // Game over - no turn advancement needed, keep current turn
      updateGameState(updatedGameState, syncState.currentPlayer);
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
    // Game over - no turn advancement needed, keep current turn
    updateGameState(updatedGameState, syncState.currentPlayer);
  }, [gameState, gameHook, syncState.allPlayers, syncState.currentPlayer, setGameState, updateGameState]);

  // Pass move function
  const passMove = useCallback((actorPosition?: number) => {
    const actingPosition = typeof actorPosition === 'number' ? actorPosition : syncState.currentPlayer;

    // Advance to next player turn after pass based on the acting player (human or bot).
    const nextPlayerTurn = (actingPosition + 1) % syncState.allPlayers.length;
    console.log('🎯 Pass move - advancing turn from', actingPosition, 'to', nextPlayerTurn);
    
    // Pass doesn't change game state, just advances turn
    if (passMoveTimeoutRef.current) {
      clearTimeout(passMoveTimeoutRef.current);
    }

    passMoveTimeoutRef.current = setTimeout(() => {
      passMoveTimeoutRef.current = null;
      // EXTRA VALIDATION: Double-check turn ownership before database update
      if (syncState.currentPlayer !== actingPosition) {
        console.log('🚫 PASS MOVE BLOCKED: Turn changed during timeout, aborting database update');
        console.log('Expected player:', actingPosition, 'Current player:', syncState.currentPlayer);
        return;
      }
      
      console.log('🔄 PASS MOVE - Advancing turn only');
      console.log('✅ PASS MOVE VALIDATED: Player', actingPosition, 'confirmed as current player');
      // Only update the turn, no game state changes needed for pass
      if (syncState.gameData) {
        updateGameState(syncState.gameState, nextPlayerTurn);
      }
    }, 150);
  }, [syncState.currentPlayer, syncState.allPlayers.length, syncState.gameData, syncState.gameState, updateGameState]);

  const getBotDifficulty = useCallback((botName: string): 'easy' | 'medium' | 'hard' => {
    if (botName.includes('Dave') || botName.includes('Betty')) return 'easy';
    if (botName.includes('Raja') || botName.includes('Sam')) return 'hard';
    return 'medium';
  }, []);

  const botControllerPosition = useMemo(() => {
    const humanPositions = syncState.allPlayers
      .filter((player) => !player.is_bot)
      .map((player) => player.position)
      .sort((a, b) => a - b);
    return humanPositions.length > 0 ? humanPositions[0] : null;
  }, [syncState.allPlayers]);

  // One deterministic human client drives bot turns (single authority to avoid duplicate bot moves).
  useEffect(() => {
    if (gameState.isGameOver || !syncState.allPlayers.length) {
      setBotDebugInfo((prev) => ({
        ...prev,
        status: 'idle',
        details: gameState.isGameOver ? 'Game over' : 'Geen spelers',
        isBotTurn: false,
        currentPlayer: syncState.currentPlayer,
        controllerPosition: botControllerPosition,
        turnKey: '-',
        legalMoves: 0,
        boneyardSize: gameState.boneyard.length,
        updatedAt: Date.now(),
      }));
      return;
    }

    const currentPlayerData = syncState.allPlayers.find((player) => player.position === syncState.currentPlayer);
    if (!currentPlayerData?.is_bot) {
      botTurnExecutionRef.current = null;
      setBotDebugInfo((prev) => ({
        ...prev,
        status: 'waiting-human',
        details: `Beurt van ${currentPlayerData?.username || 'speler'}`,
        isBotTurn: false,
        currentPlayer: syncState.currentPlayer,
        controllerPosition: botControllerPosition,
        turnKey: '-',
        legalMoves: 0,
        boneyardSize: gameState.boneyard.length,
        updatedAt: Date.now(),
      }));
      return;
    }

    const localPlayerData = syncState.allPlayers.find((player) => player.position === syncState.playerPosition);
    if (localPlayerData?.is_bot) {
      setBotDebugInfo((prev) => ({
        ...prev,
        status: 'blocked',
        details: 'Lokale client is bot; geen botsturing',
        isBotTurn: true,
        currentPlayer: syncState.currentPlayer,
        controllerPosition: botControllerPosition,
        turnKey: '-',
        legalMoves: 0,
        boneyardSize: gameState.boneyard.length,
        updatedAt: Date.now(),
      }));
      return;
    }

    const actorPosition = syncState.currentPlayer;
    const turnIdentity = `${actorPosition}:${gameState.nextDominoId}`;
    if (!botTurnObservedAtRef.current[turnIdentity]) {
      botTurnObservedAtRef.current[turnIdentity] = Date.now();
    }
    const turnAgeMs = Date.now() - botTurnObservedAtRef.current[turnIdentity];
    const isDesignatedController = botControllerPosition !== null && syncState.playerPosition === botControllerPosition;

    // Fallback takeover: if designated controller did nothing, any human can execute after delay.
    if (!isDesignatedController && turnAgeMs < 1800) {
      setBotDebugInfo((prev) => ({
        ...prev,
        status: 'waiting-controller',
        details: `Wachten op controller (${turnAgeMs}ms)`,
        isBotTurn: true,
        currentPlayer: syncState.currentPlayer,
        controllerPosition: botControllerPosition,
        turnKey: turnIdentity,
        legalMoves: 0,
        boneyardSize: gameState.boneyard.length,
        updatedAt: Date.now(),
      }));
      return;
    }

    const botHand = gameState.playerHands?.[actorPosition] || [];
    const botTurnKey = `${actorPosition}:${gameState.nextDominoId}:${botHand.length}:${gameState.boneyard.length}`;
    if (botTurnExecutionRef.current === botTurnKey) {
      setBotDebugInfo((prev) => ({
        ...prev,
        status: 'locked',
        details: 'Bot turn lock actief',
        isBotTurn: true,
        currentPlayer: syncState.currentPlayer,
        controllerPosition: botControllerPosition,
        turnKey: botTurnKey,
        legalMoves: prev.legalMoves,
        boneyardSize: gameState.boneyard.length,
        updatedAt: Date.now(),
      }));
      return;
    }

    botTurnExecutionRef.current = botTurnKey;
    setBotDebugInfo((prev) => ({
      ...prev,
      status: isDesignatedController ? 'controller' : 'fallback-controller',
      details: `Bot ${currentPlayerData.username} verwerken`,
      isBotTurn: true,
      currentPlayer: syncState.currentPlayer,
      controllerPosition: botControllerPosition,
      turnKey: botTurnKey,
      legalMoves: 0,
      boneyardSize: gameState.boneyard.length,
      updatedAt: Date.now(),
    }));

    const runBotTurn = async () => {
      const latestBotHand = gameState.playerHands?.[actorPosition] || [];
      let legalMovesForBot: MoveWithEffects[] = [];

      latestBotHand.forEach((domino, index) => {
        const moves = gameHook.findLegalMoves(domino);
        if (moves.length === 0) return;

        legalMovesForBot = legalMovesForBot.concat(
          moves.map((move) => ({ ...move, index, actorPosition }))
        );
      });

      try {
        await new Promise((resolve) => setTimeout(resolve, 350));
        if (botTurnExecutionRef.current !== botTurnKey) return;

        const boneyardSize = gameState.boneyard.length;
        const difficulty = getBotDifficulty(currentPlayerData.username);
        const selectedMove = calculateBestMove(
          latestBotHand,
          legalMovesForBot,
          { difficulty, thinkingTime: 0 }
        );

        setBotDebugInfo((prev) => ({
          ...prev,
          status: 'deciding',
          details: selectedMove ? 'Bot kiest zet' : boneyardSize > 0 ? 'Bot trekt uit boneyard' : 'Bot past',
          isBotTurn: true,
          currentPlayer: syncState.currentPlayer,
          controllerPosition: botControllerPosition,
          turnKey: botTurnKey,
          legalMoves: legalMovesForBot.length,
          boneyardSize,
          updatedAt: Date.now(),
        }));

        if (selectedMove) {
          wrappedExecuteMove({ ...selectedMove, actorPosition });
          setTimeout(() => {
            if (botTurnExecutionRef.current === botTurnKey) {
              botTurnExecutionRef.current = null;
            }
          }, 2500);
          return;
        }

        if (boneyardSize > 0) {
          botTurnExecutionRef.current = null;
          void wrappedDrawFromBoneyard(actorPosition);
          return;
        }

        passMove(actorPosition);
        setTimeout(() => {
          if (botTurnExecutionRef.current === botTurnKey) {
            botTurnExecutionRef.current = null;
          }
        }, 2500);
      } catch (error) {
        console.error('❌ Bot move execution failed:', error);
        botTurnExecutionRef.current = null;
        setBotDebugInfo((prev) => ({
          ...prev,
          status: 'error',
          details: error instanceof Error ? error.message : 'Onbekende botfout',
          isBotTurn: true,
          currentPlayer: syncState.currentPlayer,
          controllerPosition: botControllerPosition,
          turnKey: botTurnKey,
          updatedAt: Date.now(),
        }));
      }
    };

    void runBotTurn();
  }, [
    gameHook,
    gameState,
    calculateBestMove,
    getBotDifficulty,
    passMove,
    syncState.allPlayers,
    botControllerPosition,
    syncState.currentPlayer,
    syncState.playerPosition,
    wrappedDrawFromBoneyard,
    wrappedExecuteMove,
  ]);

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
        const winnerPos = gameState.winner_position !== undefined
          ? gameState.winner_position
          : hands.findIndex(h => Array.isArray(h) && h.length === 0);

        const winnerUserId = winnerPos >= 0
          ? (syncState.allPlayers[winnerPos]?.user_id ?? null)
          : null;

        const wonByChanga = gameState.gameEndReason === 'changa';

        const players: GameOutcomePlayerPayload[] = syncState.allPlayers.flatMap((p, index) => {
          if (!p.user_id) return []; // sla bots of onbekenden over

          const hand = hands[index] || [];
          const pips_remaining = hand.reduce((sum, d) => sum + d.value1 + d.value2, 0);
          return [{
            user_id: p.user_id,
            player_position: index,
            points_scored: 0,
            pips_remaining,
            won: index === winnerPos,
            hard_slams_used: 0,
            turns_played: 0,
            won_by_changa: index === winnerPos ? wonByChanga : false,
          }];
        });

        const { error } = await supabase.rpc('record_game_outcome', {
          _game_id: syncState.gameData.id,
          _lobby_id: syncState.gameData.lobby_id,
          _winner_user_id: winnerUserId,
          _is_blocked: gameState.gameEndReason === 'blocked',
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
      } catch (err: unknown) {
        const description = err instanceof Error ? err.message : 'Onbekende fout bij opslaan.';
        console.error('Result save flow error', err);
        toast({
          title: 'Opslaan mislukt',
          description,
          variant: 'destructive'
        });
      }
    })();
  }, [gameState?.isGameOver, gameState?.gameEndReason, gameState?.winner_position, gameState?.playerHands, syncState?.gameData, syncState.allPlayers, toast]);

  // Wrapper for hardSlam that immediately syncs to database
  const wrappedHardSlam = useCallback(async () => {
    console.log('🔥 HARD SLAM ACTIVATED - SYNCING TO DATABASE!');
    const hardSlamAnimationProfile: ShakeAnimationProfile = {
      eventId: `queued-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`,
      seed: Math.floor(Math.random() * 0x7fffffff),
      startedAtMs: Date.now(),
      intensity: settings.shakeIntensity,
      duration: settings.shakeDuration,
      rotationAmplitudeX: settings.rotationAmplitudeX,
      rotationAmplitudeY: settings.rotationAmplitudeY,
      rotationAmplitudeZ: settings.rotationAmplitudeZ,
      rotationSpeed: settings.rotationSpeed,
    };
    
    // Construct the new state directly with hard slam flags
    const newStateWithHardSlam = {
      ...gameState,
      hardSlamNextMove: true,
      isHardSlamming: true,
      triggerHardSlamAnimation: true, // New animation flag for all players
      hardSlamAnimationProfile,
    };
    
    // Update local state first
    setGameState(newStateWithHardSlam);
    
    // Then immediately sync the same state to database
    if (updateGameState) {
      try {
        // Hard slam - no turn advancement needed, keep current turn
        await updateGameState(newStateWithHardSlam, syncState.currentPlayer);
        console.log('✅ Hard Slam synced to database successfully');
        
        // Reset animation trigger after 2 seconds (allows 1.5s animation + buffer)
        if (hardSlamResetTimeoutRef.current) {
          clearTimeout(hardSlamResetTimeoutRef.current);
        }

        hardSlamResetTimeoutRef.current = setTimeout(async () => {
          hardSlamResetTimeoutRef.current = null;
          const resetState = {
            ...newStateWithHardSlam,
            triggerHardSlamAnimation: false,
          };
          await updateGameState(resetState, syncState.currentPlayer);
          console.log('🔥 Reset triggerHardSlamAnimation after 2 seconds');
        }, 2000);
        
      } catch (error) {
        console.error('❌ Failed to sync Hard Slam to database:', error);
      }
    }
  }, [
    gameState,
    settings.rotationAmplitudeX,
    settings.rotationAmplitudeY,
    settings.rotationAmplitudeZ,
    settings.rotationSpeed,
    settings.shakeDuration,
    settings.shakeIntensity,
    updateGameState,
    setGameState,
    syncState.currentPlayer
  ]);

  return (
    <div className="min-h-screen bg-background">
      <DominoGame 
        gameHook={{
          ...gameHook, 
          executeMove: wrappedExecuteMove,
          drawFromBoneyard: wrappedDrawFromBoneyard,
          passMove,
          manualBlockedCheck,
          startNewGame: wrappedStartNewGame,
          hardSlam: wrappedHardSlam,
          botDebugInfo,
          syncState,
          gameData: syncState.gameData || { background_choice: null }
        }}
      />
    </div>
  );
}
