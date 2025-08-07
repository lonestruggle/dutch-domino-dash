import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameBoard } from '@/components/GameBoard';
import { PlayerHand } from '@/components/PlayerHand';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { DominoTile } from '@/components/DominoTile';
import { useIsMobile } from '@/hooks/use-mobile';
import { Trophy, PartyPopper, Star, Zap, Eye, ArrowLeft, Grid3X3, Menu, X, Settings, Ruler } from 'lucide-react';
import { LegalMove } from '@/types/domino';

interface DominoGameProps {
  gameHook: any;
}

interface ExtendedLegalMove extends LegalMove {
  handIndex: number;
  isSelected: boolean;
}

export const DominoGame = ({ gameHook }: DominoGameProps) => {
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  
  const {
    gameState,
    findLegalMoves,
    executeMove,
    selectHandDomino,
    drawFromBoneyard,
    startNewGame,
    hasDifferentNeighbor,
    rotateDomino,
    syncState,
    gameData
  } = gameHook;

  const [showGameOverDialog, setShowGameOverDialog] = useState(false);
  const [hasShownDialog, setHasShownDialog] = useState(false);
  const [showBoneyardDialog, setShowBoneyardDialog] = useState(false);
  const [boneyardViewEnabled, setBoneyardViewEnabled] = useState(false);
  const [previewDomino, setPreviewDomino] = useState<{ domino: any; index: number } | null>(null);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const [showDominoPreview, setShowDominoPreview] = useState(true);
  const [distanceRestriction, setDistanceRestriction] = useState(3); // Distance in half-grids (3 = 1.5 cells)
  const [showSettingsDialog, setShowSettingsDialog] = useState(false);
  
  // Reset dialog shown flag when game starts new
  useEffect(() => {
    if (!gameState?.isGameOver && hasShownDialog) {
      setHasShownDialog(false);
    }
  }, [gameState?.isGameOver, hasShownDialog]);

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

  // Access the hardSlam function from Game.tsx
  const hardSlam = gameHook.hardSlam || (() => {
    console.warn('hardSlam function not available');
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

  const isMyTurn = gameState?.currentPlayer === syncState?.playerPosition;
  const currentPlayerName = syncState?.allPlayers?.find(p => p.position === gameState?.currentPlayer)?.username || 'Unknown';
  
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
  
  // Calculate legal moves - always show all possible moves
  const getAllLegalMoves = (): ExtendedLegalMove[] => {
    if (!gameState?.playerHand || !isMyTurn) return [];
    
    const allMoves: ExtendedLegalMove[] = [];
    const selectedIndex = gameState.selectedHandIndex;
    
    // Helper function to check if a position is too close to existing dominoes
    const isTooCloseToExistingDominoes = (x: number, y: number, orientation: string) => {
      // Exception: allow placement if there are 3 or fewer dominoes on the board
      if (Object.keys(gameState.dominoes).length <= 3) {
        return false;
      }
      const moveWidth = orientation === 'horizontal' ? 2 : 1;
      const moveHeight = orientation === 'vertical' ? 2 : 1;
      
      // Check all cells that this domino would occupy
      for (let dx = 0; dx < moveWidth; dx++) {
        for (let dy = 0; dy < moveHeight; dy++) {
          const checkX = x + dx;
          const checkY = y + dy;
          
          // Check distance to all existing dominoes
          for (const domino of Object.values(gameState.dominoes)) {
            const dominoWidth = (domino as any).orientation === 'horizontal' ? 2 : 1;
            const dominoHeight = (domino as any).orientation === 'vertical' ? 2 : 1;
            
            // Check all cells of the existing domino
            for (let odx = 0; odx < dominoWidth; odx++) {
              for (let ody = 0; ody < dominoHeight; ody++) {
                const existingX = (domino as any).x + odx;
                const existingY = (domino as any).y + ody;
                
                // Calculate Manhattan distance in half-grids
                const distance = (Math.abs(checkX - existingX) + Math.abs(checkY - existingY)) * 2;
                if (distance < distanceRestriction) { // Changed from <= to <
                  return true; // Too close
                }
              }
            }
          }
        }
      }
      return false; // Safe distance
    };
    
    gameState.playerHand.forEach((domino, index) => {
      const moves = findLegalMoves(domino);
      moves.forEach(move => {
        // Skip if too close to existing dominoes (but allow direct connections)
        if (isTooCloseToExistingDominoes(move.x, move.y, move.orientation)) {
          return;
        }
        
        allMoves.push({ 
          ...move, 
          handIndex: index,
          isSelected: selectedIndex === index
        });
      });
    });
    return allMoves;
  };

  // Calculate second level legal moves (next possible moves after placing first moves)
  const getSecondLevelMoves = (): ExtendedLegalMove[] => {
    if (!gameState?.playerHand || !isMyTurn || gameState.selectedHandIndex !== null) return [];
    
    const secondLevelMoves: ExtendedLegalMove[] = [];
    const firstLevelMoves = getAllLegalMoves();
    const seenPositions = new Set<string>(); // Track exact positions to avoid duplicates
    
    firstLevelMoves.forEach(firstMove => {
      // Simulate placing this domino and calculate new open ends
      const simulatedOpenEnds = calculateOpenEndsAfterMove(firstMove);
      
      // Check remaining dominoes for moves against new open ends
      gameState.playerHand.forEach((domino, handIndex) => {
        if (handIndex === firstMove.handIndex) return; // Skip the domino we just placed
        
        simulatedOpenEnds.forEach(openEnd => {
          if (openEnd.value === domino.value1 || openEnd.value === domino.value2) {
            // This domino can connect to the new open end
            const flipped = openEnd.value === domino.value2;
            const orientation = getOrientationForConnection(openEnd);
            const { x, y } = calculatePositionFromOpenEnd(openEnd, orientation);
            
            // Create unique position key with more detail to prevent duplicates
            const positionKey = `${x},${y},${orientation},${domino.value1},${domino.value2},${flipped}`;
            if (seenPositions.has(positionKey)) return; // Skip exact duplicates
            
            // Check for overlap with first-level moves
            const moveWidth = orientation === 'horizontal' ? 2 : 1;
            const moveHeight = orientation === 'vertical' ? 2 : 1;
            let overlapsWithFirstLevel = false;
            
            // Check against all first-level moves
            firstLevelMoves.forEach(otherFirstMove => {
              const otherWidth = otherFirstMove.orientation === 'horizontal' ? 2 : 1;
              const otherHeight = otherFirstMove.orientation === 'vertical' ? 2 : 1;
              
              for (let dx = 0; dx < moveWidth && !overlapsWithFirstLevel; dx++) {
                for (let dy = 0; dy < moveHeight && !overlapsWithFirstLevel; dy++) {
                  const checkX = x + dx;
                  const checkY = y + dy;
                  
                  for (let odx = 0; odx < otherWidth && !overlapsWithFirstLevel; odx++) {
                    for (let ody = 0; ody < otherHeight && !overlapsWithFirstLevel; ody++) {
                      const otherX = otherFirstMove.x + odx;
                      const otherY = otherFirstMove.y + ody;
                      
                      if (checkX === otherX && checkY === otherY) {
                        overlapsWithFirstLevel = true;
                      }
                    }
                  }
                }
              }
            });
            
            // Check for overlap with existing board pieces
            let overlapsWithBoard = false;
            for (let dx = 0; dx < moveWidth && !overlapsWithBoard; dx++) {
              for (let dy = 0; dy < moveHeight && !overlapsWithBoard; dy++) {
                const checkX = x + dx;
                const checkY = y + dy;
                const cellKey = `${checkX},${checkY}`;
                if (gameState.board[cellKey]) {
                  overlapsWithBoard = true;
                }
              }
            }
            
            // Check for overlap with other second-level moves (prevent yellow on yellow)
            let overlapsWithSecondLevel = false;
            secondLevelMoves.forEach(existingSecondMove => {
              const existingWidth = existingSecondMove.orientation === 'horizontal' ? 2 : 1;
              const existingHeight = existingSecondMove.orientation === 'vertical' ? 2 : 1;
              
              for (let dx = 0; dx < moveWidth && !overlapsWithSecondLevel; dx++) {
                for (let dy = 0; dy < moveHeight && !overlapsWithSecondLevel; dy++) {
                  const checkX = x + dx;
                  const checkY = y + dy;
                  
                  for (let edx = 0; edx < existingWidth && !overlapsWithSecondLevel; edx++) {
                    for (let edy = 0; edy < existingHeight && !overlapsWithSecondLevel; edy++) {
                      const existingX = existingSecondMove.x + edx;
                      const existingY = existingSecondMove.y + edy;
                      
                      if (checkX === existingX && checkY === existingY) {
                        overlapsWithSecondLevel = true;
                      }
                    }
                  }
                }
              }
            });
            
            // Only add if no overlaps
            if (!overlapsWithFirstLevel && !overlapsWithBoard && !overlapsWithSecondLevel) {
              seenPositions.add(positionKey);
              secondLevelMoves.push({
                end: openEnd,
                dominoData: domino,
                flipped,
                orientation,
                x,
                y,
                handIndex,
                isSelected: false // These are always yellow/secondary
              });
            }
          }
        });
      });
    });
    
    return secondLevelMoves;
  };

  // Helper function to calculate open ends after a move (verbeterde versie)
  const calculateOpenEndsAfterMove = (move: ExtendedLegalMove) => {
    const { dominoData, x, y, orientation, flipped, end } = move;
    
    // Start with existing open ends and remove the one that this move connects to
    const remainingOpenEnds = gameState.openEnds.filter(openEnd => 
      !(openEnd.x === end.x && openEnd.y === end.y)
    );
    
    // Add the new open ends from the placed domino (only the free ends)
    const newOpenEnds = [...remainingOpenEnds];
    
    if (orientation === 'horizontal') {
      const leftValue = flipped ? dominoData.value2 : dominoData.value1;
      const rightValue = flipped ? dominoData.value1 : dominoData.value2;
      
      // Left end
      const leftX = x - 1;
      const leftY = y;
      const leftKey = `${leftX},${leftY}`;
      // Only add if this position is not the connection point and not occupied
      if (!(leftX === end.x && leftY === end.y) && !gameState.board[leftKey]) {
        newOpenEnds.push({
          x: leftX,
          y: leftY,
          value: leftValue,
          fromDir: 'W' as const
        });
      }
      
      // Right end
      const rightX = x + 2;
      const rightY = y;
      const rightKey = `${rightX},${rightY}`;
      // Only add if this position is not the connection point and not occupied
      if (!(rightX === end.x && rightY === end.y) && !gameState.board[rightKey]) {
        newOpenEnds.push({
          x: rightX,
          y: rightY,
          value: rightValue,
          fromDir: 'E' as const
        });
      }
    } else {
      const topValue = flipped ? dominoData.value2 : dominoData.value1;
      const bottomValue = flipped ? dominoData.value1 : dominoData.value2;
      
      // Top end
      const topX = x;
      const topY = y - 1;
      const topKey = `${topX},${topY}`;
      // Only add if this position is not the connection point and not occupied
      if (!(topX === end.x && topY === end.y) && !gameState.board[topKey]) {
        newOpenEnds.push({
          x: topX,
          y: topY,
          value: topValue,
          fromDir: 'N' as const
        });
      }
      
      // Bottom end
      const bottomX = x;
      const bottomY = y + 2;
      const bottomKey = `${bottomX},${bottomY}`;
      // Only add if this position is not the connection point and not occupied
      if (!(bottomX === end.x && bottomY === end.y) && !gameState.board[bottomKey]) {
        newOpenEnds.push({
          x: bottomX,
          y: bottomY,
          value: bottomValue,
          fromDir: 'S' as const
        });
      }
    }
    
    return newOpenEnds;
  };

  const getOrientationForConnection = (openEnd: any) => {
    return (openEnd.fromDir === 'N' || openEnd.fromDir === 'S') ? 'vertical' : 'horizontal';
  };

  const calculatePositionFromOpenEnd = (openEnd: any, orientation: string) => {
    let { x, y } = openEnd;
    if (orientation === "horizontal" && openEnd.fromDir === "W") x -= 1;
    if (orientation === "vertical" && openEnd.fromDir === "N") y -= 1;
    return { x, y };
  };
  
  const legalMoves = getAllLegalMoves();
  const secondLevelMoves = getSecondLevelMoves();

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

  // Add index to legal moves for executeMove
  const legalMovesWithIndex = legalMoves.map(move => ({
    ...move,
    index: gameState?.selectedHandIndex
  }));

  // Check if Hard Slam is available
  const canUseHardSlam = isMyTurn && 
    !gameState?.isGameOver && 
    Object.keys(gameState?.dominoes || {}).length > 0; // At least one domino on board
  
  // Check if Hard Slam is activated for next move
  const hardSlamActive = gameState?.hardSlamNextMove === true;

  // Handle boneyard stone preview
  const handleStonePreview = (domino: any, index: number) => {
    setPreviewDomino({ domino, index });
    
    // Auto-hide preview after 3 seconds
    setTimeout(() => {
      setPreviewDomino(null);
    }, 3000);
  };

  // Handle boneyard stone pick
  const handleBoneyardPick = (index: number) => {
    if (gameState?.boneyard && gameState.boneyard[index]) {
      gameHook.drawSpecificFromBoneyard(index);
      setShowBoneyardDialog(false);
      setPreviewDomino(null);
    }
  };

  // Handle preview click to pick the stone directly
  const handlePreviewClick = () => {
    if (previewDomino) {
      handleBoneyardPick(previewDomino.index);
    }
  };

  return (
    <div className="min-h-screen bg-background p-2 md:p-4">
      <div className="max-w-6xl mx-auto space-y-3 md:space-y-6">
        {/* Mobile Header - Compact */}
        {isMobile ? (
          <Card className="p-3">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-bold">Domino Game</h2>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowMobileMenu(!showMobileMenu)}
                className="p-2"
              >
                {showMobileMenu ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <Badge variant={isMyTurn ? "default" : "secondary"} className="text-xs">
                {isMyTurn ? "Your Turn" : `${currentPlayerName}'s Turn`}
              </Badge>
              <span className="text-xs text-muted-foreground">
                Boneyard: {gameState?.boneyard?.length || 0}
              </span>
            </div>
            {/* Mobile Menu */}
            {showMobileMenu && (
              <div className="mt-3 pt-3 border-t space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="mobile-boneyard-view" className="text-sm text-muted-foreground">
                    Boneyard view
                  </label>
                  <Switch 
                    checked={boneyardViewEnabled}
                    onCheckedChange={setBoneyardViewEnabled}
                    id="mobile-boneyard-view"
                  />
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowSettingsDialog(true)}
                  className="w-full flex items-center gap-2 justify-center"
                >
                  <Settings className="h-4 w-4" />
                  Instellingen
                </Button>
              </div>
            )}
          </Card>
        ) : (
          /* Desktop Header */
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <h2 className="text-2xl font-bold">Domino Game</h2>
                <Badge variant={isMyTurn ? "default" : "secondary"}>
                  {isMyTurn ? "Your Turn" : `${currentPlayerName}'s Turn`}
                </Badge>
              </div>
              <div className="flex items-center space-x-4">
                <span className="text-sm text-muted-foreground">
                  Boneyard: {gameState?.boneyard?.length || 0} tiles
                </span>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch 
                      checked={boneyardViewEnabled}
                      onCheckedChange={setBoneyardViewEnabled}
                      id="boneyard-view"
                    />
                    <label htmlFor="boneyard-view" className="text-sm text-muted-foreground">
                      Boneyard view
                    </label>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowSettingsDialog(true)}
                    className="flex items-center gap-1"
                  >
                    <Settings className="h-4 w-4" />
                    Instellingen
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Players List */}
        <Card className={isMobile ? "p-3" : "p-4"}>
          <h3 className={`font-semibold mb-3 ${isMobile ? "text-sm" : ""}`}>Players</h3>
          <div className="flex flex-wrap gap-2">
            {syncState?.allPlayers?.map((player: any) => (
              <Badge 
                key={player.position} 
                variant={player.position === gameState?.currentPlayer ? "default" : "outline"}
                className={`flex items-center space-x-1 ${isMobile ? "text-xs" : ""}`}
              >
                <span>{player.username}</span>
                <span className="text-xs opacity-75">
                  ({gameState?.playerHands?.[player.position]?.length || 0})
                </span>
              </Badge>
            ))}
          </div>
        </Card>

        {/* Game Board */}
        <GameBoard 
          gameState={gameState}
          legalMoves={[...legalMovesWithIndex, ...secondLevelMoves.map(move => ({ ...move, isSecondLevel: true }))]}
          onMoveExecute={executeMove}
          onCenterView={() => {}}
          hasDifferentNeighbor={hasDifferentNeighbor}
          backgroundChoice={gameData?.background_choice}
          onRotateDomino={rotateDomino}
          showGrid={showGrid}
          showDominoPreview={showDominoPreview}
        />

        {/* Player Hand */}
        <PlayerHand
          hand={gameState?.playerHand || []}
          selectedIndex={gameState?.selectedHandIndex}
          onDominoSelect={selectHandDomino}
        />

        {/* Game Actions */}
        <Card className={isMobile ? "p-3" : "p-4"}>
          {isMobile ? (
            /* Mobile Actions - Stacked Layout */
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={() => navigate('/lobbies')}
                  variant="outline"
                  size="sm"
                  className="flex items-center justify-center"
                >
                  <ArrowLeft className="h-4 w-4 mr-1" />
                  <span className="text-xs">Lobby</span>
                </Button>
                <Button 
                  onClick={startNewGame}
                  variant="default"
                  size="sm"
                  className="text-xs"
                >
                  Nieuw Spel
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Button 
                  onClick={boneyardViewEnabled ? () => setShowBoneyardDialog(true) : drawFromBoneyard}
                  disabled={!gameState?.boneyard?.length}
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
              <div className="grid grid-cols-1 gap-2">
                <Button 
                  onClick={hardSlam}
                  disabled={!canUseHardSlam || hardSlamActive}
                  variant="secondary"
                  size="sm"
                  className={`text-xs ${
                    hardSlamActive 
                      ? "bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold shadow-lg animate-pulse" 
                      : canUseHardSlam 
                        ? "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold shadow-lg" 
                        : ""
                  }`}
                >
                  <Zap className="h-3 w-3 mr-1" />
                  {hardSlamActive ? "Hard Slam Ready! 🔥" : "Hard Slam! 💥"}
                </Button>
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
                  onClick={() => navigate('/lobbies')}
                  variant="outline"
                  className="flex items-center space-x-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Back to Lobby</span>
                </Button>
                <Button 
                  onClick={startNewGame}
                  variant="default"
                >
                  Start New Game
                </Button>
                <Button 
                  onClick={boneyardViewEnabled ? () => setShowBoneyardDialog(true) : drawFromBoneyard}
                  disabled={!gameState?.boneyard?.length}
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
                  onClick={hardSlam}
                  disabled={!canUseHardSlam || hardSlamActive}
                  variant="secondary"
                  className={
                    hardSlamActive 
                      ? "bg-gradient-to-r from-red-500 to-pink-500 text-white font-bold shadow-lg animate-pulse" 
                      : canUseHardSlam 
                        ? "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold shadow-lg" 
                        : ""
                  }
                >
                  <Zap className="h-4 w-4 mr-2" />
                  {hardSlamActive ? "Hard Slam Ready! 🔥" : "Hard Slam! 💥"}
                </Button>
                <Button 
                  onClick={() => gameHook.manualBlockedCheck?.()}
                  variant="outline"
                  className="bg-slate-100 hover:bg-slate-200"
                >
                  🔧 Check Blocked
                </Button>
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
          open={showBoneyardDialog} 
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
                       data={{ value1: 0, value2: 0 }} // Face down - show blank
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
                       className="w-48 h-24 transform scale-100" // 4x larger than normal
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
                       {isBlockedGame 
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
                       {isBlockedGame 
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
                  onClick={startNewGame}
                  className={`font-bold py-3 text-base shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 ${
                    didIWin 
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white' 
                      : 'bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white'
                  }`}
                >
                  🎮 Nieuw Spel
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettingsDialog} onOpenChange={setShowSettingsDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Instellingen
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label htmlFor="grid-setting" className="text-sm font-medium flex items-center gap-2">
                  <Grid3X3 className="h-4 w-4" />
                  Grid weergeven
                </label>
                <p className="text-xs text-muted-foreground">
                  Toon hulplijnen voor beter domino plaatsing
                </p>
              </div>
              <Switch
                id="grid-setting"
                checked={showGrid}
                onCheckedChange={setShowGrid}
              />
            </div>
            
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <label htmlFor="preview-setting" className="text-sm font-medium flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Domino preview
                </label>
                <p className="text-xs text-muted-foreground">
                  Toon domino preview in legal moves
                </p>
              </div>
              <Switch
                id="preview-setting"
                checked={showDominoPreview}
                onCheckedChange={setShowDominoPreview}
              />
            </div>
            
            <div className="space-y-3">
              <div className="space-y-1">
                <label htmlFor="distance-setting" className="text-sm font-medium flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  Afstandsbeperking
                </label>
                <p className="text-xs text-muted-foreground">
                  Minimale afstand tussen dominostenen (in halve grids)
                </p>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">0</span>
                  <span className="text-sm font-medium">{distanceRestriction / 2}</span>
                  <span className="text-sm text-muted-foreground">5</span>
                </div>
                <Slider
                  id="distance-setting"
                  min={0}
                  max={10}
                  step={1}
                  value={[distanceRestriction]}
                  onValueChange={(value) => setDistanceRestriction(value[0])}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};