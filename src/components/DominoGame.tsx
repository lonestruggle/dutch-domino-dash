import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameBoard } from '@/components/GameBoard';
import { PlayerHand } from '@/components/PlayerHand';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Switch } from '@/components/ui/switch';
import { DominoTile } from '@/components/DominoTile';
import { useIsMobile } from '@/hooks/use-mobile';
import { Trophy, PartyPopper, Star, Eye, ArrowLeft, Grid3X3, Menu, X } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useGameVisualSettings } from '@/hooks/useGameVisualSettings';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { useUserRoles } from '@/hooks/useUserRoles';
import { useAppSettings } from '@/hooks/useAppSettings';
import { cn } from '@/lib/utils';
import type { DominoData, ShakeAnimationProfile } from '@/types/domino';

interface DominoGameProps {
  gameHook: any;
}

export const DominoGame = ({ gameHook }: DominoGameProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const { startShakeAnimation, isAnimating: isVisualAnimating } = useGameVisualSettings();
  const { canHardSlam } = useUserPermissions();
  const { isAdmin } = useUserRoles();
  const { getSetting } = useAppSettings();
  
  const {
    gameState,
    findLegalMoves,
    selectHandDomino,
    drawFromBoneyard,
    startNewGame,
    hasDifferentNeighbor,
    rotateDomino,
    botDebugInfo,
    syncState,
    gameData
  } = gameHook;
  const playerUserIds = useMemo(
    () => (syncState?.allPlayers || []).map((player: any) => player.user_id).filter(Boolean),
    [syncState?.allPlayers]
  );

  // Hard Slam logic - separate local button state from global effect
  const canUseHardSlam = canHardSlam && !gameState?.isGameOver;
  const [localHardSlamActive, setLocalHardSlamActive] = useState(false);
  const hardSlamActive = localHardSlamActive; // Local activation controls when to send hard slam to database

  const [showGameOverDialog, setShowGameOverDialog] = useState(false);
  const [hasShownDialog, setHasShownDialog] = useState(false);
  const [showBoneyardDialog, setShowBoneyardDialog] = useState(false);
  const [boneyardViewEnabled, setBoneyardViewEnabled] = useState(false);
  const [previewDomino, setPreviewDomino] = useState<{ domino: DominoData; index: number } | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [fixShapeIndex, setFixShapeIndex] = useState(0);
  const [isFixingTable, setIsFixingTable] = useState(false);
  const [moveCooldownNowMs, setMoveCooldownNowMs] = useState(() => Date.now());
  const previewTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [startingNewGame, setStartingNewGame] = useState(false);
  const [confirmNewGameOpen, setConfirmNewGameOpen] = useState(false);
  const { toast } = useToast();

  const actuallyStartNewGame = async () => {
    setStartingNewGame(true);
    try {
      await startNewGame();
    } finally {
      setTimeout(() => setStartingNewGame(false), 800);
      setConfirmNewGameOpen(false);
    }
  };

  const handleStartNewGame = async () => {
    if (!syncState?.isHost) {
      toast({ title: 'Alleen host', description: 'Alleen de host kan een nieuw spel starten.', variant: 'destructive' });
      return;
    }
    if (startingNewGame) return;

    const boardHasDominoes = Boolean(gameState && gameState.board && Object.keys(gameState.board).length > 0);
    if (boardHasDominoes) {
      setConfirmNewGameOpen(true);
      return;
    }

    await actuallyStartNewGame();
  };

  
  // Reset dialog shown flag when game starts new
  useEffect(() => {
    if (!gameState?.isGameOver && hasShownDialog) {
      setHasShownDialog(false);
    }
  }, [gameState?.isGameOver, hasShownDialog]);

  // Reset local hard slam state when move is executed
  useEffect(() => {
    if (!gameState?.hardSlamNextMove && !gameState?.isHardSlamming) {
      setLocalHardSlamActive(false);
    }
  }, [gameState?.hardSlamNextMove, gameState?.isHardSlamming]);

  // Track hard slam state for animation timing
  const [previousIsHardSlamming, setPreviousIsHardSlamming] = useState<boolean>(false);
  const [processedHardSlamEvents, setProcessedHardSlamEvents] = useState<Set<string>>(new Set());

  // Handle hard slam animation using the new triggerHardSlamAnimation flag
  useEffect(() => {
    const shouldTriggerAnimation = gameState?.triggerHardSlamAnimation || false;
    const hardSlamDominoId = gameState?.hardSlamDominoId;
    const animationProfile = gameState?.hardSlamAnimationProfile as ShakeAnimationProfile | undefined;
    const animationEventId = animationProfile?.eventId || hardSlamDominoId || null;
    const dominoExists = hardSlamDominoId && gameState?.dominoes?.[hardSlamDominoId];
    
    console.log('🔥 Hard slam animation check:', {
      triggerHardSlamAnimation: shouldTriggerAnimation,
      hardSlamDominoId,
      dominoExists: !!dominoExists,
      animationEventId
    });

    // Trigger animation if BOTH conditions are met:
    // 1. triggerHardSlamAnimation flag is true (set for all players via database)
    // 2. AND the hard slam domino exists on the board
    if (shouldTriggerAnimation && dominoExists && animationEventId && startShakeAnimation) {
      const alreadyProcessed = processedHardSlamEvents.has(animationEventId);
      
      if (!alreadyProcessed) {
        console.log('🔥 Triggering GLOBAL shake animation for ALL dominoes on board (hard slam trigger)');
        startShakeAnimation({
          isOtherPlayerHardSlam: true,
          profile: animationProfile
        });
        setProcessedHardSlamEvents(prev => new Set(prev).add(animationEventId));
      }
    }
    
    // Clean up processed events when animation flag becomes inactive
    if (!shouldTriggerAnimation && previousIsHardSlamming) {
      setProcessedHardSlamEvents(new Set());
    }
    
    setPreviousIsHardSlamming(shouldTriggerAnimation);
  }, [
    gameState?.triggerHardSlamAnimation,
    gameState?.hardSlamDominoId,
    gameState?.hardSlamAnimationProfile,
    gameState?.dominoes,
    processedHardSlamEvents,
    previousIsHardSlamming,
    startShakeAnimation
  ]);

  useEffect(() => {
    return () => {
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const lockUntil = Number(gameState?.moveCooldownUntilMs || 0);
    const now = Date.now();
    if (lockUntil <= now) {
      setMoveCooldownNowMs(now);
      return;
    }

    const timeout = setTimeout(() => {
      setMoveCooldownNowMs(Date.now());
    }, Math.max(10, lockUntil - now + 15));

    return () => clearTimeout(timeout);
  }, [gameState?.moveCooldownUntilMs]);

  // Show dialog when game becomes over - but prevent multiple triggers
  useEffect(() => {
    if (gameState?.isGameOver && !hasShownDialog) {
      // Small delay to ensure all state updates are complete
      const timeoutId = setTimeout(() => {
        setShowGameOverDialog(true);
        setHasShownDialog(true);
      }, 100);
      return () => clearTimeout(timeoutId);
    }
  }, [gameState?.isGameOver, hasShownDialog]);

  // Access the passMove function from Game.tsx
  const passMove = gameHook.passMove || (() => {
    console.warn('passMove function not available');
  });


  if (syncState?.isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-lg">Loading game...</p>
        </div>
      </div>
    );
  }

  const isMyTurn = syncState?.currentPlayer === syncState?.playerPosition;
  const isMoveLockedByAnimation =
    isVisualAnimating || moveCooldownNowMs < Number(gameState?.moveCooldownUntilMs || 0);
  const currentPlayerName = syncState?.allPlayers?.find((p: any) => p.position === syncState?.currentPlayer)?.username || 'Unknown';
  

  
  // Determine if current player won (has empty hand OR is winner from blocked game)
  const didIWin = gameState?.isGameOver && (
    gameState?.playerHand?.length === 0 || 
    syncState?.playerPosition === gameState?.winner_position
  );
  
  // Check if this was a blocked game - reliable detection:
  // Blocked game = game over + all players still have dominoes + winner determined by points
  // IMPORTANT: Only check for blocked game if there are actually dominoes on the board
  const boardHasDominoes = gameState?.board && Object.keys(gameState.board).length > 0;
  
  const allPlayersHaveDominoes = gameState?.isGameOver && syncState?.allPlayers?.every((_, index) => {
    const playerHand = (gameState as any)?.playerHands?.[index] || [];
    return playerHand.length > 0;
  });
  
  const isBlockedGame = boardHasDominoes && gameState?.isGameOver && allPlayersHaveDominoes && gameState?.winner_position !== undefined;
  
  console.log('🔍 DominoGame - Blocked game detection:', {
    boardHasDominoes: boardHasDominoes,
    isGameOver: gameState?.isGameOver,
    allPlayersHaveDominoes: allPlayersHaveDominoes,
    winnerPosition: gameState?.winner_position,
    isBlockedGame: isBlockedGame,
    didIWin: didIWin,
    playerHandLength: gameState?.playerHand?.length,
    playerPosition: syncState?.playerPosition,
    showGameOverDialog: showGameOverDialog,
    playerHands: (gameState as any)?.playerHands?.map((hand: any, i: number) => ({ player: i, handSize: hand?.length || 0 }))
  });
  
  const fixLayoutOptions: Array<{ key: 'l-0' | 'l-90' | 'l-180' | 'l-270'; label: string }> = [
    { key: 'l-0', label: 'L 0°' },
    { key: 'l-90', label: 'L 90°' },
    { key: 'l-180', label: 'L 180°' },
    { key: 'l-270', label: 'L 270°' },
  ];
  const activeFixLayout = fixLayoutOptions[fixShapeIndex % fixLayoutOptions.length];

  // Calculate legal moves for selected domino
  const selectedDomino = gameState?.selectedHandIndex !== null ? gameState?.playerHand[gameState.selectedHandIndex] : null;
  const legalMoves = selectedDomino ? findLegalMoves(selectedDomino) : [];

  // Enhanced pass logic - knop altijd zichtbaar, enabled wanneer speler kan passen
  let canPass = false;
  let hasAnyLegalMoves = false;
  
  if (isMyTurn && gameState?.playerHand && gameState.playerHand.length > 0) {
    console.log('🔍 Checking pass conditions for player...');
    
    // Check if any domino in hand has legal moves
    for (const domino of gameState.playerHand) {
      const moves = findLegalMoves(domino);
      console.log(`🔍 Domino ${domino.value1}|${domino.value2}: ${moves.length} moves`);
      if (moves.length > 0) {
        hasAnyLegalMoves = true;
        break;
      }
    }
    
    const boneyardEmpty = !gameState?.boneyard?.length || gameState.boneyard.length === 0;
    canPass = !hasAnyLegalMoves && boneyardEmpty;
    
    console.log('🔍 Pass check result:', {
      isMyTurn,
      hasAnyLegalMoves,
      boneyardEmpty,
      boneyardSize: gameState?.boneyard?.length || 0,
      canPass
    });
  }

  // Pas knop is altijd zichtbaar maar alleen enabled wanneer speler kan passen
  const shouldEnablePassButton = canPass && isMyTurn && !gameState?.isGameOver;
  const boardDominoCount = Object.keys(gameState?.dominoes || {}).length;
  const canFixTable =
    isMyTurn &&
    !gameState?.isGameOver &&
    !isMoveLockedByAnimation &&
    boardDominoCount >= 2 &&
    !isFixingTable;

  const handleFixTable = async () => {
    if (!gameHook.fixTableStones) {
      toast({ title: 'Niet beschikbaar', description: 'Fix stenen is nog niet gekoppeld.', variant: 'destructive' });
      return;
    }

    if (!canFixTable) return;
    setIsFixingTable(true);
    try {
      const appliedShape = await gameHook.fixTableStones(activeFixLayout.key);
      if (appliedShape) {
        setFixShapeIndex((prev) => (prev + 1) % fixLayoutOptions.length);
      }
    } finally {
      setIsFixingTable(false);
    }
  };

  // Add index to legal moves for executeMove
  const legalMovesWithIndex = legalMoves.map(move => ({
    ...move,
    index: gameState?.selectedHandIndex
  }));


  // Handle boneyard stone preview
  const handleStonePreview = (domino: DominoData, index: number) => {
    setPreviewDomino({ domino, index });
    
    if (previewTimeoutRef.current) {
      clearTimeout(previewTimeoutRef.current);
    }

    // Auto-hide preview after 3 seconds
    previewTimeoutRef.current = setTimeout(() => {
      setPreviewDomino(null);
      previewTimeoutRef.current = null;
    }, 3000);
  };

  // Handle boneyard stone pick
  const handleBoneyardPick = (index: number) => {
    if (gameState?.boneyard && gameState.boneyard[index]) {
      gameHook.drawSpecificFromBoneyard(index, syncState?.currentPlayer);
      setShowBoneyardDialog(false);
      setPreviewDomino(null);
      if (previewTimeoutRef.current) {
        clearTimeout(previewTimeoutRef.current);
        previewTimeoutRef.current = null;
      }
    }
  };

  // Handle preview click to pick the stone directly
  const handlePreviewClick = () => {
    if (previewDomino) {
      handleBoneyardPick(previewDomino.index);
    }
  };

  const showDevLockstepInfo = isAdmin;
  const adminBoneyardFaceUp = isAdmin && Boolean(getSetting('admin_boneyard_face_up', false));
  const activeHardSlamProfile = gameState?.hardSlamAnimationProfile as ShakeAnimationProfile | undefined;
  const hardSlamPhaseMs = activeHardSlamProfile ? Math.max(0, Date.now() - activeHardSlamProfile.startedAtMs) : 0;

  return (
    <div className="min-h-screen bg-background p-2 md:p-4">
      <div className="max-w-6xl mx-auto space-y-3 md:space-y-6">
        {/* Top Navigation - Always visible */}
        <Card className="p-3 md:p-4">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center space-x-2 md:space-x-4">
              <h2 className={`font-bold ${isMobile ? "text-lg" : "text-2xl"}`}>Domino Game</h2>
              <Badge variant={isMyTurn ? "default" : "secondary"} className={isMobile ? "text-xs" : ""}>
                {isMyTurn ? "Your Turn" : `${currentPlayerName}'s Turn`}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Button 
                onClick={() => navigate('/lobbies')}
                variant="outline"
                size={isMobile ? "sm" : "default"}
                className="flex items-center space-x-1 md:space-x-2"
              >
                <ArrowLeft className={`${isMobile ? "h-3 w-3" : "h-4 w-4"}`} />
                <span className={isMobile ? "text-xs" : ""}>
                  {isMobile ? "Lobby" : "Back to Lobby"}
                </span>
              </Button>
              <Button 
                onClick={handleStartNewGame}
                disabled={!syncState?.isHost || startingNewGame}
                variant="default"
                size={isMobile ? "sm" : "default"}
                className={isMobile ? "text-xs" : ""}
              >
                {isMobile ? "Nieuw Spel" : startingNewGame ? "Starten..." : "Start New Game"}
              </Button>
              {!isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowMobileMenu(!showMobileMenu)}
                  className="p-2"
                >
                  {showMobileMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
                </Button>
              )}
            </div>
          </div>
          
          {/* Game Info Row */}
          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <span className={`text-muted-foreground ${isMobile ? "text-xs" : "text-sm"}`}>
              Boneyard: {gameState?.boneyard?.length || 0} {isMobile ? "" : "tiles"}
            </span>
            <div className="flex items-center space-x-2">
              <Switch 
                checked={boneyardViewEnabled}
                onCheckedChange={setBoneyardViewEnabled}
                id="boneyard-view"
              />
              <label htmlFor="boneyard-view" className={`text-muted-foreground ${isMobile ? "text-xs" : "text-sm"}`}>
                Boneyard view
              </label>
            </div>
          </div>
        </Card>

        {showDevLockstepInfo && (
          <Card className="border-dashed border-amber-400 bg-amber-50/70 p-3">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold text-amber-900">
              <span>DEV DEBUG CONSOLE</span>
            </div>
            <div className="mb-2 rounded border border-amber-300 bg-amber-100/70 p-2">
              <div className="mb-1 text-[11px] font-semibold text-amber-900">Hard Slam lockstep</div>
              {activeHardSlamProfile ? (
                <div className="grid gap-1 text-[11px] text-amber-900/90 md:grid-cols-2">
                  <div><strong>Event:</strong> {activeHardSlamProfile.eventId}</div>
                  <div><strong>Seed:</strong> {activeHardSlamProfile.seed}</div>
                  <div><strong>Server start:</strong> {new Date(activeHardSlamProfile.startedAtMs).toLocaleTimeString()}</div>
                  <div><strong>Local phase:</strong> {hardSlamPhaseMs} ms</div>
                </div>
              ) : (
                <div className="text-[11px] text-amber-900/80">Geen actief hard slam profiel.</div>
              )}
            </div>
            <div className="rounded border border-amber-300 bg-amber-100/70 p-2">
              <div className="mb-1 text-[11px] font-semibold text-amber-900">Bot engine</div>
              <div className="grid gap-1 text-[11px] text-amber-900/90 md:grid-cols-2">
                <div><strong>Status:</strong> {botDebugInfo?.status || 'n/a'}</div>
                <div><strong>Details:</strong> {botDebugInfo?.details || 'n/a'}</div>
                <div><strong>Turn:</strong> {botDebugInfo?.currentPlayer ?? syncState?.currentPlayer}</div>
                <div><strong>Controller:</strong> {botDebugInfo?.controllerPosition ?? 'n/a'}</div>
                <div><strong>Turn key:</strong> {botDebugInfo?.turnKey || '-'}</div>
                <div><strong>Legal moves:</strong> {botDebugInfo?.legalMoves ?? 0}</div>
                <div><strong>Boneyard:</strong> {botDebugInfo?.boneyardSize ?? gameState?.boneyard?.length ?? 0}</div>
                <div><strong>Updated:</strong> {botDebugInfo?.updatedAt ? new Date(botDebugInfo.updatedAt).toLocaleTimeString() : '-'}</div>
              </div>
            </div>
          </Card>
        )}

        {/* Players List */}
        <Card className={isMobile ? "p-3" : "p-4"}>
          <h3 className={`font-semibold mb-3 ${isMobile ? "text-sm" : ""}`}>Players</h3>
          <div className="flex flex-wrap gap-2">
            {syncState?.allPlayers?.map((player: any) => {
              const isCurrentPlayer = player.position === syncState?.currentPlayer;
              const isMyTurn = syncState?.currentPlayer === syncState?.playerPosition && player.position === syncState?.playerPosition;
              return (
                <Badge 
                  key={player.position} 
                  variant={isCurrentPlayer ? "default" : "outline"}
                  className={cn(
                    "flex items-center space-x-1 transition-all duration-300",
                    isMobile ? "text-xs" : "",
                    isCurrentPlayer && "ring-2 ring-primary ring-offset-2 bg-primary text-primary-foreground",
                    isMyTurn && "animate-pulse shadow-lg"
                  )}
                >
                  <span>{player.username}</span>
                  <span className="text-xs opacity-75">
                    ({gameState?.playerHands?.[player.position]?.length || 0})
                  </span>
                  {isCurrentPlayer && <span className="text-xs ml-1">🎯</span>}
                </Badge>
              );
            })}
          </div>
          {/* Turn indicator */}
          <div className="mt-3 pt-2 border-t">
            <div className={cn(
              "text-center font-medium transition-all duration-300",
              isMobile ? "text-sm" : "text-base",
              syncState?.currentPlayer === syncState?.playerPosition 
                ? "text-primary animate-pulse" 
                : "text-muted-foreground"
            )}>
              {syncState?.currentPlayer === syncState?.playerPosition 
                ? "🎯 Jouw beurt!" 
                : `Beurt van ${syncState?.allPlayers?.find(p => p.position === syncState?.currentPlayer)?.username || 'Speler'}`
              }
            </div>
          </div>
        </Card>

        {/* Game Board */}
        <GameBoard 
          gameState={gameState}
          legalMoves={legalMovesWithIndex}
          playerUserIds={playerUserIds}
          onMoveExecute={(move) => {
            if (isMoveLockedByAnimation) return;
            // Pass local hard slam state to the move execution
            const moveWithHardSlam = { ...move, localHardSlamActive };
            gameHook.executeMove(moveWithHardSlam);
            
            // Reset local hard slam after move execution
            if (localHardSlamActive) {
              setLocalHardSlamActive(false);
            }
          }}
          onCenterView={() => {}}
          hasDifferentNeighbor={hasDifferentNeighbor}
          backgroundChoice={gameData?.background_choice}
          tableBackgroundUrl={gameData?.table_background_url}
          onRotateDomino={rotateDomino}
          isMyTurn={syncState?.currentPlayer === syncState?.playerPosition && !isMoveLockedByAnimation}
          
        />

        {/* Player Hand */}
        <PlayerHand
          hand={gameState?.playerHand || []}
          selectedIndex={gameState?.selectedHandIndex}
          onDominoSelect={selectHandDomino}
          isMyTurn={isMyTurn}
        />

        {/* Game Actions */}
        <Card className={isMobile ? "p-3" : "p-4"}>
          {isMobile ? (
            /* Mobile Actions - Compact Layout */
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={boneyardViewEnabled ? () => setShowBoneyardDialog(true) : drawFromBoneyard}
                  disabled={!gameState?.boneyard?.length || !isMyTurn}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  Boneyard ({gameState?.boneyard?.length || 0})
                </Button>
                <Button 
                  onClick={passMove}
                  disabled={!shouldEnablePassButton}
                  variant={shouldEnablePassButton ? "destructive" : "outline"}
                  size="sm"
                  className={`text-xs ${shouldEnablePassButton ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}`}
                >
                  Pas
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  onClick={handleFixTable}
                  disabled={!canFixTable}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                >
                  {isFixingTable ? 'Fixen...' : `Fix stenen (${activeFixLayout.label})`}
                </Button>
                <Button 
                  onClick={() => gameHook.manualBlockedCheck?.()}
                  disabled={!isMyTurn}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-slate-100 hover:bg-slate-200"
                >
                  🔧 Check Blocked
                </Button>
{canHardSlam && (
                  <Button
                    onClick={() => {
                      setLocalHardSlamActive(true);
                    }}
                    disabled={!canUseHardSlam || hardSlamActive || !isMyTurn}
                    size="sm"
                    className={cn(
                      "text-xs transition-all duration-300",
                      hardSlamActive 
                        ? "bg-gradient-to-r from-orange-500 to-red-500 text-white animate-pulse shadow-lg shadow-orange-500/50" 
                        : canUseHardSlam 
                          ? "bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-orange-500 hover:to-red-500 text-black hover:text-white shadow-md hover:shadow-lg" 
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    )}
                  >
                    {hardSlamActive ? "Hard Slam Ready! 🔥" : "Hard Slam! 💥"}
                  </Button>
                )}
              </div>
              {gameState?.isGameOver && (
                <div className="text-center">
                  <span className="text-sm font-semibold text-green-600 block mb-2">Game Over!</span>
                  {!showGameOverDialog && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => setShowGameOverDialog(true)}
                      className="text-xs"
                    >
                      <Trophy className="h-3 w-3 mr-1" />
                      Resultaat tonen
                    </Button>
                  )}
                </div>
              )}
            </div>
          ) : (
            /* Desktop Actions - Horizontal Layout */
            <div className="flex items-center justify-between">
              <div className="flex space-x-2">
                <Button 
                  onClick={boneyardViewEnabled ? () => setShowBoneyardDialog(true) : drawFromBoneyard}
                  disabled={!gameState?.boneyard?.length || !isMyTurn}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  {boneyardViewEnabled && <Grid3X3 className="h-4 w-4" />}
                  <span>Draw from Boneyard ({gameState?.boneyard?.length || 0})</span>
                </Button>
                <Button 
                  onClick={passMove}
                  disabled={!shouldEnablePassButton}
                  variant={shouldEnablePassButton ? "destructive" : "outline"}
                  className={shouldEnablePassButton ? "bg-orange-500 hover:bg-orange-600 text-white" : ""}
                >
                  Pas
                </Button>
                <Button
                  onClick={handleFixTable}
                  disabled={!canFixTable}
                  variant="outline"
                >
                  {isFixingTable ? 'Fixen...' : `Fix stenen (${activeFixLayout.label})`}
                </Button>
                <Button 
                  onClick={() => gameHook.manualBlockedCheck?.()}
                  disabled={!isMyTurn}
                  variant="outline"
                  className="bg-slate-100 hover:bg-slate-200"
                >
                  🔧 Check Blocked
                </Button>
                {canHardSlam && (
                  <Button
                    onClick={() => {
                      setLocalHardSlamActive(true);
                    }}
                    disabled={!canUseHardSlam || hardSlamActive || !isMyTurn}
                    className={cn(
                      "transition-all duration-300",
                      hardSlamActive 
                        ? "bg-gradient-to-r from-orange-500 to-red-500 text-white animate-pulse shadow-lg shadow-orange-500/50" 
                        : canUseHardSlam 
                          ? "bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-orange-500 hover:to-red-500 text-black hover:text-white shadow-md hover:shadow-lg" 
                          : "bg-gray-300 text-gray-500 cursor-not-allowed"
                    )}
                  >
                    {hardSlamActive ? "Hard Slam Ready! 🔥" : "Hard Slam! 💥"}
                  </Button>
                )}
              </div>
              <div className="text-sm text-muted-foreground flex items-center">
                {gameState?.isGameOver ? (
                  <>
                    <span className="font-semibold text-green-600 mr-2">Game Over!</span>
                    {!showGameOverDialog && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => setShowGameOverDialog(true)}
                        className="text-xs py-1 h-7"
                      >
                        <Trophy className="h-3 w-3 mr-1" />
                        Resultaat tonen
                      </Button>
                    )}
                  </>
                ) : (
                  <span>Game in progress...</span>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Boneyard Dialog */}
        <Dialog 
          open={showBoneyardDialog && isMyTurn} 
          onOpenChange={(open) => {
            if (!open) setShowBoneyardDialog(false);
          }}
        >
          <DialogContent className={isMobile ? "max-w-[95vw] max-h-[85vh]" : "sm:max-w-2xl"}>
            <DialogHeader>
              <DialogTitle className={`text-center ${isMobile ? "text-base" : ""}`}>
                Kies een steen uit de boneyard
              </DialogTitle>
            </DialogHeader>
            <div className={`grid ${isMobile ? "grid-cols-4" : "grid-cols-6"} gap-3 p-4 bg-green-100 rounded-lg ${isMobile ? "min-h-[250px]" : "min-h-[300px]"} relative overflow-auto`}>
              {gameState?.boneyard?.map((domino, index) => {
                // Random positioning within grid cell
                const randomX = Math.random() * 20 - 10; // -10 to 10
                const randomY = Math.random() * 20 - 10; // -10 to 10
                const randomRotation = Math.random() * 30 - 15; // -15 to 15 degrees
                
                return (
                  <div
                    key={index}
                    className="relative cursor-pointer hover:scale-105 transition-transform"
                    style={{
                      transform: `translate(${randomX}px, ${randomY}px) rotate(${randomRotation}deg)`,
                    }}
                     onClick={() => handleStonePreview(domino, index)}
                   >
                     <DominoTile
                       data={adminBoneyardFaceUp ? domino : { value1: 0, value2: 0 }} // Admin debug option: show real stones face-up
                       orientation="horizontal"
                       flipped={false}
                       className="w-12 h-6 bg-gray-800 border-2 border-gray-600"
                     />
                   </div>
                );
              })}
              
              {/* Preview domino in center */}
              {previewDomino && (
                <div 
                  className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg cursor-pointer z-10"
                  onClick={handlePreviewClick}
                >
                    <div className="bg-white rounded-lg p-4 shadow-2xl border-4 border-gray-300">
                      <DominoTile
                        data={previewDomino.domino}
                        orientation="horizontal"
                        flipped={false}
                        className={isMobile ? "w-24 h-12" : "w-48 h-24"} // Smaller on mobile
                       />
                      <div className="text-center mt-2 text-sm text-gray-600">
                        Klik om deze steen te nemen
                      </div>
                    </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>

        {/* Game Over Dialog */}
        <Dialog 
          open={(gameState?.isGameOver && showGameOverDialog) || false} 
          onOpenChange={(open) => {
            if (!open) setShowGameOverDialog(false);
          }}
        >
          <DialogContent className={`sm:max-w-md text-center ${didIWin 
            ? 'bg-gradient-to-br from-yellow-50 to-orange-50 border-2 border-yellow-300' 
            : 'bg-gradient-to-br from-red-50 to-gray-50 border-2 border-red-300'
          }`}>
            <DialogHeader>
              <DialogTitle className={`text-3xl font-bold text-center flex items-center justify-center gap-2 mb-4 ${
                didIWin ? 'text-yellow-700' : 'text-red-700'
              }`}>
                {didIWin ? (
                  <>
                    <Trophy className="w-8 h-8 text-yellow-500 animate-bounce" />
                    Gefeliciteerd!
                    <Trophy className="w-8 h-8 text-yellow-500 animate-bounce" />
                  </>
                ) : (
                  <>
                    😔 Helaas! 😔
                  </>
                )}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-6">
              {didIWin ? (
                <>
                  {/* Winner - Celebration Icons */}
                  <div className="flex justify-center space-x-4">
                    <PartyPopper className="w-12 h-12 text-purple-500 animate-pulse" />
                    <Star className="w-12 h-12 text-yellow-500 animate-spin" />
                    <PartyPopper className="w-12 h-12 text-purple-500 animate-pulse" />
                  </div>
                  
                   {/* Winner Message */}
                   <div className="bg-white/70 rounded-lg p-4 border border-yellow-200">
                     <h3 className="text-xl font-semibold text-gray-800 mb-2">
                       🎉 Je hebt gewonnen! 🎉
                     </h3>
                     <p className="text-gray-600">
                       {(gameState as any)?.gameEndReason === 'changa'
                         ? "CHANGA! Je hebt gewonnen met CHANGA!"
                         : isBlockedGame 
                           ? "Spel geblokkeerd! Je hebt gewonnen met de minste punten!" 
                           : "Je hebt alle dominostenen succesvol gespeeld!"
                       }
                     </p>
                   </div>
                  
                  {/* Decorative elements */}
                  <div className="flex justify-center space-x-8 text-2xl">
                    <span className="animate-bounce delay-100">🎊</span>
                    <span className="animate-bounce delay-200">🏆</span>
                    <span className="animate-bounce delay-300">🎊</span>
                  </div>
                </>
              ) : (
                <>
                  {/* Loser - Sad Icons */}
                  <div className="flex justify-center space-x-4">
                    <span className="text-6xl animate-pulse">😢</span>
                    <span className="text-6xl animate-pulse delay-300">😞</span>
                    <span className="text-6xl animate-pulse delay-500">😔</span>
                  </div>
                  
                   {/* Loser Message */}
                   <div className="bg-white/70 rounded-lg p-4 border border-red-200">
                     <h3 className="text-xl font-semibold text-gray-800 mb-2">
                       Je hebt verloren!
                     </h3>
                     <p className="text-gray-600">
                       {(gameState as any)?.gameEndReason === 'changa'
                         ? "CHANGA! Een andere speler won met CHANGA."
                         : isBlockedGame 
                           ? "Spel geblokkeerd! Een andere speler had minder punten." 
                           : "Een andere speler heeft alle stenen als eerste gespeeld."
                       }
                     </p>
                     <p className="text-sm text-gray-500 mt-2">
                       Veel succes volgende keer! 🍀
                     </p>
                   </div>
                  
                  {/* Decorative elements */}
                  <div className="flex justify-center space-x-8 text-2xl">
                    <span className="animate-bounce delay-100">💔</span>
                    <span className="animate-bounce delay-200">😭</span>
                    <span className="animate-bounce delay-300">💔</span>
                  </div>
                </>
              )}
              
              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <Button 
                  onClick={() => setShowGameOverDialog(false)}
                  variant="outline"
                  className="font-medium py-3 text-base flex items-center justify-center shadow hover:shadow-md transition-all"
                >
                  <Eye className="h-4 w-4 mr-2" />
                  Spel bekijken
                </Button>
                
                <Button 
                  onClick={handleStartNewGame}
                  disabled={!syncState?.isHost || startingNewGame}
                  className={`font-bold py-3 text-base shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 ${
                    didIWin 
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white' 
                      : 'bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white'
                  }`}
                >
                  🎮 {startingNewGame ? 'Starten...' : 'Nieuw Spel'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Bevestiging nieuw spel */}
        <AlertDialog open={confirmNewGameOpen} onOpenChange={setConfirmNewGameOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Nieuw spel starten?</AlertDialogTitle>
              <AlertDialogDescription>
                Dit reset het huidige spel voor alle spelers en wist het bord. Weet je het zeker?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel>Annuleren</AlertDialogCancel>
              <AlertDialogAction onClick={actuallyStartNewGame} disabled={startingNewGame}>
                {startingNewGame ? 'Starten...' : 'Start nieuw spel'}
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};