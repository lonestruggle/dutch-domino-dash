import { GameBoard } from '@/components/GameBoard';
import { PlayerHand } from '@/components/PlayerHand';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trophy, PartyPopper, Star, Zap } from 'lucide-react';

interface DominoGameProps {
  gameHook: any;
}

export const DominoGame = ({ gameHook }: DominoGameProps) => {
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
  
  // Determine if current player won (has empty hand)
  const didIWin = gameState?.isGameOver && gameState?.playerHand?.length === 0;
  
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
                disabled={!canUseHardSlam}
                variant="secondary"
                className={canUseHardSlam ? "bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold shadow-lg" : ""}
              >
                <Zap className="h-4 w-4 mr-2" />
                Hard Slam! 💥
              </Button>
            </div>
            <div className="text-sm text-muted-foreground">
              {gameState?.isGameOver ? (
                <span className="font-semibold text-green-600">Game Over!</span>
              ) : (
                <span>Game in progress...</span>
              )}
            </div>
          </div>
        </Card>

        {/* Game Over Dialog */}
        <Dialog open={gameState?.isGameOver || false} onOpenChange={() => startNewGame()}>
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
                      Je hebt alle dominostenen succesvol gespeeld!
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
                      Een andere speler heeft alle stenen als eerste gespeeld.
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
              
              {/* Action Button */}
              <Button 
                onClick={startNewGame}
                className={`w-full font-bold py-3 text-lg shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105 ${
                  didIWin 
                    ? 'bg-gradient-to-r from-yellow-400 to-orange-500 hover:from-yellow-500 hover:to-orange-600 text-white' 
                    : 'bg-gradient-to-r from-blue-400 to-blue-600 hover:from-blue-500 hover:to-blue-700 text-white'
                }`}
              >
                🎮 Nieuw Spel Starten
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};