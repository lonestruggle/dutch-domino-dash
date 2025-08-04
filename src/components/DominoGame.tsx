import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { GameBoard } from '@/components/GameBoard';
import { PlayerHand } from '@/components/PlayerHand';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trophy, PartyPopper, Star, Zap, Eye, ArrowLeft } from 'lucide-react';

interface DominoGameProps {
  gameHook: any;
}

export const DominoGame = ({ gameHook }: DominoGameProps) => {
  const navigate = useNavigate();
  
  const {
    gameState,
    findLegalMoves,
    executeMove,
    selectHandDomino,
    drawFromBoneyard,
    startNewGame,
    hasDifferentNeighbor,
    syncState,
    gameData
  } = gameHook;

  const [showGameOverDialog, setShowGameOverDialog] = useState(false);
  
  // Show dialog when game becomes over - moved after destructuring
  useEffect(() => {
    if (gameState?.isGameOver) {
      setShowGameOverDialog(true);
    }
  }, [gameState?.isGameOver]);

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
  const allPlayersHaveDominoes = gameState?.isGameOver && syncState?.allPlayers?.every((_, index) => {
    const playerHand = (gameState as any)?.playerHands?.[index] || [];
    return playerHand.length > 0;
  });
  
  const isBlockedGame = gameState?.isGameOver && allPlayersHaveDominoes && gameState?.winner_position !== undefined;
  
  console.log('🔍 DominoGame - Blocked game detection:', {
    isGameOver: gameState?.isGameOver,
    allPlayersHaveDominoes: allPlayersHaveDominoes,
    winnerPosition: gameState?.winner_position,
    isBlockedGame: isBlockedGame,
    didIWin: didIWin,
    playerHands: (gameState as any)?.playerHands?.map((hand: any, i: number) => ({ player: i, handSize: hand?.length || 0 }))
  });
  
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

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Game Status */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-2xl font-bold">Domino Game</h2>
              <Badge variant={isMyTurn ? "default" : "secondary"}>
                {isMyTurn ? "Your Turn" : `${currentPlayerName}'s Turn`}
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm text-muted-foreground">
                Boneyard: {gameState?.boneyard?.length || 0} tiles
              </span>
            </div>
          </div>
        </Card>

        {/* Players List */}
        <Card className="p-4">
          <h3 className="font-semibold mb-3">Players</h3>
          <div className="flex flex-wrap gap-2">
            {syncState?.allPlayers?.map((player: any) => (
              <Badge 
                key={player.position} 
                variant={player.position === gameState?.currentPlayer ? "default" : "outline"}
                className="flex items-center space-x-2"
              >
                <span>{player.username}</span>
                <span className="text-xs opacity-75">
                  ({gameState?.playerHands?.[player.position]?.length || 0} tiles)
                </span>
              </Badge>
            ))}
          </div>
        </Card>

        {/* Game Board */}
        <GameBoard 
          gameState={gameState}
          legalMoves={legalMovesWithIndex}
          onMoveExecute={executeMove}
          onCenterView={() => {}}
          hasDifferentNeighbor={hasDifferentNeighbor}
          backgroundChoice={gameData?.background_choice}
        />

        {/* Player Hand */}
        <PlayerHand
          hand={gameState?.playerHand || []}
          selectedIndex={gameState?.selectedHandIndex}
          onDominoSelect={selectHandDomino}
        />

        {/* Game Actions */}
        <Card className="p-4">
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
                onClick={drawFromBoneyard}
                disabled={!gameState?.boneyard?.length}
                variant="outline"
              >
                Draw from Boneyard ({gameState?.boneyard?.length || 0})
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
        </Card>

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
    </div>
  );
};